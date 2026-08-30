import React, { useState, useEffect, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import adminApi from '../utils/adminApi';
import API from '../utils/apiEndpoints';
import ThemeEditorModal, { computeThemeType, themeTypeBadge } from './ThemeEditorModal';
import { SvgIconPreview } from '../contexts/IconContext';
import { useI18n } from '../contexts/I18nContext';

/**
 * AdminThemes 主题管理页（/admin/themes）。
 *
 * 主题 = 壁纸 + UI 图标组合包（仅壁纸 / 仅图标 / 全套）。
 *
 * 功能：
 *   - 主题列表（全部 / 系统 / 个人 / 待审核 筛选），含设默认（开关）、
 *     系统⇄个人切换、启用停用、删除；
 *   - 卡片展示类型徽章、壁纸缩略图与图标预览；
 *   - 可视化创建/编辑主题（壁纸 + 图标组合，导入导出 JSON）。
 * 壁纸与图标素材均融入主题编辑器（素材库选择/上传），不再单独管理。
 */
const AdminThemes = () => {
  const { admin } = useOutletContext();
  const { t } = useI18n();
  const [themes, setThemes] = useState([]);
  const [filter, setFilter] = useState('all'); // all | system | personal | pending
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 编辑器状态。
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState(null); // null = 新建
  const [saving, setSaving] = useState(false);

  const notify = useCallback((msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }, []);

  const fetchThemes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get(API.THEMES.ALL);
      setThemes(res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || t('adminThemes.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (admin) fetchThemes();
  }, [admin, fetchThemes]);

  if (!admin) return null;
  const isSuper = admin.role === 'superadmin';

  // ---- 操作 ----
  const openCreate = () => { setEditingTheme(null); setEditorOpen(true); };
  const openEdit = (theme) => { setEditingTheme(theme); setEditorOpen(true); };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editingTheme) {
        await adminApi.put(API.THEMES.DETAIL(editingTheme._id), payload);
        notify(t('adminThemes.updateSuccess'));
      } else {
        // 超管在后台创建的直接是系统主题。
        await adminApi.post(API.THEMES.LIST.replace('/list', ''), { ...payload, isSystem: isSuper });
        notify(t('adminThemes.createSuccess'));
      }
      setEditorOpen(false);
      fetchThemes();
    } catch (err) {
      setError(err.response?.data?.message || t('adminThemes.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (theme) => {
    if (!window.confirm(t('adminThemes.deleteConfirm', { name: theme.name }))) return;
    try {
      await adminApi.delete(API.THEMES.DETAIL(theme._id));
      notify(t('adminThemes.deleteSuccess'));
      fetchThemes();
    } catch (err) {
      setError(err.response?.data?.message || t('adminThemes.deleteFailed'));
    }
  };

  // 默认主题开关：开启 = 设为站点默认（全站唯一，未选主题的用户自动套用）；
  // 关闭 = 取消默认（站点可以没有任何默认主题）。
  const handleSetDefault = async (theme, wantDefault) => {
    try {
      await adminApi.put(API.THEMES.ADMIN_UPDATE(theme._id), { isDefault: !!wantDefault });
      notify(wantDefault ? t('adminThemes.defaultSuccess') : t('adminThemes.defaultCleared'));
      fetchThemes();
    } catch (err) {
      setError(err.response?.data?.message || t('adminThemes.defaultFailed'));
    }
  };

  const handleToggleEnabled = async (theme) => {
    try {
      await adminApi.put(API.THEMES.ADMIN_UPDATE(theme._id), { enabled: !theme.enabled });
      fetchThemes();
    } catch (err) {
      setError(err.response?.data?.message || t('adminThemes.opFailed'));
    }
  };

  const handleToggleSystem = async (theme) => {
    const toSystem = !theme.isSystem;
    if (!window.confirm(toSystem
      ? t('adminThemes.toSystemConfirm', { name: theme.name })
      : t('adminThemes.toPersonalConfirm', { name: theme.name }))) return;
    try {
      await adminApi.put(API.THEMES.ADMIN_UPDATE(theme._id), { isSystem: toSystem });
      notify(t('adminThemes.classChangeSuccess'));
      fetchThemes();
    } catch (err) {
      setError(err.response?.data?.message || t('adminThemes.opFailed'));
    }
  };

  // ---- 列表筛选 ----
  const filtered = themes.filter((th) => {
    if (filter === 'system') return th.isSystem;
    if (filter === 'personal') return !th.isSystem;
    if (filter === 'pending') return th.status === 'pending';
    return true;
  });

  const statusBadge = (th) => {
    if (th.isDefault) return { text: t('adminThemes.badgeDefault'), bg: 'var(--primary-bg)', fg: 'var(--primary)' };
    if (th.status === 'pending') return { text: t('adminThemes.badgePending'), bg: 'var(--warning-bg)', fg: 'var(--warning-text)' };
    if (th.status === 'rejected') return { text: t('adminThemes.badgeRejected'), bg: 'var(--destructive-bg)', fg: 'var(--destructive-text)' };
    if (th.isSystem) return { text: t('adminThemes.badgeSystem'), bg: 'var(--success-bg)', fg: 'var(--success-text)' };
    return { text: t('adminThemes.badgePersonal'), bg: 'var(--hover-bg)', fg: 'var(--text-secondary)' };
  };

  const filterTabs = [
    { key: 'all', label: t('adminThemes.filterAll') },
    { key: 'system', label: t('adminThemes.filterSystem') },
    { key: 'personal', label: t('adminThemes.filterPersonal') },
    { key: 'pending', label: t('adminThemes.filterPending') },
  ];

  return (
    <div className="admin-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0 }}>{t('adminThemes.title')}</h2>
      </div>

      {error && <div className="error-message" style={{ marginBottom: '15px' }}>{error}</div>}
      {success && (
        <div style={{
          marginBottom: '15px', padding: '10px', background: 'var(--success-bg-strong)',
          border: '1px solid var(--success-border)', borderRadius: '6px', color: 'var(--success-text)',
        }}>{success}</div>
      )}

      <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {filterTabs.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: '6px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
                    background: filter === f.key ? 'var(--primary-bg)' : 'var(--hover-bg)',
                    color: filter === f.key ? 'var(--primary)' : 'var(--foreground)',
                    border: filter === f.key ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                    fontWeight: filter === f.key ? 600 : 400,
                  }}
                >{f.label}</button>
              ))}
            </div>
            {isSuper && (
              <button className="btn" onClick={openCreate}>+ {t('adminThemes.create')}</button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('common.loading')}</div>
          ) : filtered.length === 0 ? (
            <div style={{
              padding: '60px', textAlign: 'center', color: 'var(--text-secondary)',
              background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)',
            }}>{t('adminThemes.empty')}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {filtered.map((th) => {
                const badge = statusBadge(th);
                const type = computeThemeType(th);
                const typeBadge = themeTypeBadge(type, t);
                const iconEntries = Object.entries(th.icons || {});
                return (
                  <div key={th._id} style={{
                    background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)',
                    padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px',
                    opacity: th.enabled || !th.isSystem ? 1 : 0.55,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {th.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '10px', padding: '1px 7px', borderRadius: '999px', fontWeight: 600,
                            background: typeBadge.bg, color: typeBadge.fg, whiteSpace: 'nowrap',
                          }}>{typeBadge.icon} {typeBadge.text}</span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '11px', padding: '2px 10px', borderRadius: '999px',
                        background: badge.bg, color: badge.fg, fontWeight: 600, flexShrink: 0,
                      }}>{badge.text}</span>
                    </div>

                    {/* 壁纸缩略预览 */}
                    {(th.wallpaperThumb || th.wallpaperUrl) && (
                      <div style={{
                        aspectRatio: '21 / 9', borderRadius: '8px', border: '1px solid var(--border)',
                        backgroundImage: `url(${th.wallpaperThumb || th.wallpaperUrl})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                      }} />
                    )}

                    {/* 图标预览（最多 8 个） */}
                    {iconEntries.length > 0 ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {iconEntries.slice(0, 8).map(([key, url]) => (
                          <span key={key} title={key} style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '28px', borderRadius: '6px',
                            background: 'var(--hover-bg)', border: '1px solid var(--border)',
                            color: 'var(--foreground)',
                          }}>
                            <SvgIconPreview url={url} size={17} />
                          </span>
                        ))}
                        {iconEntries.length > 8 && (
                          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>+{iconEntries.length - 8}</span>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{t('adminThemes.noContent')}</div>
                    )}

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {th.description || t('adminThemes.noDesc')}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                      <button className="btn" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => openEdit(th)}>
                        {t('common.edit')}
                      </button>
                      {isSuper && th.isSystem && (
                        <button
                          type="button"
                          title={t('adminThemes.defaultToggle')}
                          disabled={!th.enabled && !th.isDefault}
                          onClick={() => handleSetDefault(th, !th.isDefault)}
                          style={{
                            width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer',
                            background: th.isDefault ? 'var(--primary)' : 'var(--hover-bg)',
                            position: 'relative', transition: 'background 0.2s', padding: 0, flexShrink: 0,
                            opacity: (!th.enabled && !th.isDefault) ? 0.5 : 1,
                          }}
                        >
                          <span style={{
                            position: 'absolute', top: '2px', left: th.isDefault ? '21px' : '2px',
                            width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }} />
                        </button>
                      )}
                      {th.isSystem && (
                        <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleToggleEnabled(th)}>
                          {th.enabled ? t('common.disable') : t('common.enable')}
                        </button>
                      )}
                      {th.status === 'pending' && (
                        <Link to="/admin/theme-review" className="btn" style={{ padding: '5px 10px', fontSize: '12px', background: 'var(--warning-bg-strong)', borderColor: 'var(--warning-border)', color: 'var(--warning-text)', textDecoration: 'none' }}>
                          {t('adminThemes.goReview')}
                        </Link>
                      )}
                      {isSuper && (
                        <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleToggleSystem(th)}>
                          {th.isSystem ? t('adminThemes.toPersonal') : t('adminThemes.toSystem')}
                        </button>
                      )}
                      <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px', color: 'var(--destructive-text)', borderColor: 'var(--destructive-border)' }} onClick={() => handleDelete(th)}>
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {/* 主题编辑器 */}
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
        title={editingTheme ? t('adminThemes.editTitle', { name: editingTheme.name }) : t('adminThemes.createTitle')}
      />
    </div>
  );
};

export default AdminThemes;
