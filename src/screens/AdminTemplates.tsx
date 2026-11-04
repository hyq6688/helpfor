// 模板管理页。规格 AC-10~AC-13。
// 仅 is_admin 用户可进入；可新建/编辑/下架模板，封面上传到 Supabase Storage。
// ≥1024 用表格 + 右侧抽屉表单；<1024 退回卡片列表 + 内联可折叠表单。

import { useCallback, useEffect, useRef, useState } from 'react';
import { isAdmin, useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { mapCovers } from '../hooks/useTemplates';
import { DEFAULT_TEMPLATES } from '../profiles';
import { BASE_LABELS } from '../core/templateFilters';
import { EmptyState, ErrorNotice, LoadingState } from '../components/StateFeedback';
import TemplateCover from '../components/TemplateCover';
import { SCREEN_COPY, UI_COPY, adminConfirmText } from '../copy';
import type {
  ProfileId,
  StoredTemplate,
  StoredTemplateConfig,
  TemplateCoverRow,
} from '../types';

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

/** 更新时间展示成「YYYY-MM-DD HH:mm」；缺失或非法时显示占位符。 */
function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export default function AdminTemplates({ onBack }: { onBack: () => void }) {
  const { user, loading } = useAuth();
  const [templates, setTemplates] = useState<StoredTemplate[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLElement>(null);
  // 固定模板封面：key → 覆盖后的 url
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [coverUploading, setCoverUploading] = useState<string | null>(null);
  const [pendingCoverKey, setPendingCoverKey] = useState<string | null>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  // 下架确认弹窗
  const [pendingDelete, setPendingDelete] = useState<StoredTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCovers = useCallback(async () => {
    const { data } = await supabase.from('template_covers').select('*');
    setCovers(mapCovers(data as TemplateCoverRow[] | null));
  }, []);

  const fetchAll = useCallback(async () => {
    setListLoading(true);
    setListError('');
    const { data, error: loadError } = await supabase
      .from('templates')
      .select('*')
      .order('sort', { ascending: true });
    if (loadError) {
      setListError(`加载失败：${loadError.message}`);
    } else {
      setTemplates((data as StoredTemplate[]) ?? []);
    }
    setListLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      fetchAll();
      fetchCovers();
    }
  }, [user, fetchAll, fetchCovers]);

  if (loading) {
    return (
      <div className="admin">
        <LoadingState label={UI_COPY.templatesLoading} />
      </div>
    );
  }

  if (!isAdmin(user)) {
    return (
      <div className="admin">
        <EmptyState
          title={UI_COPY.adminNoPermission}
          text="请用管理员账号登录后再进入模板管理。"
          actionLabel={SCREEN_COPY.backHome}
          onAction={onBack}
        />
      </div>
    );
  }

  const openForm = (next: FormState) => {
    setError('');
    setNotice('');
    setForm(next);
    // 窄屏表单内联在列表之后，打开时滚动到表单，避免用户以为没反应
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => {
        formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }
  };

  const closeForm = () => {
    setForm(null);
    setError('');
  };

  const startNew = () => openForm(emptyForm());

  const startEdit = (row: StoredTemplate) =>
    openForm({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      coverUrl: row.cover_url ?? '',
      sort: row.sort ?? 0,
      active: row.active ?? true,
      cfg: row.profile_config,
    });

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
    setError('');
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
      setError(`封面上传失败：${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form || !user) return;
    if (!form.name.trim()) {
      setError('请填写名称');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
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
      const { error: saveError } = form.id
        ? await supabase.from('templates').update(payload).eq('id', form.id)
        : await supabase.from('templates').insert(payload);
      if (saveError) throw saveError;
      setNotice(form.id ? '已更新' : '已创建');
      setForm(null);
      fetchAll();
    } catch (e) {
      setError(`保存失败：${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  /** 固定模板封面：上传到 Storage 后写入 template_covers（按 key upsert）。 */
  const handleFixedCoverUpload = async (key: string, file: File) => {
    setCoverUploading(key);
    setError('');
    setNotice('');
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `fixed/${key}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('template-covers')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from('template-covers').getPublicUrl(path);
      const url = data.publicUrl;

      const { error: dbErr } = await supabase
        .from('template_covers')
        .upsert({ key, cover_url: url }, { onConflict: 'key' });
      if (dbErr) throw dbErr;

      setCovers((prev) => ({ ...prev, [key]: url }));
      setNotice(UI_COPY.adminCoverUpdated);
    } catch (e) {
      setError(`${UI_COPY.adminCoverFailed}：${(e as Error).message}`);
    } finally {
      setCoverUploading(null);
    }
  };

  /** 下架（软删除）：保持 active 字段语义，不物理删除数据。 */
  const confirmDeactivate = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setError('');
    setNotice('');
    const { error: unpublishError } = await supabase
      .from('templates')
      .update({ active: false })
      .eq('id', pendingDelete.id);
    setDeleting(false);
    if (unpublishError) {
      setError(`下架失败：${unpublishError.message}`);
      return;
    }
    setPendingDelete(null);
    setNotice(UI_COPY.adminDeactivated);
    fetchAll();
  };

  const cfg = form?.cfg;

  /** 列表缩略图与用户端一致：优先模板自身封面，其次固定封面覆盖，最后内置默认图。 */
  const coverFor = (row: StoredTemplate) =>
    row.cover_url ||
    covers[row.id] ||
    DEFAULT_TEMPLATES.find((tpl) => tpl.id === row.id)?.coverUrl ||
    '';

  return (
    <div className="admin wf-admin">
      <div className="admin__head">
        <div>
          <p className="wf-eyebrow">ADMIN</p>
          <h2 className="admin__title">{UI_COPY.adminTitle}</h2>
          <p className="admin__subtitle">管理模板、封面与取景参数；下架后用户端立即隐藏。</p>
        </div>
        <div className="admin__headactions">
          <button className="btn btn--primary" onClick={startNew}>
            {UI_COPY.adminNew}
          </button>
          <button className="btn btn--ghost" onClick={onBack}>
            {SCREEN_COPY.back}
          </button>
        </div>
      </div>

      {error && <ErrorNotice message={error} />}
      {notice && <p className="wf-note wf-note--ok">{notice}</p>}

      <section className="admin__covers">
        <div className="admin__sectionhead">
          <h3 className="admin__h3">{UI_COPY.adminFixedCovers}</h3>
          <span className="admin__sectionhint">三个内置模板的封面</span>
        </div>
        <div className="admin__cover-list">
          {DEFAULT_TEMPLATES.map((tpl) => {
            const url = covers[tpl.id] ?? tpl.coverUrl;
            return (
              <div className="admin__cover-item" key={tpl.id}>
                <div className="admin__cover-thumb">
                  {url && <img src={url} alt={tpl.name} />}
                </div>
                <p className="admin__cover-name">{tpl.name}</p>
                <button
                  className="btn btn--ghost"
                  disabled={coverUploading === tpl.id}
                  onClick={() => {
                    setPendingCoverKey(tpl.id);
                    coverFileRef.current?.click();
                  }}
                >
                  {coverUploading === tpl.id
                    ? UI_COPY.adminCoverUploading
                    : UI_COPY.adminReplaceCover}
                </button>
              </div>
            );
          })}
        </div>
        <input
          ref={coverFileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            const key = pendingCoverKey;
            e.target.value = '';
            if (file && key) handleFixedCoverUpload(key, file);
          }}
        />
      </section>

      <section className="admin__list">
        <div className="admin__sectionhead">
          <h3 className="admin__h3">模板列表</h3>
          <span className="admin__sectionhint">共 {templates.length} 个</span>
        </div>

        {listLoading && <LoadingState label={UI_COPY.templatesLoading} />}

        {!listLoading && listError && (
          <ErrorNotice
            message={listError}
            actionLabel={UI_COPY.adminRetry}
            onAction={fetchAll}
          />
        )}

        {!listLoading && !listError && templates.length === 0 && (
          <EmptyState
            title={UI_COPY.adminListEmpty}
            text={UI_COPY.adminListEmptyText}
            actionLabel={UI_COPY.adminNew}
            onAction={startNew}
          />
        )}

        {!listLoading && templates.length > 0 && (
          <>
            <div className="admin__tablewrap">
              <table className="admin__table">
                <thead>
                  <tr>
                    <th>封面</th>
                    <th>名称</th>
                    <th>构图骨架</th>
                    <th>排序</th>
                    <th>{UI_COPY.adminStatus}</th>
                    <th>{UI_COPY.adminUpdatedAt}</th>
                    <th className="admin__th-actions">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="admin__thumb">
                          <TemplateCover url={coverFor(row)} name={row.name} />
                        </div>
                      </td>
                      <td>
                        <div className="admin__name">{row.name}</div>
                        {row.description && <div className="admin__sub">{row.description}</div>}
                      </td>
                      <td>{BASE_LABELS[row.profile_config.base] ?? row.profile_config.base}</td>
                      <td>{row.sort}</td>
                      <td>
                        <span
                          className={`wf-badge ${
                            row.active ? 'wf-badge--on' : 'wf-badge--off'
                          }`}
                        >
                          {row.active ? UI_COPY.adminActiveOn : UI_COPY.adminActiveOff}
                        </span>
                      </td>
                      <td className="admin__time">{formatDate(row.updated_at)}</td>
                      <td>
                        <div className="admin__rowactions">
                          <button className="btn btn--ghost" onClick={() => startEdit(row)}>
                            {UI_COPY.adminEdit}
                          </button>
                          {row.active && (
                            <button
                              className="btn admin__danger"
                              onClick={() => setPendingDelete(row)}
                            >
                              {UI_COPY.adminDeactivate}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin__cards">
              {templates.map((row) => (
                <article className="admin__card" key={row.id}>
                  <div className="admin__thumb admin__thumb--lg">
                    <TemplateCover url={coverFor(row)} name={row.name} />
                  </div>
                  <div className="admin__cardbody">
                    <div className="admin__cardtitle">
                      <span className="admin__name">{row.name}</span>
                      <span
                        className={`wf-badge ${
                          row.active ? 'wf-badge--on' : 'wf-badge--off'
                        }`}
                      >
                        {row.active ? UI_COPY.adminActiveOn : UI_COPY.adminActiveOff}
                      </span>
                    </div>
                    <p className="admin__sub">
                      {BASE_LABELS[row.profile_config.base] ?? row.profile_config.base} · 排序{' '}
                      {row.sort}
                    </p>
                    <p className="admin__sub">
                      {UI_COPY.adminUpdatedAt} {formatDate(row.updated_at)}
                    </p>
                    <div className="admin__rowactions">
                      <button className="btn btn--ghost" onClick={() => startEdit(row)}>
                        {UI_COPY.adminEdit}
                      </button>
                      {row.active && (
                        <button
                          className="btn admin__danger"
                          onClick={() => setPendingDelete(row)}
                        >
                          {UI_COPY.adminDeactivate}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {form && cfg && (
        <>
          <div className="admin__drawer-mask" onClick={closeForm} aria-hidden="true" />
          <aside
            className="admin__formpanel"
            ref={formRef}
            role="dialog"
            aria-modal="true"
            aria-label={form.id ? '编辑模板' : UI_COPY.adminNew}
          >
            <header className="admin__formhead">
              <div>
                <p className="wf-eyebrow">TEMPLATE</p>
                <h3 className="admin__formtitle">{form.id ? '编辑模板' : UI_COPY.adminNew}</h3>
              </div>
              <button className="admin__close" onClick={closeForm} aria-label={UI_COPY.adminCollapse}>
                ×
              </button>
            </header>

            <div className="admin__field">
              <label htmlFor="admin-name">{UI_COPY.adminName}</label>
              <input
                id="admin-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="admin__field">
              <label htmlFor="admin-desc">{UI_COPY.adminDescription}</label>
              <textarea
                id="admin-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="admin__field">
              <label>{UI_COPY.adminCover}</label>
              <div className="admin__file">
                <input
                  id="admin-cover-file"
                  className="admin__file-input"
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCoverUpload(f);
                  }}
                />
                <label className="admin__file-btn" htmlFor="admin-cover-file">
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      d="M10 4v9M5.5 8.5 10 4l4.5 4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M4 13v2.2A1.8 1.8 0 0 0 5.8 17h8.4A1.8 1.8 0 0 0 16 15.2V13"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  {UI_COPY.adminCoverPick}
                </label>
                {uploading && <span className="admin__sectionhint">上传中…</span>}
              </div>
              {form.coverUrl && (
                <img
                  className="admin__coverpreview"
                  src={form.coverUrl}
                  alt={UI_COPY.adminCoverPreview}
                />
              )}
            </div>

            <div className="admin__grid admin__grid--2">
              <div className="admin__field">
                <label htmlFor="admin-sort">{UI_COPY.adminSort}</label>
                <input
                  id="admin-sort"
                  type="number"
                  value={form.sort}
                  onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
                />
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
            </div>

            <label className="admin__switch">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              {UI_COPY.adminActive}
            </label>

            <details className="admin__advanced">
              <summary>{UI_COPY.adminAdvanced}</summary>

              <div className="admin__grid admin__grid--4">
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
                          cfg: {
                            ...cfg,
                            targetBox: { ...cfg.targetBox, [k]: Number(e.target.value) },
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="admin__grid admin__grid--2">
                <div className="admin__field">
                  <label>tooFarEnter</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cfg.tooFarEnter}
                    onChange={(e) =>
                      setForm({ ...form, cfg: { ...cfg, tooFarEnter: Number(e.target.value) } })
                    }
                  />
                </div>
                <div className="admin__field">
                  <label>tooFarExit</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cfg.tooFarExit}
                    onChange={(e) =>
                      setForm({ ...form, cfg: { ...cfg, tooFarExit: Number(e.target.value) } })
                    }
                  />
                </div>
                <div className="admin__field">
                  <label>tooCloseEnter</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cfg.tooCloseEnter}
                    onChange={(e) =>
                      setForm({ ...form, cfg: { ...cfg, tooCloseEnter: Number(e.target.value) } })
                    }
                  />
                </div>
                <div className="admin__field">
                  <label>tooCloseExit</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cfg.tooCloseExit}
                    onChange={(e) =>
                      setForm({ ...form, cfg: { ...cfg, tooCloseExit: Number(e.target.value) } })
                    }
                  />
                </div>
              </div>

              {cfg.base !== 'full_ground' && (
                <div className="admin__grid admin__grid--2">
                  <div className="admin__field">
                    <label>faceOffsetEnter</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cfg.faceOffsetEnter}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          cfg: { ...cfg, faceOffsetEnter: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="admin__field">
                    <label>faceOffsetExit</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cfg.faceOffsetExit}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          cfg: { ...cfg, faceOffsetExit: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>
              )}

              <div className="admin__grid admin__grid--4">
                <div className="admin__field">
                  <label>headCropEnter</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cfg.headCropEnter}
                    onChange={(e) =>
                      setForm({ ...form, cfg: { ...cfg, headCropEnter: Number(e.target.value) } })
                    }
                  />
                </div>
                <div className="admin__field">
                  <label>headCropExit</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cfg.headCropExit}
                    onChange={(e) =>
                      setForm({ ...form, cfg: { ...cfg, headCropExit: Number(e.target.value) } })
                    }
                  />
                </div>
                <div className="admin__field">
                  <label>headGapEnter</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cfg.headGapEnter}
                    onChange={(e) =>
                      setForm({ ...form, cfg: { ...cfg, headGapEnter: Number(e.target.value) } })
                    }
                  />
                </div>
                <div className="admin__field">
                  <label>headGapExit</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cfg.headGapExit}
                    onChange={(e) =>
                      setForm({ ...form, cfg: { ...cfg, headGapExit: Number(e.target.value) } })
                    }
                  />
                </div>
              </div>
            </details>

            <div className="admin__formfoot">
              <button className="btn btn--primary" onClick={handleSave} disabled={saving || uploading}>
                {saving ? '保存中…' : UI_COPY.adminSave}
              </button>
              <button className="btn btn--ghost" onClick={closeForm}>
                {UI_COPY.adminConfirmCancel}
              </button>
            </div>
          </aside>
        </>
      )}

      {pendingDelete && (
        <div
          className="admin__confirm-mask"
          onClick={() => {
            if (!deleting) setPendingDelete(null);
          }}
        >
          <div
            className="admin__confirm"
            role="dialog"
            aria-modal="true"
            aria-label={UI_COPY.adminConfirmTitle}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="admin__confirm-title">{UI_COPY.adminConfirmTitle}</h3>
            <p className="admin__confirm-text">{adminConfirmText(pendingDelete.name)}</p>
            <div className="admin__confirm-actions">
              <button
                className="btn btn--ghost"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
              >
                {UI_COPY.adminConfirmCancel}
              </button>
              <button className="btn btn--danger" disabled={deleting} onClick={confirmDeactivate}>
                {deleting ? UI_COPY.adminDeleting : UI_COPY.adminConfirmOk}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
