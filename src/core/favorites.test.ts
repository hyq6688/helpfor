// 收藏纯逻辑单元测试：坏数据容错、去重、切换顺序。

import { describe, expect, it } from 'vitest';
import { parseFavorites, toggleFavoriteId } from './favorites';

describe('parseFavorites', () => {
  it('空值与坏 JSON 返回空数组', () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites('')).toEqual([]);
    expect(parseFavorites('not-json')).toEqual([]);
    expect(parseFavorites('{"a":1}')).toEqual([]);
  });

  it('过滤非字符串与重复项，保留顺序', () => {
    expect(parseFavorites('["half", "half", 3, "", "full_ground", "  half  "]')).toEqual([
      'half',
      'full_ground',
    ]);
  });

  it('正常数组原样返回', () => {
    expect(parseFavorites('["a","b"]')).toEqual(['a', 'b']);
  });
});

describe('toggleFavoriteId', () => {
  it('新收藏放在最前', () => {
    expect(toggleFavoriteId(['a'], 'b')).toEqual(['b', 'a']);
  });

  it('再次点击取消收藏', () => {
    expect(toggleFavoriteId(['b', 'a'], 'b')).toEqual(['a']);
  });

  it('空 id 不改变列表', () => {
    const ids = ['a'];
    expect(toggleFavoriteId(ids, '')).toBe(ids);
  });
});
