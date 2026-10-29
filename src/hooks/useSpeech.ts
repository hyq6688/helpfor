// 语音。对应 SPEC §10：iOS 解锁（由 S3 点击触发）、1.5s 节流、倒计时独立通道。
//
// 语音是「增强」，不可用时全部靠文字（PRD §5.3）。这里用模块级单例：
// S3 与 S4 共享同一个节流窗口，避免跨屏重复播报。

import { VOICE_LANG, VOICE_MIN_INTERVAL_MS, VOICE_RATE } from '../constants';

export interface SpeakOptions {
  /** 倒计时通道：绕过节流与「暂停规则播报」，且不更新节流时间戳。 */
  bypassThrottle?: boolean;
}

let initialized = false;
let available = false;
let muted = false;
let lastVoiceTs = Number.NEGATIVE_INFINITY;

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis;
}

function ensureReady(s: SpeechSynthesis): void {
  if (initialized) return;
  initialized = true;
  const pick = () => {
    // 任何中文音色都可用；只有英文音色时读中文会变成噪音，故视为不可用
    available = s.getVoices().some((v) => /^zh/i.test(v.lang.replace('_', '-')));
  };
  pick();
  s.addEventListener('voiceschanged', pick);
}

/** 朗读一句话。规则通道受 1.5s 节流与暂停开关限制；倒计时通道不受限。 */
export function speak(text: string, opts: SpeakOptions = {}): void {
  const s = getSynth();
  if (!s || !text) return;
  ensureReady(s);
  if (!available) return;

  const bypass = opts.bypassThrottle === true;
  if (!bypass && muted) return;
  const now = performance.now();
  if (!bypass && now - lastVoiceTs < VOICE_MIN_INTERVAL_MS) return;

  const u = new SpeechSynthesisUtterance(text);
  u.lang = VOICE_LANG;
  u.rate = VOICE_RATE;
  s.cancel();
  s.speak(u);
  if (!bypass) lastVoiceTs = now;
}

export function cancelSpeech(): void {
  getSynth()?.cancel();
}

/** 倒计时开始 / 连拍期间暂停规则播报（数字仍走 bypass 通道）。 */
export function pauseRuleVoice(): void {
  muted = true;
  cancelSpeech();
}

export function resumeRuleVoice(): void {
  muted = false;
}
