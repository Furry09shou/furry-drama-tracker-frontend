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

  // 当前生效的主题选择（背景/图标两槽，支持跨主题组合）。
  const [selection, setSelection] = useState({ wallpaperThemeId: null, iconsThemeId: null, wallpaperIsDefault: false, iconsIsDefault: false });

  // 编辑器状态。
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState(null); // null = 新建
  const [saving, setSaving] = useState(false);

  // 应用组合选择弹窗（applyTarget 为待应用的主题；part 为单选组合）。
  const [applyTarget, setApplyTarget] = useState(null);
  const [applyPart, setApplyPart] = useState('both'); // wallpaper / icons / both
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
        // 两槽回落站点默认主题不算用户的选择（不高亮，仅兜底生效）。
        setSelection({
          wallpaperThemeId: selRes.data?.wallpaperIsDefault ? null : selRes.data?.wallpaperTheme?._id || null,
          iconsThemeId: selRes.data?.iconsIsDefault ? null : selRes.data?.iconsTheme?._id || null,
          wallpaperIsDefault: !!selRes.data?.wallpaperIsDefault,
          iconsIsDefault: !!selRes.data?.iconsIsDefault,
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

  // 外观面板「+ 制作我的主题」直达：/settings?createTheme=1 进页自动打开新建编辑器
  // （一次性消费参数，避免刷新重复弹出）。
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('createTheme') === '1') {
      sp.delete('createTheme');
      const qs = sp.toString();
      window.history.replaceState({}, '', `/settings${qs ? `?${qs}` : ''}`);
      setEditingTheme(null);
      setEditorOpen(true);
    }
  }, []);

  // ---- 应用 / 取消主题（背景/图标两槽，可跨主题组合） ----
  const doApply = async (theme, part) => {
    const body = {};
    if (part === 'wallpaper' || part === 'both') body.wallpaperThemeId = theme._id;
    if (part === 'icons' || part === 'both') body.iconsThemeId = theme._id;
    const res = await axios.put(API.THEMES.SELECTION, body);
    setSelection(prev => ({
      ...prev,
      wallpaperThemeId: part === 'wallpaper' || part === 'both' ? theme._id : prev.wallpaperThemeId,
      iconsThemeId: part === 'icons' || part === 'both' ? theme._id : prev.iconsThemeId,
    }));
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
    const type = theme.themeType || computeThemeType(theme);
    // 旧版配色主题无壁纸与图标内容，无法应用到任何槽。
    if (type === 'legacy') return;
    // 全套主题弹出组合选择；仅壁纸/仅图标直接应用到对应槽（另一槽不动）。
    if (type === 'full') {
      setApplyTarget(theme);
      setApplyPart('both');
      setApplyError('');
      return;
    }
    try {
      await doApply(theme, type === 'wallpaper' ? 'wallpaper' : 'icons');
    } catch (err) {
      setError(err.response?.data?.message || t('themeWorkshop.applyFailed'));
    }
  };

  const handleApplyConfirm = async () => {
    setApplying(true);
    try {
      await doApply(applyTarget, applyPart);
      setApplyTarget(null);
    } catch (err) {
      setApplyError(err.response?.data?.message || t('themeWorkshop.applyFailed'));
    } finally {
      setApplying(false);
    }
  };

  const handleReset = async () => {
    try {
      const res = await axios.put(API.THEMES.SELECTION, {
        wallpaperThemeId: '',
        iconsThemeId: '',
      });
      setSelection({ wallpaperThemeId: null, iconsThemeId: null, wallpaperIsDefault: false, iconsIsDefault: false });
      // 同步被清除的壁纸偏好，前端壁纸立即回落站点默认主题。
      if (res.data?.backgroundPrefs) {
        updateUser(prev => ({ ...prev, backgroundPrefs: res.data.backgroundPrefs }));
      }
      window.dispatchEvent(new Event(THEME_SELECTION_CHANGED_EVENT));
      notify(t('themeWorkshop.resetSuccess'));
    } catch (err) {
      setError(err.response?.data?.message || t('themeWorkshop.applyFailed'));
    }
  };

  // ---- 背景调整（透明度 / 模糊 / 单独关闭，不影响图标） ----
  const saveBgPrefs = async (patch) => {
    try {
      const res = await axios.put(API.THEMES.BACKGROUND_PREFS, patch);
      if (res.data?.backgroundPrefs) {
        updateUser(prev => ({ ...prev, backgroundPrefs: res.data.backgroundPrefs }));
      }
    } catch (err) {
      setError(err.response?.data?.message || t('themeWorkshop.bgSaveFailed'));
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
        // 新建后自动应用，所见即所得（仅壁纸→背景槽；仅图标→图标槽；全套→两槽）。
        const created = res.data;
        if (created?._id) {
          try {
            const type = computeThemeType(created);
            if (type === 'wallpaper' || type === 'icons' || type === 'full') {
              await doApply(created, type === 'full' ? 'both' : type);
            }
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
      // 若删除的主题正被使用，仅清空对应槽——另一槽的组合不受影响
      //（如主题A背景+主题B图标，删除B时背景槽保留A）。
      const clearWp = selection.wallpaperThemeId === theme._id;
      const clearIc = selection.iconsThemeId === theme._id;
      if (clearWp || clearIc) {
        const body = {};
        if (clearWp) body.wallpaperThemeId = '';
        if (clearIc) body.iconsThemeId = '';
        const res = await axios.put(API.THEMES.SELECTION, body);
        setSelection((prev) => ({
          wallpaperThemeId: clearWp ? null : prev.wallpaperThemeId,
          iconsThemeId: clearIc ? null : prev.iconsThemeId,
          wallpaperIsDefault: clearWp ? false : prev.wallpaperIsDefault,
          iconsIsDefault: clearIc ? false : prev.iconsIsDefault,
        }));
        // 背景槽被清空时同步被清除的壁纸偏好，背景立即回落站点默认。
        if (res.data?.backgroundPrefs) {
          updateUser((prev) => ({ ...prev, backgroundPrefs: res.data.backgroundPrefs }));
        }
        window.dispatchEvent(new Event(THEME_SELECTION_CHANGED_EVENT));
      }
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
    // 两槽分别判断：该主题可能只占背景槽、只占图标槽或两个都占。
    const wpActive = selection.wallpaperThemeId === theme._id;
    const icActive = selection.iconsThemeId === theme._id;
    const active = wpActive || icActive;
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
              {theme.isDefault && (
                <span style={{
                  fontSize: '10px', padding: '1px 7px', borderRadius: '999px', fontWeight: 600,
                  background: 'var(--primary-bg)', color: 'var(--primary)', whiteSpace: 'nowrap',
                }}>⭐ {t('colorPicker.badgeDefault')}</span>
              )}
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

        {/* 当前生效的槽（背景/图标分别标记，跨主题组合时一目了然） */}
        {active && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {wpActive && (
              <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '999px', fontWeight: 600, background: 'var(--primary-bg)', color: 'var(--primary)' }}>
                🖼 {t('themeWorkshop.wpInUse')}
              </span>
            )}
            {icActive && (
              <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '999px', fontWeight: 600, background: 'var(--primary-bg)', color: 'var(--primary)' }}>
                🧩 {t('themeWorkshop.icInUse')}
              </span>
            )}
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
          {type !== 'legacy' && !active ? (
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

  // 应用组合选择弹窗内容（单选：仅背景 / 仅图标 / 全套）。
  const applyOptionRow = (value, label, desc) => (
    <button
      type="button"
      onClick={() => setApplyPart(value)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
        padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
        background: applyPart === value ? 'var(--primary-bg)' : 'var(--hover-bg)',
        border: `1px solid ${applyPart === value ? 'var(--primary-border)' : 'var(--border)'}`,
        transition: 'all 0.2s',
      }}
    >
      <span style={{
        width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
        background: applyPart === value ? 'var(--primary)' : 'var(--input)',
        border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: '12px', fontWeight: 700,
      }}>{applyPart === value ? '✓' : ''}</span>
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

      {/* 当前组合状态：背景槽与图标槽分别显示来源（跨主题组合时清晰可见） */}
      {user && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '6px',
          padding: '10px 12px', borderRadius: '10px', marginBottom: '12px',
          background: 'var(--card)', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {t('themeWorkshop.comboTitle')}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              🖼
              {(() => {
                const wp = [...systemThemes, ...myThemes].find((th) => th._id === selection.wallpaperThemeId);
                if (wp) return <b style={{ color: 'var(--primary)' }}>{wp.name}</b>;
                if (selection.wallpaperIsDefault) return <span style={{ color: 'var(--text-tertiary)' }}>{t('themeWorkshop.slotDefault')}</span>;
                return <span style={{ color: 'var(--text-tertiary)' }}>{t('themeWorkshop.slotNone')}</span>;
              })()}
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              🧩
              {(() => {
                const ic = [...systemThemes, ...myThemes].find((th) => th._id === selection.iconsThemeId);
                if (ic) return <b style={{ color: 'var(--primary)' }}>{ic.name}</b>;
                if (selection.iconsIsDefault) return <span style={{ color: 'var(--text-tertiary)' }}>{t('themeWorkshop.slotDefault')}</span>;
                return <span style={{ color: 'var(--text-tertiary)' }}>{t('themeWorkshop.slotNone')}</span>;
              })()}
            </span>
          </div>
          {/* 背景调整：透明度 / 模糊 / 单独关闭（不影响图标） */}
          {user.backgroundPrefs?.image && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px',
              borderTop: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('themeWorkshop.bgAdjust')}</span>
                <button
                  type="button"
                  onClick={() => saveBgPrefs({ enabled: !user.backgroundPrefs.enabled })}
                  style={{
                    width: '38px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: user.backgroundPrefs.enabled ? 'var(--primary)' : 'var(--bg-tertiary)',
                    position: 'relative', transition: 'background 0.2s', padding: 0, flexShrink: 0,
                  }}
                  title={t('themeWorkshop.bgToggle')}
                >
                  <span style={{
                    position: 'absolute', top: '2px', left: user.backgroundPrefs.enabled ? '20px' : '2px',
                    width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>
              {user.backgroundPrefs.enabled && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {t('themeWorkshop.bgOpacity')}
                    <input
                      type="range" min="0" max="100" step="5"
                      defaultValue={user.backgroundPrefs.opacity ?? 30}
                      onChange={(e) => updateUser((prev) => ({
                        ...prev,
                        backgroundPrefs: { ...prev.backgroundPrefs, opacity: Number(e.target.value) },
                      }))}
                      onPointerUp={(e) => saveBgPrefs({ opacity: Number(e.currentTarget.value) })}
                      onTouchEnd={(e) => saveBgPrefs({ opacity: Number(e.currentTarget.value) })}
                      style={{ flex: 1, maxWidth: '180px', cursor: 'pointer' }}
                    />
                    <span style={{ fontFamily: 'monospace', minWidth: '28px', textAlign: 'right' }}>{user.backgroundPrefs.opacity ?? 30}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {t('themeWorkshop.bgBlur')}
                    <input
                      type="range" min="0" max="40" step="1"
                      defaultValue={user.backgroundPrefs.blur ?? 0}
                      onChange={(e) => updateUser((prev) => ({
                        ...prev,
                        backgroundPrefs: { ...prev.backgroundPrefs, blur: Number(e.target.value) },
                      }))}
                      onPointerUp={(e) => saveBgPrefs({ blur: Number(e.currentTarget.value) })}
                      onTouchEnd={(e) => saveBgPrefs({ blur: Number(e.currentTarget.value) })}
                      style={{ flex: 1, maxWidth: '180px', cursor: 'pointer' }}
                    />
                    <span style={{ fontFamily: 'monospace', minWidth: '28px', textAlign: 'right' }}>{user.backgroundPrefs.blur ?? 0}</span>
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      )}

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

      {/* 应用组合选择弹窗（全套主题：仅背景 / 仅图标 / 全套） */}
      <Modal isOpen={!!applyTarget} onClose={() => setApplyTarget(null)} maxWidth="420px">
        <div className="modal-header">
          <h3>{t('themeWorkshop.applyOptionsTitle', { name: applyTarget?.name || '' })}</h3>
          <button className="btn btn-secondary" onClick={() => setApplyTarget(null)}>{t('common.close')}</button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
          {t('themeWorkshop.applyOptionsDesc')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {applyOptionRow('wallpaper', t('themeWorkshop.applyWallpaper'), t('themeWorkshop.applyWallpaperDesc'))}
          {applyOptionRow('icons', t('themeWorkshop.applyIcons'), t('themeWorkshop.applyIconsDesc'))}
          {applyOptionRow('both', t('themeWorkshop.applyBoth'), t('themeWorkshop.applyBothDesc'))}
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
