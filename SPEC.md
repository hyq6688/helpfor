# SPEC｜帮拍引导 Web 应用（shot-guide）技术规格

> 版本 **v2.0** · 2026-10-29 · 配套 [PRD.md](./PRD.md)
>
> 本文只定义**实现层面**：技术栈、数据结构、坐标换算、判定阈值、伪代码、验收方式。
> 产品行为与用户可见文案见 PRD；**本文不重复文案**，文案统一从 PRD §5.6 落到 `src/copy.ts`。
>
> 数值标记：`[定稿]` 不得改动 · `[待校准]` 必须按 §14 校准 · `[TBD]` 未决策。

---

## 1. 技术栈与依赖

### 1.1 栈

| 项 | 规定 |
| --- | --- |
| 构建 | Vite 5+ |
| 语言 | TypeScript 5+（`strict: true`） |
| 框架 | React 18+（函数组件 + Hooks） |
| 样式 | CSS Modules 或普通 CSS + CSS 变量；**不引入 UI 库** |
| 检测 | `@mediapipe/tasks-vision`：`ObjectDetector` + `PoseLandmarker`（见 §1.3） |
| 语音 | Web Speech API（`window.speechSynthesis`） |
| 常亮 | Screen Wake Lock API |
| 状态 | `React Context + useReducer`；**不引入** Redux / Zustand / 路由库 / 动画库 |

### 1.2 模型与 WASM 必须自托管 `[定稿]`

v1.0 从 `storage.googleapis.com` 与 `cdn.jsdelivr.net` 拉取模型，在目标市场（中国大陆）不可用。改为随包发布：

```
public/
  models/
    efficientdet_lite0.tflite      // ObjectDetector，约 4–6MB
    pose_landmarker_lite.task      // PoseLandmarker，约 5–7MB
  wasm/                            // 从 node_modules/@mediapipe/tasks-vision/wasm 整目录拷入
```

- 安装后执行一次拷贝脚本，把 `node_modules/@mediapipe/tasks-vision/wasm/*` 复制到 `public/wasm/`，**不得引用外链**。
- `FilesetResolver.forVisionTasks('/wasm')`。
- 部署要求：**必须 HTTPS 或 localhost**。`isSecureContext === false` 时直接进 SFallback（PRD §6）。
- `tasks-vision` 内置的 usage log（`odml.pa.googleapis.com`）在 `main.tsx` 中阻断，保证运行期无外部请求（验收 §13 第 14 条）。

### 1.3 两个模型的分工（方案 C）

| 模型 | 频率 | 提供 | 用途 |
| --- | --- | --- | --- |
| `ObjectDetector`（efficientdet_lite0） | 10fps | person 外接框 | **边界**：头顶、脚下、是否有人 |
| `PoseLandmarker`（lite） | 5fps | 33 关键点 + presence | **尺度与水平中心**：肩宽、肩中心、正对判断 |

原因见 PRD §3.1：半身/膝上构图时人框被切断，框高恒为约 0.85，不能作为尺度；而头顶没有关键点，只能靠框顶边。

ObjectDetector 配置：

```ts
ObjectDetector.createFromOptions(vision, {
  baseOptions: { modelAssetPath: '/models/efficientdet_lite0.tflite', delegate: 'GPU' },
  scoreThreshold: 0.4,
  runningMode: 'VIDEO',
  maxResults: 5,
});
```

PoseLandmarker 配置：

```ts
PoseLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task', delegate: 'GPU' },
  runningMode: 'VIDEO',
  numPoses: 2,                    // 允许路上有第二个人，避免锁错目标
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
});
```

`delegate: 'GPU'` 抛错时静默降级到 `'CPU'`，不跳失败页。

---

## 2. 项目结构

```
src/
  main.tsx
  App.tsx                     // 屏幕路由（状态机）
  types.ts
  constants.ts                // 阈值、间隔、时长
  copy.ts                     // 文案表，逐字来自 PRD §5.6
  profiles.ts                 // 3 个构图档案：目标框、轮廓、规则集
  hooks/
    useCamera.ts
    useDetectors.ts           // 两个模型初始化 + 逐帧推理（含采样时钟）
    useOrientation.ts         // roll（含 iOS 授权）
    useSpeech.ts              // 解锁、节流、倒计时通道
    useCapture.ts             // 倒计时 + 连拍（S4 与 SManual 共用）
    useWakeLock.ts
  core/
    coordinate.ts             // 视频 → 容器
    metrics.ts                // SubjectMetrics
    smoothing.ts              // EMA（纯函数）
    tracking.ts               // 多人锁定（纯函数）
    ruleEngine.ts
    capture.ts                // grabFrame + coverSourceRect（所见即所得抓帧）
    save.ts                   // share / download
  screens/
    S1SceneSelect.tsx
    S2IncludeGround.tsx       // 仅全身
    S3Handoff.tsx
    S4Guide.tsx
    S5Select.tsx
    SFallback.tsx
    SManual.tsx
  components/
    Silhouette.tsx
    GuideBar.tsx
    ShutterButton.tsx
    LevelIndicator.tsx
    OnboardingOverlay.tsx
    LoadingOverlay.tsx
  styles/global.css
```

---

## 3. 类型定义（`types.ts`）

```ts
export type SceneId = 'half' | 'full';
export type ProfileId = 'half' | 'full_ground' | 'full_noground';
export type ScreenId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'SFallback' | 'SManual';
export type RuleColor = 'red' | 'yellow' | 'green';

export interface AppState {
  screen: ScreenId;
  sceneId: SceneId | null;
  includeGround: boolean;      // 仅 full 有意义，默认 true
  profile: ProfileId | null;
  photos: Blob[];
  selectedIndex: number;       // 默认 0
  saveState: 'idle' | 'handedToSystem' | 'downloaded' | 'cancelled' | 'failed';
  failure: 'permission' | 'notFound' | 'insecure' | null;
  hasSeenOnboarding: boolean;
}

export interface Box { x: number; y: number; w: number; h: number; }   // 容器归一化
export interface Point { x: number; y: number; }

export interface DetectionState {
  hasPerson: boolean;
  box: Box | null;             // 容器归一化；可能 <0 或 >1（被 cover 裁掉的部分）
  confidence: number;
  timestamp: number;
}

export interface PoseState {
  hasPerson: boolean;
  hasShoulders: boolean;
  shoulderL: Point | null;     // 容器归一化
  shoulderR: Point | null;
  nose: Point | null;          // 正对判断用
  timestamp: number;
}

export interface SubjectMetrics {
  hasPerson: boolean;
  hasEdges: boolean;           // 检测框有效
  hasShoulders: boolean;       // 双肩关键点 presence 达标
  headTop: number;             // 框顶边 → 容器归一化 y
  bottomEdge: number;          // 框底边
  centerX: number;             // 肩中心 x；无肩时退回框中心
  shoulderWidth: number;       // 归一化到容器宽
  faceOffset: number;          // |鼻尖x - 肩中心x| / 肩宽；越大越侧身
  scale: number;               // 由 profile.scaleSource 决定
  brightness: number;
  rollDeg: number;             // 有符号；右倾为正（不再取绝对值）
}

export interface RuleResult {
  ruleId: string;
  priority: number;
  color: RuleColor;
  message: string;
  voice: string;
}

export interface RuleConfig {
  id: string;
  copyId: string;                          // 映射 copy.ts
  priority: number;
  color: 'red' | 'yellow';
  precondition?: (m: SubjectMetrics) => boolean;
  enter: (m: SubjectMetrics) => boolean;
  exit: (m: SubjectMetrics) => boolean;
}

export interface ProfileConfig {
  id: ProfileId;
  label: string;
  targetBox: Box;
  targetCenterX: number;
  scaleSource: 'shoulder' | 'bboxHeight';
  silhouettePath: 'half' | 'full' | 'full_crop';
  rules: RuleConfig[];
  briefing: string[];          // 手动模式/SFallback 的三句静态指引
}
```

**注意：`evaluate()` 的返回类型是 `RuleResult | null`**，与 v1.0 的 `RuleResult` 不同。

---

## 4. 常量与档案（`constants.ts` / `profiles.ts`）

### 4.1 采样与判定

```ts
export const DETECT_INTERVAL_MS = 100;          // [定稿] 10fps
export const POSE_INTERVAL_MS = 200;            // [定稿] 5fps
export const DETECT_CONFIDENCE_MIN = 0.4;       // [定稿]
export const POSE_MIN_PRESENCE = 0.5;           // [定稿] 肩点 presence 门槛
export const EMA_ALPHA = 0.3;                   // [定稿]
export const HYSTERESIS_MS = 300;               // [定稿] 取代 v1.0 的 HYSTERESIS_FRAMES
export const GREEN_HOLD_MS = 400;               // [定稿]
export const SAMPLE_CLOCK_CAP_MS = 200;         // [定稿] 单次推进上限，防卡顿漂移
export const TRACK_JUMP_MAX = 0.18;             // [定稿] 目标切换的最大水平跳变
export const TRACK_LOST_MS = 1000;              // [定稿]
export const HAS_PERSON_LOST_MS = 300;          // [定稿] 框与关键点都连续 300ms 未命中才判「没人」
export const MAX_INFERENCE_FAILURES = 5;        // [定稿] 连续抛错次数，达到即降级（§11）
```

### 4.2 交互与语音

```ts
export const MESSAGE_MIN_HOLD_MS = 500;         // [定稿]
export const VOICE_MIN_INTERVAL_MS = 1500;      // [定稿]
export const VOICE_RATE = 1.1;                  // [定稿]
export const VOICE_LANG = 'zh-CN';              // [定稿]
export const LONG_PRESS_MS = 800;               // [定稿]
export const HINT_AFTER_MS = 3000;              // [定稿] 非绿色多久后追加长按提示
```

### 4.3 摄像头与画面

```ts
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {   // [定稿]
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    advanced: [{ focusMode: 'continuous' } as any],           // 不支持则忽略
  },
  audio: false,
};
export const MIN_VIDEO_SHORT_EDGE = 720;        // [定稿] 低于此值在顶栏提示画质偏低
export const BRIGHTNESS_SAMPLE_SIZE = 32;       // [定稿]
export const BRIGHTNESS_SAMPLE_MS = 500;        // [定稿] 亮度变化慢，500ms 采样一次
export const BRIGHTNESS_LOW_ENTER = 40;         // [定稿]
export const BRIGHTNESS_LOW_EXIT = 50;          // [定稿]
export const ROLL_ENTER_DEG = 2.0;              // [定稿]
export const ROLL_EXIT_DEG = 1.2;               // [定稿]
export const ROLL_DISPLAY_DEG = 2.0;            // [定稿] 与 ROLL_ENTER 对齐（v1.0 误写 1°）
export const MODEL_INIT_TIMEOUT_MS = 12000;     // [定稿] v1.0 的 5s 对 pose 模型过紧
```

### 4.4 拍摄

```ts
export const COUNTDOWN_SEC = 3;                 // [定稿]
export const BURST_COUNT = 5;                   // [定稿]
export const BURST_INTERVAL_MS = 800;           // [定稿] v1.0 的 200ms 使 5 张几乎相同
export const COUNTDOWN_WATCHDOG_MS = 15000;     // [定稿] 超时中止，防卡死
export const JPEG_QUALITY = 0.92;               // [定稿]
export const MAX_DPR = 2;                       // [定稿] 限制内存
```

### 4.5 三个构图档案

```ts
// 目标框：容器归一化坐标（竖屏设计值，直接使用）
half:          { x: 0.20, y: 0.15, w: 0.60, h: 0.70 }   // [定稿]
full_ground:   { x: 0.22, y: 0.08, w: 0.56, h: 0.84 }   // [定稿]
full_noground: { x: 0.20, y: 0.05, w: 0.60, h: 0.95 }   // [待校准]
```

三个档案的 `targetCenterX` 均为 `0.50` `[定稿]`。

档案由场景推导，不单独存 `[定稿]`：

```ts
const profile: ProfileId = sceneId === 'half' ? 'half'
  : includeGround ? 'full_ground' : 'full_noground';
```

---

## 5. 采样管线

### 5.1 顺序（`[定稿]`，不得颠倒）

```
video ──► 视频坐标 ──► 容器坐标 ──► EMA 平滑 ──► SubjectMetrics ──► ruleEngine
```

v1.0 未定义顺序；必须按上面执行。平滑必须在换算之后，否则 `dx/dy` 的物理含义会被缩放比例污染。

### 5.2 采样时钟（`useSampleClock`）

规则计时**不能**用墙钟，否则检测卡住时规则会"凭空翻转"。每次检测样本到达时推进：

```ts
const dt = Math.min(now - lastSampleTs, SAMPLE_CLOCK_CAP_MS);
vt += dt;
lastSampleTs = now;
```

所有 `HYSTERESIS_MS` / `GREEN_HOLD_MS` 判定都用 `vt` 的增量，不用 `Date.now()` 差值。

### 5.3 两个检测器共存

- 检测框每 `DETECT_INTERVAL_MS` 更新，驱动 `ruleEngine`（引擎每 100ms 跑一次）。
- 检测结果只接受 `categories[0].categoryName === 'person'` 的框；efficientdet 还会输出椅子、相框等类别，一律丢弃，否则会被当成「有人」判绿。
- 关键点每 `POSE_INTERVAL_MS` 更新，只刷新 `PoseState`，不单独触发引擎。
- `hasPerson` 带 **300ms 掉帧容错**：检测框与关键点都连续 300ms 未命中才置为 `false`，单帧丢失不清零。这样引擎可以「一发现没人就立刻返回 `noPerson`」（保证绝不判绿），又不会因丢帧闪烁。
- 一次 `detectForVideo` 抛错时：该样本跳过，保留上一次平滑值；连续 5 次抛错 → 进入降级判定（§11）。

### 5.4 多人锁定（`core/tracking.ts`）

```ts
// 关键点：优先选与上一帧目标中心水平距离 < TRACK_JUMP_MAX 的那一个，
// 否则选肩宽最大的；超过 TRACK_LOST_MS 无匹配则复位。
// 检测框：选中心最接近当前目标中心的那一个（没有目标时取置信度最高）。
```

摄影师的倒影、路人都不应抢走目标。目标中心取 `shoulderMidX`；无肩时退回框中心。

---

## 6. 坐标换算（`core/coordinate.ts`）

### 6.1 公式

视频归一化 → 容器归一化，`object-fit: cover`：

```ts
export function videoBoxToContainer(box: Box, vw: number, vh: number, cw: number, ch: number): Box {
  const scale = Math.max(cw / vw, ch / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const offsetX = (cw - dw) / 2;      // 负值
  const offsetY = (ch - dh) / 2;
  const px = box.x * vw, py = box.y * vh, pw = box.w * vw, ph = box.h * vh;
  const cx = px * scale + offsetX;
  const cy = py * scale + offsetY;
  return { x: cx / cw, y: cy / ch, w: (pw * scale) / cw, h: (ph * scale) / ch };
}

export function videoPointToContainer(p: Point, vw: number, vh: number, cw: number, ch: number): Point {
  const scale = Math.max(cw / vw, ch / vh);
  const offsetX = (cw - vw * scale) / 2;
  const offsetY = (ch - vh * scale) / 2;
  return { x: (p.x * vw * scale + offsetX) / cw, y: (p.y * vh * scale + offsetY) / ch };
}
```

### 6.2 两组验证用例（必须写单测）

**竖屏（真机常见，v1.0 缺这一组）**

```
vw=1080, vh=1920, cw=375, ch=812
scale = max(0.3472, 0.4229) = 0.4229
dw = 456.75, dh = 812, offsetX = -40.875, offsetY = 0
box {0.4, 0.3, 0.2, 0.4}
→ {x: 0.3782, y: 0.3000, w: 0.2436, h: 0.4000}   中心 (0.5000, 0.5000)
```

**横屏（v1.0 原用例）**

```
vw=1920, vh=1080, cw=375, ch=812
scale = max(0.1953, 0.7519) = 0.7519
dw = 1443.56, dh = 812, offsetX = -534.28, offsetY = 0
box {0.4, 0.3, 0.2, 0.4}
→ {x: 0.1151, y: 0.3000, w: 0.7699, h: 0.4000}   中心 (0.5000, 0.5000)
```

**约束**：一律使用 `videoEl.videoWidth / videoHeight` 的实际值，**不得假设朝向**，不得写死 1920×1080。

### 6.3 允许的替代实现 `[TBD]`

可以把 cover 裁剪后的画面 `drawImage` 到一个检测用 canvas（如 480×1040），直接在 canvas 上推理，此时结果天然是容器坐标，`coordinate.ts` 可退化为一个缩放函数。采用此方案时须同时保留 §6.2 两组单测对"裁剪变换"的验证。

---

## 7. 度量（`core/metrics.ts`）

```ts
export function computeMetrics(
  det: Box | null,
  pose: PoseState,
  profile: ProfileConfig,
  brightness: number,
  rollDeg: number,
): SubjectMetrics {
  const hasEdges = !!det;
  const shoulderWidth = pose.hasShoulders
    ? Math.abs(pose.shoulderL!.x - pose.shoulderR!.x) : 0;
  const centerX = pose.hasShoulders
    ? (pose.shoulderL!.x + pose.shoulderR!.x) / 2
    : det ? det.x + det.w / 2 : 0.5;
  const faceOffset = pose.hasShoulders && pose.nose && shoulderWidth > 1e-6
    ? Math.abs(pose.nose.x - centerX) / shoulderWidth : 0;

  return {
    hasPerson: hasEdges || pose.hasPerson,
    hasEdges,
    hasShoulders: pose.hasShoulders,
    headTop: det ? det.y : 0,
    bottomEdge: det ? det.y + det.h : 1,
    centerX,
    shoulderWidth,
    faceOffset,
    scale: profile.scaleSource === 'shoulder' ? shoulderWidth : (det ? det.h : 0),
    brightness,
    rollDeg,
  };
}
```

派生量：

```
dx        = centerX - profile.targetCenterX
gapBottom = 1 - bottomEdge
```

**约定**

- `headTop` / `bottomEdge` 只来自检测框；框缺失时 `hasEdges=false`，所有依赖它的规则跳过。
- `scale` 的单位随 `scaleSource` 变化：`shoulder` 是「占容器宽的比例」，`bboxHeight` 是「占容器高的比例」。阈值不可跨档案复用。
- `faceOffset` 用肩宽做分母，**与远近无关**；鼻尖缺失时取 0（视为未侧身，宁可漏报不误报）。
- `rollDeg` 保留符号（右倾为正）。水平仪据此显示左歪/右歪。

---

## 8. 规则引擎（`core/ruleEngine.ts`）

### 8.1 接口

```ts
export function evaluate(
  profile: ProfileConfig,
  m: SubjectMetrics,
  st: EngineState,
  dt: number,          // 采样时钟增量（ms）
): RuleResult | null
```

`EngineState` 保存每条规则的 `{ active, enterAcc, exitAcc }` 与全局 `readyAcc`。

### 8.2 执行顺序（`[定稿]`）

```
1. 更新亮度规则 dark（无论有没有人都要更新）
2. 若 !m.hasPerson：
     a. dark 激活 → 返回 dark（红）
     b. 否则更新 noPerson，返回 noPerson（红）
     c. 永不返回 ready
3. 有人：按 priority 升序逐条更新状态
     - 若 rule.precondition 不满足 → active=false，累加器清零，跳过
     - enter 为真则 enterAcc += dt，否则清零
     - exit  为真则 exitAcc  += dt，否则清零
     - !active 且 enterAcc >= HYSTERESIS_MS → active=true，enterAcc=0
     -  active 且 exitAcc  >= HYSTERESIS_MS → active=false，exitAcc=0
4. 收集 active 规则，按 priority 升序
5. 若存在 priority 20/21 的激活规则 → 只返回它（其余照常保持评估状态，仅不返回）
6. 若存在其他激活规则 → 返回 priority 最小者，readyAcc = 0
7. 若无激活规则 → readyAcc += dt；>= GREEN_HOLD_MS 时返回合成结果 ready（绿）；
   否则返回 null（由 UI 保持上一帧颜色）
```

**与 v1.0 的差异**

- `noPerson` **不再短路**：`dark` 必须先判，否则暗光下会陷入「请人站到中间 → 人来了仍检测不到」的死循环。
- `ready` **不是规则表里的条目**，删掉 `RuleConfig` 中 priority 999 的那条，避免双重定义。
- 距离规则「只不返回、不冻结」，避免距离解除后冒出陈旧的 active 状态。

### 8.3 档案规则表

**half（半身）**

| id | priority | color | precondition | enter | exit |
| --- | --- | --- | --- | --- | --- |
| `dark` | 1 | red | — | `brightness < 40` | `brightness >= 50` |
| `noPerson` | 2 | red | — | `!hasPerson` | `hasPerson` |
| `turnToCamera` | 10 | yellow | `hasPerson && hasEdges && hasShoulders` | `faceOffset > 0.81` `[待校准]` | `faceOffset <= 0.65` `[待校准]` |
| `tooFar` | 20 | red | `hasShoulders` | `scale < 0.36` `[待校准]` | `scale >= 0.40` `[待校准]` |
| `tooClose` | 21 | red | `hasShoulders` | `scale > 0.56` `[待校准]` | `scale <= 0.52` `[待校准]` |
| `shiftRight` | 30 | red | — | `dx > 0.10` [定稿] | `dx <= 0.06` [定稿] |
| `shiftLeft` | 31 | red | — | `dx < -0.10` [定稿] | `dx >= -0.06` [定稿] |
| `headCrop` | 40 | red | `hasEdges` | `headTop < 0.04` [定稿] | `headTop >= 0.07` |
| `headGap` | 41 | yellow | `hasEdges` | `headTop > 0.22` [定稿] | `headTop <= 0.17` |
| `tilt` | 60 | yellow | — | `\|rollDeg\| > 2.0` | `\|rollDeg\| <= 1.2` |

**full_ground（全身·拍脚）** —— 尺度用框高，v1.0 阈值继续有效

| id | priority | color | precondition | enter | exit |
| --- | --- | --- | --- | --- | --- |
| `dark` | 1 | red | — | `brightness < 40` | `>= 50` |
| `noPerson` | 2 | red | — | `!hasPerson` | `hasPerson` |
| `tooFar` | 20 | red | `hasEdges` | `scale < 0.62` [定稿] | `scale >= 0.70` |
| `tooClose` | 21 | red | `hasEdges` | `scale > 0.95` [定稿] | `scale <= 0.88` |
| `shiftRight` | 30 | red | — | `dx > 0.10` | `dx <= 0.06` |
| `shiftLeft` | 31 | red | — | `dx < -0.10` | `dx >= -0.06` |
| `headCrop` | 40 | red | `hasEdges` | `headTop < 0.04` | `headTop >= 0.07` |
| `headGap` | 41 | yellow | `hasEdges` | `headTop > 0.14` [定稿] | `headTop <= 0.10` |
| `feetCrop` | 45 | red | `hasEdges` | `gapBottom < 0` [定稿] | `gapBottom >= 0.02` |
| `tilt` | 60 | yellow | — | `\|rollDeg\| > 2.0` | `\|rollDeg\| <= 1.2` |

**full_noground（全身·不拍脚）** —— 尺度用肩宽；`feetCrop` 不注册

| id | priority | color | precondition | enter | exit |
| --- | --- | --- | --- | --- | --- |
| `dark` | 1 | red | — | `brightness < 40` | `>= 50` |
| `noPerson` | 2 | red | — | `!hasPerson` | `hasPerson` |
| `turnToCamera` | 10 | yellow | `hasPerson && hasEdges && hasShoulders` | `faceOffset > 0.81` `[待校准]` | `<= 0.65` `[待校准]` |
| `tooFar` | 20 | red | `hasShoulders` | `scale < 0.23` `[待校准]` | `>= 0.25` `[待校准]` |
| `tooClose` | 21 | red | `hasShoulders` | `scale > 0.36` `[待校准]` | `<= 0.33` `[待校准]` |
| `shiftRight` | 30 | red | — | `dx > 0.10` [定稿] | `<= 0.06` |
| `shiftLeft` | 31 | red | — | `dx < -0.10` [定稿] | `>= -0.06` |
| `headCrop` | 40 | red | `hasEdges` | `headTop < 0.04` `[待校准]` | `>= 0.07` |
| `headGap` | 41 | yellow | `hasEdges` | `headTop > 0.18` `[待校准]` | `<= 0.14` |
| `tilt` | 60 | yellow | — | `\|rollDeg\| > 2.0` | `\|rollDeg\| <= 1.2` |

> **校准记录（2026-10-29，Android 单设备）**
> 设备：Xiaomi 17 / Android Chrome，工具 `tools/calibrate.html`，公式见 §14。
> 实测中位数：`half` shoulderWidth **0.45**（n=7）、`full_noground` **0.29**（n=5）；
> `faceOffset` 正对 0.17 / 0.07，侧身45° 1.15 / 1.16 → enter 0.81、exit 0.65。
> **iOS Safari 未覆盖**，上表数值仍保留 `[待校准]`，未完成双设备矩阵前不得对外发布。
> `full_noground` 的 `headCrop` / `headGap` 与 `targetBox.h = 0.95` 不在 §14 校准范围内，继续标 `[待校准]`。

### 8.4 `turnToCamera` 的作用与判据 `[待校准]`

肩宽会随人侧身而收缩，若不先纠正姿态，`tooFar` 会让人一直走近直到「太近」。因此半身与膝上档案把「正对镜头」放在距离规则之前。

**为什么不用「肩宽 / 检测框宽」（v2.0 初稿的 `turnRatio`）**：人转身时肩宽与框宽**同时**按投影收缩，两者之比近似不变——正对与侧身45°都落在同一区间，无法区分。该判据已废弃。

**改用鼻尖偏移 `faceOffset`**：

```
faceOffset = |nose.x - shoulderCenterX| / shoulderWidth
```

- 正对时鼻尖落在肩中线附近，`faceOffset` 较小；侧身时头整体偏到一侧肩外，`faceOffset` 明显变大。
- 分母是肩宽，**与距离无关**，因此同一个阈值在 1.5m 和 4m 都成立。
- `nose` 与双肩来自 PoseLandmarker 同一帧；`nose` 缺失时 `faceOffset = 0`（不报侧身）。

阈值只能由 §14 的「正对 / 侧身45°」实测中位数反推，**不得凭经验写死**。

### 8.5 UI 侧对 `null` 的处理（`[定稿]`）

```ts
if (result === null) {
  if (last.color === 'green') {          // 硬规则：绿后无结论必须回落
    last = { ...NO_PERSON_FALLBACK, color: 'red' };
  }                                      // 否则保持 last 不变
}
```

v1.0 的「保持上次颜色为红」与实现不一致，此处以本节为准。

实现：`core/ruleEngine.ts` 导出纯函数 `resolveDisplay(prev, next)`，S4 用 `setRule(prev => resolveDisplay(prev, evaluate(...)))` 驱动提示条；初始值即 `NO_PERSON_FALLBACK`（红）。

**初始态**：S4 挂载时把 `last` 初始化为 `noPerson`（红），因此加载完成前也不会出现空白提示，更不会出现绿。

---

## 9. 屏幕实现要点

### 9.1 S4 图层（自下而上）

```
<video>              全屏 cover，playsinline muted autoplay
<svg silhouette>     pointer-events: none
<LevelIndicator>     |roll| > ROLL_DISPLAY_DEG 且 deviceorientation 可用时显示
<GuideBar>           单行提示 + 倒计时数字
<ShutterButton>      底部居中
<TopBar>             返回 + 档案名 +（全身）「要拍脚」徽标
<LoadingOverlay>     首帧就绪前显示
<OnboardingOverlay>  首次进入
```

尺寸、圆角、颜色沿用 v1.0 §9.2/§9.3：容器 `100vw × 100dvh`、黑底、`overflow:hidden`；快门 72px 视觉圆（内圈 60px）；提示条 90vw、圆角 16px、28px 粗体；红 `#FF3B30` / 黄 `#FFCC00` / 绿 `#34C759`。

### 9.2 轮廓

- `half`：沿用 v1.0 的头圆 + 肩胸弧。
- `full`：头 + 躯干线 + 双腿 + 双臂。
- `full_crop`（新增）：与 `full` 相同，但**双腿在框底保持开口、不画脚**，腿线终点落在框底边。
- 轮廓 SVG 的 `left/top/width/height` 由 `targetBox` 乘容器尺寸得到。`viewBox` 的纵向高度按目标框的实际像素纵横比换算：`viewBox="0 0 100 H"`，其中 `H = 100 × boxH·ch / boxW·cw`，再配合 `preserveAspectRatio="none"`——两个方向的缩放比因此相同，头部圆不会被拉成椭圆，轮廓又正好铺满目标框。
  写死 `0 0 100 100` 会让头变成长椭圆（`none`）或让轮廓上下出现大量留白（默认 `meet`），二者都不可接受。

### 9.3 快门与长按（修复 v1.0 的事件冲突）

```
外层热区 88×88，pointer-events: auto，touch-action: none
内层视觉圆 72，pointer-events: none
```

```ts
onPointerDown: 记录 t0；若当前非绿色，启动 800ms 进度环
onPointerUp:
  if (elapsed >= LONG_PRESS_MS && !isGreen) { forceCapture(); suppressClick = true; }
  else if (isGreen) { /* 交给 click */ }
onClick:
  if (suppressClick) { suppressClick = false; return; }
  if (isGreen) startCapture();
```

- 长按**只在非绿色时生效**，避免绿色时点击 + 长按双触发两组拍摄。
- 长按必须有进度反馈（外圈 `stroke-dashoffset` 动画），否则摄影师不知道自己在触发什么。
- 非绿色持续 `HINT_AFTER_MS` 后，GuideBar 追加「长按也可拍摄」。

### 9.4 倒计时与连拍

```ts
async function capture() {
  setPhase('countdown'); pauseRuleVoice(); disableBack();
  for (const [i, t] of ['三','二','一'].entries()) {
    setCountdown(3 - i); speak(t, { bypassThrottle: true });
    await sleep(1000);
  }
  setPhase('burst'); const blobs: Blob[] = [];
  for (let i = 0; i < BURST_COUNT; i++) {
    const b = await grabFrame(); if (b) blobs.push(b);
    if (i < BURST_COUNT - 1) await sleep(BURST_INTERVAL_MS);
  }
  dispatch({ type: 'SET_PHOTOS', photos: blobs });
  toScreen('S5');
}
```

- 倒计时期间：GuideBar 显示数字，轮廓与当前颜色冻结，快门禁用，返回禁用，启动 `COUNTDOWN_WATCHDOG_MS` 看门狗。
- 连拍期间：显示「保持不动，正在拍 5 张」。
- 语音：倒计时走独立通道，**不受 `VOICE_MIN_INTERVAL_MS` 限制**，且不 `cancel()` 前一数字。

### 9.5 `grabFrame`（所见即所得）

沿用 v1.0 的 cover 裁剪 + canvas 绘制，但：

- `dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)`。
- `toBlob` 返回 `null` 或 `ctx` 为 `null` 时返回 `null`，由上层统计失败张数。
- 5 张全部失败 → `SET_PHOTOS: []`，S5 进入空态。

### 9.6 S5 保存（`core/save.ts`）

```ts
// S5 提供两个独立动作，两个按钮各调一个
function downloadPhoto(blob, objectUrl): SaveOutcome
  a[download] = `photo-${Date.now()}.jpg`; a.href = objectUrl; a.click()
  → 'downloaded' | 'failed'

async function sharePhoto(blob, objectUrl): Promise<SaveOutcome>
  if (!navigator.canShare?.({ files: [file] })) return downloadPhoto(blob, objectUrl)
  try  { await navigator.share({ files: [file] }) → 'handedToSystem' } // 无法确认用户是否真的点了「存储图像」
  catch (e) { → e.name === 'AbortError' ? 'cancelled' : 'failed' }
```

- **必须传 `File`（带 name/type），不能传裸 `Blob`**，否则 iOS 上 `share` 直接抛 `TypeError`。
- 四种结果各有文案，见 PRD §5.6；**不得显示「已保存」**。
- `objectURL` 只在 S5 卸载时 `revoke`；保存过程中不 revoke。
- 两个保存按钮互相独立，成功后**不置灰**（允许「先下载再分享」），仅在请求进行中禁用防重复。
- **预览图 `objectURL` 必须在 `useEffect` 内创建**：StrictMode 的「建 → 清 → 再建」会让 `useMemo` 里的 URL 被 revoke，手机端表现为大图白屏。

### 9.7 首次引导

- 条件：`!hasSeenOnboarding` 且 S4 首帧就绪。
- 点击「知道了」→ `SET_ONBOARDING_SEEN` + `localStorage['shot-guide:onboarding:v1'] = '1'`。
- key 带版本后缀，便于后续重放引导。

---

## 10. 语音（`useSpeech`）

### 10.1 iOS 解锁（必须）

iOS Safari 首次 `speak()` 需要用户手势，否则全程无声。**空串/空格预热通常无效**。

做法：在 **S3 的「开始取景」点击回调里**同步调用一次真实短句：

```ts
speak('准备开始', { rate: 1.0, bypassThrottle: true });
```

这句同时承担"交接完成"的语义，不是纯技术补丁。

同一个点击回调里还要调用 `requestOrientationPermission()`（iOS 的 `DeviceOrientationEvent.requestPermission` 同样只能由手势触发；失败不阻塞，SPEC §11 第 8 条）。实现：`hooks/useSpeech.ts` 为模块级单例（`speak` / `cancelSpeech` / `pauseRuleVoice` / `resumeRuleVoice`），S3 与 S4 共享同一节流窗口。

### 10.2 音色与环境

- `speechSynthesis.getVoices()` 首次可能为空 → 监听 `voiceschanged` 后重取。
- 无 `zh-CN` 音色、或 `speechSynthesis` 不存在 → 设 `voiceAvailable=false`，**所有关键信息仅靠文字**。
- 系统静音键可能让语音无声，产品不依赖语音（PRD §5.3）。

### 10.3 节流

```ts
speak(text, { bypassThrottle = false }) {
  if (!voiceAvailable) return;
  if (bypassThrottle) { cancel(); utter(text); return; }        // 倒计时通道
  if (now - lastVoiceTs < VOICE_MIN_INTERVAL_MS) return;         // 规则通道
  cancel(); utter(text); lastVoiceTs = now;
}
```

- 规则播报在倒计时开始与 S4 卸载时都必须 `cancel()`。
- 数字用中文（`三/二/一`），避免不同 TTS 引擎把阿拉伯数字读成英文。

---

## 11. 降级与错误（`[定稿]`）

进入 S4 时按顺序判定：

| 步骤 | 条件 | 结果 |
| --- | --- | --- |
| 1 | `!window.isSecureContext` | SFallback（`insecure`），**不调用摄像头** |
| 2 | `!navigator.mediaDevices?.getUserMedia` | SFallback（`notFound`） |
| 3 | `getUserMedia` 抛 `NotAllowedError` | SFallback（`permission`） |
| 4 | `getUserMedia` 抛 `NotFoundError` / `OverconstrainedError` | SFallback（`notFound`） |
| 5 | 模型初始化 > `MODEL_INIT_TIMEOUT_MS` 或抛错 | 相机正常 → **SManual**；相机也失败 → SFallback |
| 6 | Pose 不可用但检测框可用 | `half` / `full_noground` → SManual（缺尺度）；`full_ground` → 继续运行 |
| 7 | 运行中模型崩溃（连续 5 次推理抛错） | SManual，已拍照片不丢 |
| 8 | Wake Lock 失败 / 语音不可用 / 方向传感器不可用 | 忽略，不阻塞、不跳页 |

**手动模式（SManual）**：视频 + 轮廓 + 三句静态指引（取自 `profile.briefing`）+ 常驻横幅；快门始终可用；提供「重试识别」「返回首页」。

---

## 12. 性能预算

| 指标 | 目标 |
| --- | --- |
| 检测框推理 | ≤ 100ms / 次（10fps） |
| 关键点推理 | ≤ 200ms / 次（5fps） |
| 端到端「对齐完成 → 变绿」 | ≤ 1.2s（滞回 0.3s + 保持 0.4s + 平滑延迟） |
| 内存 | 5 张照片 + 2 模型；S5 卸载时释放 objectURL |

**自动降载**

```
单次样本总耗时 > 150ms → 检测框 200ms、关键点 400ms
仍 > 300ms           → 进入 SManual
```

降载只改采样间隔，**不改任何阈值**（阈值已全部改为毫秒语义，见 §5.2）。

---

## 13. 验收标准

1. [ ] S1 选「半身」→ **直接进 S3**（不出现 S2）；S1 选「全身」→ S2 只出现「是否拍脚」一题，默认「要拍脚」。
2. [ ] S3 点「开始取景」时能听到「准备开始」，且 S4 后续语音有效（iOS 真机）。
3. [ ] S4 进入时先出现「正在启动相机与识别…」，首帧就绪后消失。
4. [ ] 首次进入 S4 显示引导层，点「知道了」后刷新仍不再出现。
5. [ ] 半身档案：人只入镜一半时，**不会**因为「框贴底边」而常亮「太近」；距离提示随人真实远近变化。
6. [ ] 半身档案：人侧身时出现「请让人正对镜头站好」，正对后消失并恢复距离判定。
7. [ ] 全身「要拍脚」：脚出画时出现「脚被切掉了」，顶栏显示「要拍脚」徽标。
8. [ ] 全身「不要拍脚」：脚出画**不**报错，且构图目标比「要拍脚」更近（人更大）。
9. [ ] **画面里没有人时，任何情况下快门都不可点**（连续观察 30 秒，无一次变绿）。
10. [ ] 人偏左/偏右时提示方向与镜头实际移动方向一致（移动后偏差减小）。
11. [ ] 全条件满足后 0.4s 变绿，快门脉冲可点；点击后倒计时「三/二/一」有声，连拍 5 张，间隔约 0.8s，进 S5。
12. [ ] 非绿色时长按快门 0.8s 能强制拍摄，且只拍一组（不重复触发）。
13. [ ] S5 默认选中第 1 张；保存走 `canShare` → `share(File)`；取消时不显示「已保存」。
14. [ ] 断网冷启动仍能完成全流程（模型来自本地 `public/`）。
15. [ ] 用 `http://` 局域网地址打开时，直接进入 SFallback 并显示非安全连接文案。
16. [ ] 离开 S4 后摄像头指示灯熄灭；S5 卸载后无残留 `objectURL`。
17. [ ] `videoBoxToContainer` / `videoPointToContainer` 单测覆盖 §6.2 两组用例（竖屏 + 横屏）。
18. [ ] 桌面 Chrome（无 `deviceorientation`）不报错，`tilt` 规则不触发。

---

## 14. 校准流程（`[待校准]` 项必须执行）

半身与膝上的尺度、以及 `faceOffset` 的侧身阈值无法靠推算定稿，必须真机校准：

1. **设备矩阵**：iOS Safari 16+ 一台、Android Chrome 110+ 一台（覆盖不同摄像头 FOV）。
2. **体型 × 距离**：成人（170±10cm）、较矮（155±5cm）、儿童（120±10cm）；距离 1.5m / 2.5m / 4m。
3. **采集**：让 3 组对象在「构图看起来正确」的位置站好，
   - 记录「正对镜头」时的 `shoulderWidth` 中位数（作为该体型的 `target`）；
   - 分别记录「正对」与「侧身45°」时的 `faceOffset` 中位数（后者记为 `S`）。
4. **定标**：按下面公式生成阈值，四舍五入到 0.01：

```
tooFar.enter   = 0.80 × target
tooFar.exit    = 0.88 × target
tooClose.enter = 1.25 × target
tooClose.exit  = 1.15 × target

faceOffset.enter = 0.70 × S      // 明显侧身才提示
faceOffset.exit  = 0.56 × S      // 回正后才解除（= enter × 0.8）
```

5. 校准结果回写 §8.3 并去掉 `[待校准]` 标记；未校准前不得对外发布。

> 校准工具：`tools/calibrate.html`（+ `node tools/serve.mjs`）。它按本节口径实时输出 `shoulderWidth` / `faceOffset` / `headTop` / `gapBottom`，并直接给出建议阈值。该工具**不进产品包**。

---

## 15. 实施顺序

| 阶段 | 内容 | 完成标志 |
| --- | --- | --- |
| 0 | 模型/WASM 自托管、HTTPS 部署、`copy.ts` | 断网可加载两个模型 |
| 1 | `types` / `constants` / `profiles` / `coordinate`（含单测）/ `metrics` | 纯逻辑跑通，单测全绿 |
| 2 | `App` 状态机 + S1 / S2 / S3 | 半身跳过 S2，全身显示 S2 |
| 3 | `useCamera` + S4 视频与顶栏 + `LoadingOverlay` | 真机视频正常 |
| 4 | `Silhouette`（3 种轮廓）+ `GuideBar` + 三态颜色（假数据） | 视觉可评审 |
| 5 | `useDetectors`（两个模型）+ `core/smoothing` + `core/tracking` + `metrics` 接真数据 | 提示随人动 |
| 6 | `ruleEngine`（含 `null` 处理与硬规则） | 空画面绝不绿 |
| 7 | `useSpeech`（解锁 / 节流 / 倒计时通道）+ `useOrientation`（含 iOS 授权）+ 亮度 | 语音与水平仪可用 |
| 8 | 快门热区 / 长按 / 倒计时 / 连拍 / `grabFrame` | 能拿到 5 张 |
| 9 | S5 选片 + 保存三态 + 空态 | 保存路径可验证 |
| 10 | SFallback + SManual + Wake Lock | 三条降级路径可走 |
| 11 | §14 校准 + §13 验收逐条过 | 全部打勾 |

---

## 16. 明确禁止

1. 不得修改标 `[定稿]` 的数值与 PRD §5.6 的文案。
2. 不得在 `hasPerson=false` 时返回绿，或让快门可点。
3. 不得用墙钟驱动规则计时（必须用 §5.2 的采样时钟）。
4. 不得用 `setInterval` 驱动检测循环（用 `requestAnimationFrame` + 时间戳节流）。
5. 不得直接比较视频坐标与目标框坐标（必须走 §6）。
6. 不得在 S4 卸载时不停止摄像头轨道或不断开 `rAF`。
7. 不得从 CDN 加载模型或 WASM。
8. 不得使用 `alert` / `confirm` / `prompt`。
9. 不得在未标 `[TBD]` 的情况下自行新增用户可见的按钮、设置项或动画。
10. 遇到规格冲突：产品行为以 PRD 为准，数值与结构以本文件为准；仍未覆盖则取最小实现并追加到 `OPEN_ISSUES`。