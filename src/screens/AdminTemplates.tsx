// 模板管理页。规格 AC-10~AC-13。
// 仅 is_admin 用户可进入；可新建/编辑/下架模板，封面上传到 Supabase Storage。

import { useCallback, useEffect, useRef, useState } from 'react';
import { isAdmin, useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { SCREEN_COPY, UI_COPY } from '../copy';
import type { ProfileId, StoredTemplate, StoredTemplateConfig } from '../types';

/** 三个骨架的默认阈值，用于新建模板时回填表单。 */
const SKELETON_DEFAULTS: Record<ProfileId, StoredTemplateConfig> = {
  half: {
    base: 'half',
    label: '半身照',
    targetBox: { x: 0.2, y: 0.15, w: 0.6, h: 0.7 },
    tooFarEnter: 0.36,
    tooFarExit: 0.4,
    tooCloseEnter: 0.56,
    tooCloseExit: 0.52,
    faceOffsetEnter: 0.81,
    faceOffsetExit: 0.65,
    headCropEnter: 0.04,
    headCropExit: 0.07,
    headGapEnter: 0.22,
    headGapExit: 0.17,
    briefing: ['手机举到被拍者胸口高度', '人物头部上方留一点空，不要切到头', '人物占画面高度约 2/3'],
  },
  full_ground: {
    base: 'full_ground',
    label: '全身照',
    targetBox: { x: 0.22, y: 0.08, w: 0.56, h: 0.84 },
    tooFarEnter: 0.62,
    tooFarExit: 0.7,
    tooCloseEnter: 0.95,
    tooCloseExit: 0.88,
    faceOffsetEnter: 0,
    faceOffsetExit: 0,
    headCropEnter: 0.04,
    headCropExit: 0.07,
    headGapEnter: 0.14,
    headGapExit: 0.1,
    briefing: ['手机举到被拍者腰部高度', '退后直到脚和头顶都在画面内', '手机保持竖直，别仰拍'],
  },
  full_noground: {
    base: 'full_noground',
    label: '全身照',
    targetBox: { x: 0.2, y: 0.05, w: 0.6, h: 0.95 },
    tooFarEnter: 0.23,
    tooFarExit: 0.25,
    tooCloseEnter: 0.36,
    tooCloseExit: 0.33,
    faceOffsetEnter: 0.81,
    faceOffsetExit: 0.65,
    headCropEnter: 0.04,
    headCropExit: 0.07,
    headGapEnter: 0.18,
    headGapExit: 0.14,
    briefing: ['手机举到被拍者腰部高度', '退到能看见膝盖以上', '手机保持竖直，别仰拍'],
  },
};

interface FormState {
  id: string | null;
  name: string;
  description: string;
  coverUrl: string;
  sort: number;
  active: boolean;
  cfg: StoredTemplateConfig;
}

function emptyForm(): FormState {
  return {
    id: null,
    name: '',
    description: '',
    coverUrl: '',
    sort: 10,
    active: true,
    cfg: { ...SKELETON_DEFAULTS.half, targetBox: { ...SKELETON_DEFAULTS.half.targetBox } },
  };
}

export default function AdminTemplates({ onBack }: { onBack: () => void }) {
  const { user, loading } = useAuth();
  const [templates, setTemplates] = useState<StoredTemplate[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    setListLoading(true);
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('sort', { ascending: true });
    if (error) {
      setMsg(`加载失败：${error.message}`);
    } else {
      setTemplates((data as StoredTemplate[]) ?? []);
    }
    setListLoading(false);
  }, []);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  if (loading) {
    return (
      <div className="admin">
        <p className="small">{UI_COPY.templatesLoading}</p>
      </div>
    );
  }

  if (!isAdmin(user)) {
    return (
      <div className="admin">
        <p className="small">{UI_COPY.adminNoPermission}</p>
        <button className="btn btn--ghost" onClick={onBack} style={{ marginTop: 16 }}>
          {SCREEN_COPY.backHome}
        </button>
      </div>
    );
  }

  const startNew = () => setForm(emptyForm());

  const startEdit = (row: StoredTemplate) => {
    setForm({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      coverUrl: row.cover_url ?? '',
      sort: row.sort ?? 0,
      active: row.active ?? true,
      cfg: row.profile_config,
    });
  };

  const handleBaseChange = (base: ProfileId) => {
    if (!form) return;
    const skel = SKELETON_DEFAULTS[base];
    setForm({
      ...form,
      cfg: { ...skel, targetBox: { ...skel.targetBox }, briefing: [...skel.briefing] },
    });
  };

  const handleCoverUpload = async (file: File) => {
    setUploading(true);
    setMsg('');
    try {
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('template-covers')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('template-covers').getPublicUrl(path);
      setForm((f) => (f ? { ...f, coverUrl: data.publicUrl } : f));
    } catch (e) {
      setMsg(`封面上传失败：${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form || !user) return;
    if (!form.name.trim()) {
      setMsg('请填写名称');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        cover_url: form.coverUrl,
        sort: form.sort,
        active: form.active,
        profile_config: form.cfg,
        owner_id: user.id,
      };
      const { error } = form.id
        ? await supabase.from('templates').update(payload).eq('id', form.id)
        : await supabase.from('templates').insert(payload);
      if (error) throw error;
      setMsg(form.id ? '已更新' : '已创建');
      setForm(null);
      fetchAll();
    } catch (e) {
      setMsg(`保存失败：${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async (row: StoredTemplate) => {
    const { error } = await supabase.from('templates').update({ active: false }).eq('id', row.id);
    if (error) {
      setMsg(`下架失败：${error.message}`);
    } else {
      setMsg('已下架');
      fetchAll();
    }
  };

  const cfg = form?.cfg;

  return (
    <div className="admin">
      <div className="admin__row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{UI_COPY.adminTitle}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--primary" onClick={startNew}>
            {UI_COPY.adminNew}
          </button>
          <button className="btn btn--ghost" onClick={onBack}>
            {SCREEN_COPY.back}
          </button>
        </div>
      </div>

      {msg && <p className="small" style={{ color: 'var(--accent)' }}>{msg}</p>}

      {listLoading ? (
        <p className="small">{UI_COPY.templatesLoading}</p>
      ) : (
        <div>
          {templates.map((row) => (
            <div key={row.id} className="admin__row">
              <div>
                <div className="admin__row-name">
                  {row.name} {row.active ? '' : '（已下架）'}
                </div>
                <div className="admin__row-sub">
                  sort={row.sort} · {row.profile_config.base}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--ghost" onClick={() => startEdit(row)}>
                  编辑
                </button>
                {row.active && (
                  <button className="btn btn--ghost" onClick={() => handleUnpublish(row)}>
                    {UI_COPY.adminDelete}
                  </button>
                )}
              </div>
            </div>
          ))}
          {templates.length === 0 && <p className="small">暂无模板</p>}
        </div>
      )}

      {form && cfg && (
        <div className="admin__form" style={{ marginTop: 20 }}>
          <h3 style={{ margin: 0 }}>{form.id ? '编辑模板' : UI_COPY.adminNew}</h3>

          <div className="admin__field">
            <label>{UI_COPY.adminName}</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="admin__field">
            <label>{UI_COPY.adminDescription}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="admin__field">
            <label>{UI_COPY.adminCover}</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCoverUpload(f);
              }}
            />
            {uploading && <span className="small">上传中…</span>}
            {form.coverUrl && (
              <img
                src={form.coverUrl}
                alt="封面预览"
                style={{ width: 120, borderRadius: 8, marginTop: 8 }}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div className="admin__field" style={{ flex: 1 }}>
              <label>{UI_COPY.adminSort}</label>
              <input
                type="number"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
              />
            </div>
            <div className="admin__field">
              <label className="admin__switch">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                {UI_COPY.adminActive}
              </label>
            </div>
          </div>

          <div className="admin__field">
            <label>{UI_COPY.adminProfileBase}</label>
            <select
              value={cfg.base}
              onChange={(e) => handleBaseChange(e.target.value as ProfileId)}
            >
              <option value="half">半身</option>
              <option value="full_ground">全身·拍脚</option>
              <option value="full_noground">全身·不拍脚</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            {(['x', 'y', 'w', 'h'] as const).map((k) => (
              <div className="admin__field" key={k}>
                <label>targetBox.{k}</label>
                <input
                  type="number"
                  step="0.01"
                  value={cfg.targetBox[k]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      cfg: { ...cfg, targetBox: { ...cfg.targetBox, [k]: Number(e.target.value) } },
                    })
                  }
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="admin__field">
              <label>tooFarEnter</label>
              <input
                type="number"
                step="0.01"
                value={cfg.tooFarEnter}
                onChange={(e) => setForm({ ...form, cfg: { ...cfg, tooFarEnter: Number(e.target.value) } })}
              />
            </div>
            <div className="admin__field">
              <label>tooFarExit</label>
              <input
                type="number"
                step="0.01"
                value={cfg.tooFarExit}
                onChange={(e) => setForm({ ...form, cfg: { ...cfg, tooFarExit: Number(e.target.value) } })}
              />
            </div>
            <div className="admin__field">
              <label>tooCloseEnter</label>
              <input
                type="number"
                step="0.01"
                value={cfg.tooCloseEnter}
                onChange={(e) => setForm({ ...form, cfg: { ...cfg, tooCloseEnter: Number(e.target.value) } })}
              />
            </div>
            <div className="admin__field">
              <label>tooCloseExit</label>
              <input
                type="number"
                step="0.01"
                value={cfg.tooCloseExit}
                onChange={(e) => setForm({ ...form, cfg: { ...cfg, tooCloseExit: Number(e.target.value) } })}
              />
            </div>
          </div>

          {cfg.base !== 'full_ground' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="admin__field">
                <label>faceOffsetEnter</label>
                <input
                  type="number"
                  step="0.01"
                  value={cfg.faceOffsetEnter}
                  onChange={(e) => setForm({ ...form, cfg: { ...cfg, faceOffsetEnter: Number(e.target.value) } })}
                />
              </div>
              <div className="admin__field">
                <label>faceOffsetExit</label>
                <input
                  type="number"
                  step="0.01"
                  value={cfg.faceOffsetExit}
                  onChange={(e) => setForm({ ...form, cfg: { ...cfg, faceOffsetExit: Number(e.target.value) } })}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <div className="admin__field">
              <label>headCropEnter</label>
              <input
                type="number"
                step="0.01"
                value={cfg.headCropEnter}
                onChange={(e) => setForm({ ...form, cfg: { ...cfg, headCropEnter: Number(e.target.value) } })}
              />
            </div>
            <div className="admin__field">
              <label>headCropExit</label>
              <input
                type="number"
                step="0.01"
                value={cfg.headCropExit}
                onChange={(e) => setForm({ ...form, cfg: { ...cfg, headCropExit: Number(e.target.value) } })}
              />
            </div>
            <div className="admin__field">
              <label>headGapEnter</label>
              <input
                type="number"
                step="0.01"
                value={cfg.headGapEnter}
                onChange={(e) => setForm({ ...form, cfg: { ...cfg, headGapEnter: Number(e.target.value) } })}
              />
            </div>
            <div className="admin__field">
              <label>headGapExit</label>
              <input
                type="number"
                step="0.01"
                value={cfg.headGapExit}
                onChange={(e) => setForm({ ...form, cfg: { ...cfg, headGapExit: Number(e.target.value) } })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button className="btn btn--primary" onClick={handleSave} disabled={saving || uploading}>
              {saving ? '保存中…' : UI_COPY.adminSave}
            </button>
            <button className="btn btn--ghost" onClick={() => setForm(null)}>
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
