import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import API from '../utils/apiEndpoints';
import Modal from './Modal';
import ThemeEditorModal, { computeThemeType, themeTypeBadge } from './ThemeEditorModal';
import { SvgIconPreview, THEME_SELECTION_CHANGED_EVENT } from '../contexts/IconContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';

/**
 * ThemeWorkshop 用户主题工坊（Settings 页内嵌）。
 *
 * 主题 = 壁纸 + UI 图标组合包（仅壁纸 / 仅图标 / 全套）。
 *
 * 功能：
 *   - 浏览系统主题与我的个人主题，卡片上展示类型徽章（全套/仅壁纸/仅图标）；
 *   - 应用主题时可自由组合应用部分（壁纸 / 图标 / 两者）；
 *   - 可视化创建/编辑个人主题（壁纸选取 + 图标映射，导入导出）；
 *   - 提交个人主题审核：审核通过后升级为系统主题；
 *   - 删除个人主题。
 */
const ThemeWorkshop = () => {
  const { t } = useI18n();
  const { setAccentColor } = useTheme();
  const { user, updateUser } = useAuth();

  const [systemThemes, setSystemThemes] = useState([]);
  const [myThemes, setMyThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 当前生效的主题选择（themeId + applyIcons/applyWallpaper）。
  const [selection, setSelection] = useState({ themeId: null, applyIcons: true, applyWallpaper: true });

  // 编辑器状态。
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState(null); // null = 新建
  const [saving, setSaving] = useState(false);

  // 应用组合选择弹窗（applyTarget 为待应用的主题）。
  const [applyTarget, setApplyTarget] = useState(null);
  const [optWallpaper, setOptWallpaper] = useState(true);
  const [optIcons, setOptIcons] = useState(true);
  const [applyError, setApplyError] = useState('');
  const [applying, setApplying] = useState(false);

  const notify = useCallback((msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const reqs = [axios.get(API.THEMES.LIST), axios.get(API.THEMES.MY)];
      if (user) reqs.push(axios.get(API.THEMES.MY_SELECTION));
      const [sysRes, myRes, selRes] = await Promise.all(reqs);
      setSystemThemes(sysRes.data || []);
      setMyThemes(myRes.data || []);
      if (selRes) {
        setSelection({
          themeId: selRes.data?.theme?._id || null,
          applyIcons: selRes.data?.applyIcons !== false,
          applyWallpaper: selRes.data?.applyWallpaper !== false,
        });
      }
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || t('themeWorkshop.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---- 应用 / 取消主题 ----
  const doApply = async (theme, applyWallpaper, applyIcons) => {
    const res = await axios.put(API.THEMES.SELECTION, {
      themeId: theme._id,
      applyWallpaper,
      applyIcons,
    });
    setSelection({ themeId: theme._id, applyWallpaper, applyIcons });
    // 壁纸部分写入背景偏好时，同步前端 user 让背景立即生效。
    if (res.data?.backgroundPrefs) {
      updateUser(prev => ({ ...prev, backgroundPrefs: res.data.backgroundPrefs }));
    }
    // 主题色：有则应用（用户当前主题色被替换），无则保持不变。
    if (res.data?.accentColor && /^#[0-9a-fA-F]{6}$/.test(res.data.accentColor)) {
      setAccentColor(res.data.accentColor);
    }
    // 广播主题选择变化：IconContext 重新拉取主题图标覆盖。
    window.dispatchEvent(new Event(THEME_SELECTION_CHANGED_EVENT));
    notify(t('themeWorkshop.applied', { name: theme.name }));
  };

  const handleApply = async (theme) => {
    const type = computeThemeType(theme);
    // 全套主题弹出组合选择；仅壁纸/仅图标直接应用。
    if (type === 'full') {
      setApplyTarget(theme);
      setOptWallpaper(true);
      setOptIcons(true);
      setApplyError('');
      return;
    }
    try {
      await doApply(theme, type === 'wallpaper', type === 'icons');
    } catch (err) {
      setError(err.response?.data?.message || t('themeWorkshop.applyFailed'));
    }
  };

  const handleApplyConfirm = async () => {
    if (!optWallpaper && !optIcons) {
      setApplyError(t('themeWorkshop.applyAtLeastOne'));
      return;
    }
    setApplying(true);
    try {
      await doApply(applyTarget, optWallpaper, optIcons);
      setApplyTarget(null);
    } catch (err) {
      setApplyError(err.response?.data?.message || t('themeWorkshop.applyFailed'));
    } finally {
      setApplying(false);
    }
  };

  const handleReset = async () => {
    try {
      await axios.put(API.THEMES.SELECTION, { themeId: '' });
      setSelection({ themeId: null, applyIcons: true, applyWallpaper: true });
      window.dispatchEvent(new Event(THEME_SELECTION_CHANGED_EVENT));
      notify(t('themeWorkshop.resetSuccess'));
    } catch (err) {
      setError(err.response?.data?.message || t('themeWorkshop.applyFailed'));
    }
  };

  // ---- 创建 / 编辑 ----
  const openCreate = () => { setEditingTheme(null); setEditorOpen(true); };
  const openEdit = (theme) => { setEditingTheme(theme); setEditorOpen(true); };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editingTheme) {
        await axios.put(API.THEMES.DETAIL(editingTheme._id), payload);
        notify(t('themeWorkshop.updateSuccess'));
      } else {
        const res = await axios.post('/api/themes', payload);
        notify(t('themeWorkshop.createSuccess'));
        // 新建后自动应用，所见即所得。
        const created = res.data;
        if (created?._id) {
          try {
            const type = computeThemeType(created);
            await doApply(created, type === 'full' || type === 'wallpaper', type === 'full' || type === 'icons');
          } catch { /* 应用失败不影响创建结果 */ }
        }
      }
      setEditorOpen(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || t('themeWorkshop.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (theme) => {
    if (!window.confirm(t('themeWorkshop.deleteConfirm', { name: theme.name }))) return;
    try {
      await axios.delete(API.THEMES.DETAIL(theme._id));
      // 若删除的是当前使用主题，回退默认主题。
      if (selection.themeId === theme._id) handleReset();
      notify(t('themeWorkshop.deleteSuccess'));
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || t('themeWorkshop.deleteFailed'));
    }
  };

  const handleSubmit = async (theme) => {
    if (!window.confirm(t('themeWorkshop.submitConfirm', { name: theme.name }))) return;
    try {
      await axios.post(API.THEMES.SUBMIT(theme._id));
      notify(t('themeWorkshop.submitSuccess'));
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || t('themeWorkshop.submitFailed'));
    }
  };

  // ---- 渲染 ----
  const statusBadge = (th) => {
    if (th.isSystem) return { text: t('themeWorkshop.statusSystem'), bg: 'var(--success-bg)', fg: 'var(--success-text)' };
    if (th.status === 'pending') return { text: t('themeWorkshop.statusPending'), bg: 'var(--warning-bg)', fg: 'var(--warning-text)' };
    if (th.status === 'rejected') return { text: t('themeWorkshop.statusRejected'), bg: 'var(--destructive-bg)', fg: 'var(--destructive-text)' };
    if (th.status === 'approved') return { text: t('themeWorkshop.statusApproved'), bg: 'var(--success-bg)', fg: 'var(--success-text)' };
    return { text: t('themeWorkshop.statusDraft'), bg: 'var(--hover-bg)', fg: 'var(--text-secondary)' };
  };

  const renderCard = (theme, isMine) => {
    const active = selection.themeId === theme._id;
    const badge = statusBadge(theme);
    const type = computeThemeType(theme);
    const typeBadge = themeTypeBadge(type, t);
    const iconEntries = Object.entries(theme.icons || {});
    return (
      <div key={theme._id} style={{
        background: 'var(--card)', borderRadius: '12px', border: active ? '1px solid var(--primary-border)' : '1px solid var(--border)',
        padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
        boxShadow: active ? 'var(--card-shadow-hover)' : 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: '14px', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: active ? 'var(--primary)' : 'var(--foreground)',
            }}>
              {theme.name}{active ? ` · ${t('themeWorkshop.inUse')}` : ''}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '10px', padding: '1px 7px', borderRadius: '999px', fontWeight: 600,
                background: typeBadge.bg, color: typeBadge.fg, whiteSpace: 'nowrap',
              }}>{typeBadge.icon} {typeBadge.text}</span>
              {theme.accentColor && (
                <span title={theme.accentColor} style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: theme.accentColor, border: '1px solid var(--border)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }} />
              )}
            </div>
          </div>
          <span style={{
            fontSize: '10px', padding: '2px 8px', borderRadius: '999px',
            background: badge.bg, color: badge.fg, fontWeight: 600, flexShrink: 0,
          }}>{badge.text}</span>
        </div>

        {/* 壁纸缩略预览 */}
        {(theme.wallpaperThumb || theme.wallpaperUrl) && (
          <div style={{
            aspectRatio: '21 / 9', borderRadius: '8px', border: '1px solid var(--border)',
            backgroundImage: `url(${theme.wallpaperThumb || theme.wallpaperUrl})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }} />
        )}

        {/* 图标预览（最多 6 个） */}
        {iconEntries.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {iconEntries.slice(0, 6).map(([key, url]) => (
              <span key={key} title={key} style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '26px', height: '26px', borderRadius: '6px',
                background: 'var(--hover-bg)', border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}>
                <SvgIconPreview url={url} size={16} />
              </span>
            ))}
            {iconEntries.length > 6 && (
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>+{iconEntries.length - 6}</span>
            )}
          </div>
        )}

        {/* 当前选择的部分（仅全套主题应用时提示） */}
        {active && type !== 'legacy' && (selection.applyIcons !== true || selection.applyWallpaper !== true) && (
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {t('themeWorkshop.applyWallpaper')}: {selection.applyWallpaper ? '✅' : '—'} · {t('themeWorkshop.applyIcons')}: {selection.applyIcons ? '✅' : '—'}
          </div>
        )}

        {type === 'legacy' && (
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{t('themeEditor.typeLegacy')}</div>
        )}

        {/* 审核备注 */}
        {isMine && theme.status === 'rejected' && theme.reviewNote && (
          <div style={{
            fontSize: '11px', color: 'var(--destructive-text)', background: 'var(--destructive-bg-subtle)',
            borderRadius: '6px', padding: '6px 8px', lineHeight: 1.5,
          }}>💬 {theme.reviewNote}</div>
        )}

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
          {!active ? (
            <button className="btn" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => handleApply(theme)}>
              {t('themeWorkshop.apply')}
            </button>
          ) : (
            <>
              {type === 'full' && (
                <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => handleApply(theme)}>
                  {t('themeWorkshop.applyAdjust')}
                </button>
              )}
              <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={handleReset}>
                {t('themeWorkshop.reset')}
              </button>
            </>
          )}
          {isMine && !theme.isSystem && (
            <>
              <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => openEdit(theme)}>
                {t('common.edit')}
              </button>
              {(theme.status === 'draft' || theme.status === 'rejected') && (
                <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => handleSubmit(theme)}>
                  {t('themeWorkshop.submit')}
                </button>
              )}
              <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '12px', color: 'var(--destructive-text)', borderColor: 'var(--destructive-border)' }} onClick={() => handleDelete(theme)}>
                {t('common.delete')}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // 应用组合选择弹窗内容。
  const applyOptionRow = (checked, onToggle, label, desc) => (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
        padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
        background: checked ? 'var(--primary-bg)' : 'var(--hover-bg)',
        border: `1px solid ${checked ? 'var(--primary-border)' : 'var(--border)'}`,
        transition: 'all 0.2s',
      }}
    >
      <span style={{
        width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
        background: checked ? 'var(--primary)' : 'var(--input)', position: 'relative',
        border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: '12px', fontWeight: 700,
      }}>{checked ? '✓' : ''}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>{label}</span>
        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>{desc}</span>
      </span>
    </button>
  );

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{
          fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0,
        }}>{t('themeWorkshop.title')}</h3>
        <button className="btn" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={openCreate}>
          + {t('themeWorkshop.create')}
        </button>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: 1.5 }}>
        {t('themeWorkshop.desc')}
      </p>

      {error && <div className="error-message" style={{ marginBottom: '10px' }}>{error}</div>}
      {success && (
        <div style={{
          marginBottom: '10px', padding: '8px 12px', background: 'var(--success-bg-strong)',
          border: '1px solid var(--success-border)', borderRadius: '6px', color: 'var(--success-text)', fontSize: '13px',
        }}>{success}</div>
      )}

      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          {t('common.loading')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 系统主题 */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              🌍 {t('themeWorkshop.systemThemes')}（{systemThemes.length}）
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
              {systemThemes.map((th) => renderCard(th, false))}
              {systemThemes.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', gridColumn: '1 / -1' }}>
                  {t('themeWorkshop.emptySystem')}
                </div>
              )}
            </div>
          </div>

          {/* 我的主题 */}
          {user && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                ✨ {t('themeWorkshop.myThemes')}（{myThemes.length}）
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                {myThemes.map((th) => renderCard(th, true))}
                {myThemes.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', gridColumn: '1 / -1' }}>
                    {t('themeWorkshop.emptyMy')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 主题编辑器（壁纸 + 图标组合） */}
      <ThemeEditorModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        initial={editingTheme ? {
          name: editingTheme.name,
          description: editingTheme.description,
          wallpaperUrl: editingTheme.wallpaperUrl || '',
          wallpaperThumb: editingTheme.wallpaperThumb || '',
          icons: editingTheme.icons || {},
          accentColor: editingTheme.accentColor || '',
        } : null}
        onSave={handleSave}
        saving={saving}
        title={editingTheme ? t('themeWorkshop.editTitle', { name: editingTheme.name }) : t('themeWorkshop.createTitle')}
      />

      {/* 应用组合选择弹窗（全套主题） */}
      <Modal isOpen={!!applyTarget} onClose={() => setApplyTarget(null)} maxWidth="420px">
        <div className="modal-header">
          <h3>{t('themeWorkshop.applyOptionsTitle', { name: applyTarget?.name || '' })}</h3>
          <button className="btn btn-secondary" onClick={() => setApplyTarget(null)}>{t('common.close')}</button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
          {t('themeWorkshop.applyOptionsDesc')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {applyOptionRow(optWallpaper, () => setOptWallpaper(v => !v), t('themeWorkshop.applyWallpaper'), t('themeWorkshop.applyWallpaperDesc'))}
          {applyOptionRow(optIcons, () => setOptIcons(v => !v), t('themeWorkshop.applyIcons'), t('themeWorkshop.applyIconsDesc'))}
        </div>
        {applyError && <div className="error-message" style={{ marginTop: '10px' }}>{applyError}</div>}
        <div className="form-group" style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => setApplyTarget(null)}>{t('common.cancel')}</button>
          <button className="btn" onClick={handleApplyConfirm} disabled={applying}>
            {applying ? t('common.saving') : t('themeWorkshop.applyConfirm')}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default ThemeWorkshop;
