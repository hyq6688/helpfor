// 常量。对应 SPEC §4.1–§4.4，`[定稿]` 数值不得改动。

// ---------- 4.1 采样与判定 ----------
export const DETECT_INTERVAL_MS = 100; // [定稿] 10fps
export const POSE_INTERVAL_MS = 200; // [定稿] 5fps
export const DETECT_CONFIDENCE_MIN = 0.4; // [定稿]
export const POSE_MIN_PRESENCE = 0.5; // [定稿] 肩点 presence 门槛
export const EMA_ALPHA = 0.3; // [定稿]
export const HYSTERESIS_MS = 300; // [定稿]
export const GREEN_HOLD_MS = 400; // [定稿]
export const SAMPLE_CLOCK_CAP_MS = 200; // [定稿] 单次推进上限，防卡顿漂移
export const TRACK_JUMP_MAX = 0.18; // [定稿] 目标切换的最大水平跳变
export const TRACK_LOST_MS = 1000; // [定稿]
export const HAS_PERSON_LOST_MS = 300; // [定稿] 检测框与关键点都连续 300ms 未命中才判「没人」
export const MAX_INFERENCE_FAILURES = 5; // [定稿] 连续抛错次数，达到即降级

// ---------- 4.2 交互与语音 ----------
export const MESSAGE_MIN_HOLD_MS = 500; // [定稿]
export const VOICE_MIN_INTERVAL_MS = 1500; // [定稿]
export const VOICE_RATE = 1.1; // [定稿]
export const VOICE_LANG = 'zh-CN'; // [定稿]
export const LONG_PRESS_MS = 800; // [定稿]
export const HINT_AFTER_MS = 3000; // [定稿] 非绿色多久后追加长按提示

// ---------- 4.3 摄像头与画面 ----------
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  // [定稿]
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    // focusMode 不在标准 TS 类型里，不支持则忽略
    advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
  },
  audio: false,
};
export const MIN_VIDEO_SHORT_EDGE = 720; // [定稿] 低于此值在顶栏提示画质偏低
export const BRIGHTNESS_SAMPLE_SIZE = 32; // [定稿]
export const BRIGHTNESS_SAMPLE_MS = 500; // [定稿] 亮度变化慢，500ms 采样一次即可
export const BRIGHTNESS_LOW_ENTER = 40; // [定稿]
export const BRIGHTNESS_LOW_EXIT = 50; // [定稿]
export const ROLL_ENTER_DEG = 2.0; // [定稿]
export const ROLL_EXIT_DEG = 1.2; // [定稿]
export const ROLL_DISPLAY_DEG = 2.0; // [定稿] 与 ROLL_ENTER_DEG 对齐
export const MODEL_INIT_TIMEOUT_MS = 12000; // [定稿]

// ---------- 4.4 拍摄 ----------
export const COUNTDOWN_SEC = 3; // [定稿]
export const BURST_COUNT = 5; // [定稿]
export const BURST_INTERVAL_MS = 800; // [定稿]
export const COUNTDOWN_WATCHDOG_MS = 15000; // [定稿] 超时中止，防卡死
export const JPEG_QUALITY = 0.92; // [定稿]
export const MAX_DPR = 2; // [定稿] 限制内存
