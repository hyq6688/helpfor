// 收藏的本地存储与纯逻辑。未登录 / 云端表不可用时都以 localStorage 为准，
// 保证收藏功能在任何情况下都能用且不会抛错。

export const FAVORITES_STORAGE_KEY = 'shot-guide:favorites:v1';

/** 宽松解析：非数组、非字符串、重复项都会被忽略；坏数据回退空数组。 */
export function parseFavorites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const item of parsed) {
      if (typeof item !== 'string') continue;
      const id = item.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  } catch {
    return [];
  }
}

/** 切换收藏：新收藏放到最前，取消收藏直接移除；空 id 原样返回。 */
export function toggleFavoriteId(ids: string[], id: string): string[] {
  if (!id) return ids;
  return ids.includes(id) ? ids.filter((item) => item !== id) : [id, ...ids];
}

export function readLocalFavorites(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    return parseFavorites(localStorage.getItem(FAVORITES_STORAGE_KEY));
  } catch {
    return [];
  }
}

/** 隐私模式 / 配额不足时静默失败，只失去本机持久化。 */
export function writeLocalFavorites(ids: string[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // 忽略
  }
}
