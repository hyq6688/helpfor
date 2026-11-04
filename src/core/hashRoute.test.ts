// 轻量 hash 路由纯函数的单元测试。

import { describe, expect, it } from 'vitest';
import { hashFor, hashForScreen, parseHash, screenForRoute } from './hashRoute';

describe('parseHash', () => {
  it('空 hash 与 #/ 都回首页', () => {
    expect(parseHash('')).toEqual({ name: 'home', templateId: null });
    expect(parseHash('#')).toEqual({ name: 'home', templateId: null });
    expect(parseHash('#/')).toEqual({ name: 'home', templateId: null });
  });

  it('解析浏览层页面', () => {
    expect(parseHash('#/templates').name).toBe('templates');
    expect(parseHash('#/account').name).toBe('account');
    expect(parseHash('#/admin').name).toBe('admin');
    expect(parseHash('#/favorites').name).toBe('favorites');
  });

  it('模板深链解析 id 并解码', () => {
    expect(parseHash('#/templates/half')).toEqual({ name: 'templates', templateId: 'half' });
    expect(parseHash('#/templates/morning%20walk')).toEqual({
      name: 'templates',
      templateId: 'morning walk',
    });
    expect(parseHash('#/templates/中文模板').templateId).toBe('中文模板');
  });

  it('忽略查询串与尾斜杠', () => {
    expect(parseHash('#/templates/?from=share').name).toBe('templates');
    expect(parseHash('#/account/').name).toBe('account');
  });

  it('未知路径安全回首页', () => {
    expect(parseHash('#/camera').name).toBe('home');
    expect(parseHash('#/templates/a/b').templateId).toBe('a');
  });
});

describe('hashFor / hashForScreen', () => {
  it('生成浏览层 hash', () => {
    expect(hashFor('home')).toBe('#/');
    expect(hashFor('templates')).toBe('#/templates');
    expect(hashFor('templates', 'half')).toBe('#/templates/half');
    expect(hashFor('templates', 'a b')).toBe('#/templates/a%20b');
    expect(hashFor('account')).toBe('#/account');
    expect(hashFor('admin')).toBe('#/admin');
    expect(hashFor('favorites')).toBe('#/favorites');
  });

  it('相机屏幕不写 URL', () => {
    expect(hashForScreen('S3')).toBeNull();
    expect(hashForScreen('S4')).toBeNull();
    expect(hashForScreen('S5')).toBeNull();
    expect(hashForScreen('SManual')).toBeNull();
    expect(hashForScreen('SFallback')).toBeNull();
  });

  it('浏览屏幕映射到对应 hash 与屏幕 id', () => {
    expect(hashForScreen('AllTemplates')).toBe('#/templates');
    expect(hashForScreen('AllTemplates', 'half')).toBe('#/templates/half');
    expect(screenForRoute('home')).toBe('S1');
    expect(screenForRoute('templates')).toBe('AllTemplates');
    expect(screenForRoute('favorites')).toBe('Favorites');
    expect(screenForRoute('account')).toBe('Account');
    expect(screenForRoute('admin')).toBe('Admin');
  });
});
