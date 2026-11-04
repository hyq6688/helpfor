// 分享链接与主题解析的纯函数测试。

import { describe, expect, it } from 'vitest';
import { buildTemplateShareUrl } from './share';
import { parseTheme, systemTheme } from './theme';

describe('buildTemplateShareUrl', () => {
  it('始终指向模板详情深链', () => {
    expect(buildTemplateShareUrl('https://a.com', '/', '', 'half')).toBe(
      'https://a.com/#/templates/half',
    );
  });

  it('保留部署子路径与查询串，id 做 URL 编码', () => {
    expect(buildTemplateShareUrl('https://a.com', '/app/', '?v=2', 'a b')).toBe(
      'https://a.com/app/?v=2#/templates/a%20b',
    );
  });

  it('中文 id 可安全编码', () => {
    expect(buildTemplateShareUrl('https://a.com', '/', '', '中文')).toBe(
      'https://a.com/#/templates/%E4%B8%AD%E6%96%87',
    );
  });
});

describe('parseTheme', () => {
  it('只接受 light / dark', () => {
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('blue')).toBeNull();
    expect(parseTheme(null)).toBeNull();
  });

  it('无 matchMedia 环境默认浅色', () => {
    expect(systemTheme()).toBe('light');
  });
});
