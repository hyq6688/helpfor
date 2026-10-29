import { afterEach, describe, expect, it, vi } from 'vitest';

interface Stub {
  spoken: string[];
  cancel: ReturnType<typeof vi.fn>;
}

function stubSpeech(voices: { lang: string }[]): Stub {
  const spoken: string[] = [];
  const cancel = vi.fn();
  const synth = {
    cancel,
    speak: (u: { text: string }) => spoken.push(u.text),
    getVoices: () => voices,
    addEventListener: vi.fn(),
  };
  class Utterance {
    text: string;
    lang = '';
    rate = 1;
    constructor(text: string) {
      this.text = text;
    }
  }
  (globalThis as unknown as { window: unknown }).window = { speechSynthesis: synth };
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
    Utterance;
  return { spoken, cancel };
}

async function loadModule() {
  vi.resetModules();
  return import('./useSpeech');
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as unknown as { window?: unknown }).window;
  delete (globalThis as unknown as { SpeechSynthesisUtterance?: unknown })
    .SpeechSynthesisUtterance;
});

describe('speak', () => {
  it('没有中文音色时不播', async () => {
    const { spoken } = stubSpeech([{ lang: 'en-US' }]);
    const m = await loadModule();
    m.speak('准备开始', { bypassThrottle: true });
    expect(spoken).toEqual([]);
  });

  it('解锁短句走 bypass 通道且先取消前一句', async () => {
    const { spoken, cancel } = stubSpeech([{ lang: 'zh-CN' }]);
    const m = await loadModule();
    m.speak('准备开始', { bypassThrottle: true });
    expect(spoken).toEqual(['准备开始']);
    expect(cancel).toHaveBeenCalled();
  });

  it('规则语音受 1.5s 节流', async () => {
    const { spoken } = stubSpeech([{ lang: 'zh-CN' }]);
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const m = await loadModule();
    m.speak('往前走两步');
    clock = 500;
    m.speak('往前走一点');
    clock = 1600;
    m.speak('可以拍了');
    expect(spoken).toEqual(['往前走两步', '可以拍了']);
  });

  it('暂停后规则语音静默，但倒计时数字仍播，恢复后正常', async () => {
    const { spoken } = stubSpeech([{ lang: 'zh-CN' }]);
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const m = await loadModule();
    m.pauseRuleVoice();
    m.speak('手机端平');
    m.speak('三', { bypassThrottle: true });
    expect(spoken).toEqual(['三']);
    m.resumeRuleVoice();
    clock = 5000;
    m.speak('可以拍了');
    expect(spoken).toEqual(['三', '可以拍了']);
  });
});
