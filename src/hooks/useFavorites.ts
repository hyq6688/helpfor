// 收藏 hook：本地 localStorage 为准，登录且云端表可用时同步到 Supabase。
// 表未创建 / RLS 拒绝 / 网络失败都只降级为「仅本机」，不阻塞任何界面操作。

import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { readLocalFavorites, toggleFavoriteId, writeLocalFavorites } from '../core/favorites';
import { useAuth } from '../context/AuthContext';

export interface FavoritesApi {
  ids: string[];
  isFavorite: (templateId: string) => boolean;
  toggle: (templateId: string) => void;
  /** 登录后云端可用；false 表示当前只用本机存储。 */
  cloudAvailable: boolean;
  syncing: boolean;
}

export function useFavorites(): FavoritesApi {
  const { user } = useAuth();
  const [ids, setIds] = useState<string[]>(() => readLocalFavorites());
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const idsRef = useRef(ids);

  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);

  // 登录后拉取云端收藏，并把本机新增的收藏补传；任一步失败都退回本机模式。
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) {
      setCloudAvailable(false);
      setSyncing(false);
      return;
    }

    let cancelled = false;
    setSyncing(true);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('template_favorites')
          .select('template_id');
        if (error) throw error;
        if (cancelled) return;

        const remote = ((data ?? []) as Array<{ template_id?: string }>)
          .map((row) => row.template_id)
          .filter((id): id is string => Boolean(id));
        const local = readLocalFavorites();
        const localOnly = local.filter((id) => !remote.includes(id));
        const merged = [...remote.filter((id) => !local.includes(id)), ...local];

        idsRef.current = merged;
        setIds(merged);
        writeLocalFavorites(merged);
        setCloudAvailable(true);

        if (localOnly.length) {
          const rows = localOnly.map((id) => ({ user_id: user.id, template_id: id }));
          const { error: upErr } = await supabase
            .from('template_favorites')
            .upsert(rows, { onConflict: 'user_id,template_id', ignoreDuplicates: true });
          if (upErr) throw upErr;
        }
      } catch {
        if (!cancelled) setCloudAvailable(false);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggle = useCallback(
    (templateId: string) => {
      const previous = idsRef.current;
      const next = toggleFavoriteId(previous, templateId);
      const nowFavorited = !previous.includes(templateId);

      idsRef.current = next;
      setIds(next);
      writeLocalFavorites(next);

      if (!user || !cloudAvailable) return;

      const request = nowFavorited
        ? supabase
            .from('template_favorites')
            .upsert(
              { user_id: user.id, template_id: templateId },
              { onConflict: 'user_id,template_id', ignoreDuplicates: true },
            )
        : supabase
            .from('template_favorites')
            .delete()
            .eq('user_id', user.id)
            .eq('template_id', templateId);

      void Promise.resolve(request)
        .then(({ error }) => {
          if (error) setCloudAvailable(false);
        })
        .catch(() => setCloudAvailable(false));
    },
    [user, cloudAvailable],
  );

  const isFavorite = useCallback((templateId: string) => ids.includes(templateId), [ids]);

  return { ids, isFavorite, toggle, cloudAvailable, syncing };
}
