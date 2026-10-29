// 用户可见文案的唯一来源。逐字来自 PRD §5.6，改动必须先改 PRD。

export interface CopyLine {
  text: string;
  voice: string;
}

/** 规则提示语。key 即 RuleConfig.copyId。 */
export const RULE_COPY = {
  dark: { text: '太暗了，换个亮一点的地方', voice: '这里太暗，换个地方' },
  noPerson: { text: '请被拍的人站到画面中间', voice: '请被拍的人站到中间' },
  turnToCamera: { text: '请让人正对镜头站好', voice: '请正对镜头' },
  'tooFar.twoSteps': { text: '人太小了，往前走两步', voice: '往前走两步' },
  'tooFar.slight': { text: '人太小了，往前走一点', voice: '往前走一点' },
  'tooClose.stepBack': { text: '太近了，往后退一步', voice: '往后退一步' },
  'tooClose.slight': { text: '人放不下了，往后退一点', voice: '往后退一点' },
  shiftRight: { text: '人偏右了，镜头往右一点', voice: '镜头往右' },
  shiftLeft: { text: '人偏左了，镜头往左一点', voice: '镜头往左' },
  headCrop: { text: '头快顶到边了，镜头往上抬', voice: '镜头往上抬' },
  headGap: { text: '头顶空太多，镜头往下压', voice: '镜头往下压' },
  feetCrop: { text: '脚被切掉了，往后退一步', voice: '脚被切了，往后退' },
  tilt: { text: '手机端平，别歪', voice: '手机端平' },
  ready: { text: '可以拍了！按快门', voice: '可以拍了' },
} satisfies Record<string, CopyLine>;

/** 界面固定文案。 */
export const UI_COPY = {
  loadingOverlay: '正在启动相机与识别…',
  burst: '保持不动，正在拍 5 张',
  longPressHint: '长按也可拍摄',
  onboarding: '把人和虚线重合，变绿后按快门',
  onboardingConfirm: '知道了',
  saveHanded: '已交给系统，请确认是否保存',
  saveCancelled: '已取消保存',
  saveFailed: '保存失败，请点开大图后长按存储',
  saveDownloaded: '已开始下载',
  emptyPhotos: '拍摄失败，请重拍',
  manualBanner: '自动提示已关闭，请按轮廓构图后直接拍摄',
} as const;

/** 倒计时显示数字与语音读法（语音必须是中文数字）。 */
export const COUNTDOWN_COPY = [
  { digit: '3', voice: '三' },
  { digit: '2', voice: '二' },
  { digit: '1', voice: '一' },
] as const;

/** 相机不可用原因文案。 */
export const FALLBACK_REASON = {
  permission: '请在浏览器设置中允许访问摄像头，然后刷新页面。',
  notFound: '未找到可用摄像头。',
  insecure: '当前不是安全连接（HTTPS），浏览器不会允许使用摄像头。',
} as const;

/** 各屏标题与按钮。 */
export const SCREEN_COPY = {
  s1Title: '你想拍什么？',
  s1Half: '半身照',
  s1Full: '全身照',
  s2Title: '你的全身照要不要拍到脚？',
  s2GroundYes: '要拍脚',
  s2GroundNo: '不要拍脚',
  s2Hint: '要拍脚 = 连地面一起拍；不要拍脚 = 拍到小腿，脚不入镜',
  next: '下一步',
  s3Title: '请把手机交给帮你拍照的人',
  s3Subtitle: '接下来的提示是给他看的',
  s3Start: '开始取景',
  s3Voice: '准备开始', // 同时承担 iOS 语音解锁
  s3Privacy: '照片只保存在这台手机上',
  s3Dnd: '交接前建议开启勿扰模式',
  s4BadgeGround: '要拍脚',
  sFallbackTitle: '无法启动相机',
  back: '返回',
  s5Title: '选一张你喜欢的',
  s5Download: '下载到相册',
  s5Share: '系统分享',
  s5Retake: '重拍',
  s5Done: '完成',
  retry: '重试',
  retryDetect: '重试识别',
  backHome: '返回首页',
} as const;
