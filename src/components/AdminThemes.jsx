import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import adminApi from '../utils/adminApi';
import API from '../utils/apiEndpoints';
import Modal from './Modal';
import ThemeEditorModal from './ThemeEditorModal';
import SystemWallpaperManager from './SystemWallpaperManager';
import { useI18n } from '../contexts/I18nContext';

/**
 * AdminThemes 主题管理页（/admin/themes）。
 *
 * 功能：
 *   - 主题列表（全部 / 系统 / 个人 / 待审核 筛选），含审核、设默认、
 *     系统⇄个人切换、启用停用、删除；
 *   - 可视化创建/编辑主题（实时预览、导入导出 JSON）；
 *   - 融入原系统壁纸管理（第二个标签页）。
 */
const AdminThemes = () => {
  const { admin } = useOutletContext();
  const { t } = useI18n();
  const [tab, setTab] = useState('themes'); // themes | wallpapers
  const [themes, setThemes] = useState([]);
  const [filter, setFilter] = useState('all'); // all | system | personal | pending
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 编辑器状态。
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState(null); // null = 新建
  const [saving, setSaving] = useState(false);

  // 审核弹窗状态。
  const [reviewTarget, setReviewTarget] = useState(null); // theme
  const [reviewAction, setReviewAction] = useState('approve');
  const [reviewNote, setReviewNote] = useState('');

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

  const handleSetDefault = async (theme) => {
    try {
      await adminApi.post(API.THEMES.SET_DEFAULT(theme._id));
      notify(t('adminThemes.defaultSuccess'));
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

  const openReview = (theme, action) => {
    setReviewTarget(theme);
    setReviewAction(action);
    setReviewNote('');
  };

  const handleReview = async () => {
    try {
      await adminApi.post(API.THEMES.REVIEW(reviewTarget._id), { action: reviewAction, note: reviewNote });
      notify(reviewAction === 'approve' ? t('adminThemes.approveSuccess') : t('adminThemes.rejectSuccess'));
      setReviewTarget(null);
      fetchThemes();
    } catch (err) {
      setError(err.response?.data?.message || t('adminThemes.reviewFailed'));
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={tab === 'themes' ? 'btn' : 'btn btn-secondary'}
            onClick={() => setTab('themes')}
          >🎨 {t('adminThemes.tabThemes')}</button>
          <button
            className={tab === 'wallpapers' ? 'btn' : 'btn btn-secondary'}
            onClick={() => setTab('wallpapers')}
          >🖼️ {t('adminThemes.tabWallpapers')}</button>
        </div>
      </div>

      {error && <div className="error-message" style={{ marginBottom: '15px' }}>{error}</div>}
      {success && (
        <div style={{
          marginBottom: '15px', padding: '10px', background: 'var(--success-bg-strong)',
          border: '1px solid var(--success-border)', borderRadius: '6px', color: 'var(--success-text)',
        }}>{success}</div>
      )}

      {tab === 'wallpapers' ? (
        <SystemWallpaperManager />
      ) : (
        <>
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
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {th.mode === 'light' ? '☀️' : '🌙'} {th.description || t('adminThemes.noDesc')}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '11px', padding: '2px 10px', borderRadius: '999px',
                        background: badge.bg, color: badge.fg, fontWeight: 600, flexShrink: 0,
                      }}>{badge.text}</span>
                    </div>

                    {/* 主题色预览条 */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {['--primary', '--secondary', '--accent', '--background', '--foreground']
                        .map((k) => th.variables?.[k])
                        .filter(Boolean)
                        .map((c, i) => (
                          <span key={i} style={{
                            width: '24px', height: '24px', borderRadius: '6px',
                            background: c, border: '1px solid var(--border)',
                          }} title={c} />
                        ))}
                      {Object.keys(th.variables || {}).length === 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{t('adminThemes.noVars')}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                      <button className="btn" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => openEdit(th)}>
                        {t('common.edit')}
                      </button>
                      {th.isSystem && !th.isDefault && (
                        <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleSetDefault(th)}>
                          {t('adminThemes.setDefault')}
                        </button>
                      )}
                      {th.isSystem && (
                        <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleToggleEnabled(th)}>
                          {th.enabled ? t('common.disable') : t('common.enable')}
                        </button>
                      )}
                      {th.status === 'pending' && (
                        <>
                          <button className="btn" style={{ padding: '5px 10px', fontSize: '12px', background: 'var(--success-bg-strong)', borderColor: 'var(--success-border)', color: 'var(--success-text)' }} onClick={() => openReview(th, 'approve')}>
                            {t('adminThemes.approve')}
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px', color: 'var(--destructive-text)', borderColor: 'var(--destructive-border)' }} onClick={() => openReview(th, 'reject')}>
                            {t('adminThemes.reject')}
                          </button>
                        </>
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
        </>
      )}

      {/* 主题编辑器 */}
      <ThemeEditorModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        initial={editingTheme ? {
          name: editingTheme.name,
          description: editingTheme.description,
          mode: editingTheme.mode,
          variables: editingTheme.variables || {},
        } : null}
        onSave={handleSave}
        saving={saving}
        title={editingTheme ? t('adminThemes.editTitle', { name: editingTheme.name }) : t('adminThemes.createTitle')}
      />

      {/* 审核弹窗 */}
      <Modal isOpen={!!reviewTarget} onClose={() => setReviewTarget(null)} maxWidth="460px">
        <div className="modal-header">
          <h3>{reviewAction === 'approve' ? t('adminThemes.reviewApproveTitle') : t('adminThemes.reviewRejectTitle')}</h3>
          <button className="btn btn-secondary" onClick={() => setReviewTarget(null)}>{t('common.close')}</button>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {t('adminThemes.reviewTarget', { name: reviewTarget?.name })}
        </p>
        <div className="form-group">
          <label>{t('adminThemes.reviewNote')}</label>
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder={reviewAction === 'reject' ? t('adminThemes.rejectNotePlaceholder') : ''}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 12px', fontSize: '13px',
              borderRadius: '8px', border: '1px solid var(--border)',
              background: 'var(--input)', color: 'var(--foreground)', resize: 'vertical',
            }}
          />
        </div>
        <div className="form-group" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => setReviewTarget(null)}>{t('common.cancel')}</button>
          <button
            className="btn"
            onClick={handleReview}
            style={reviewAction === 'reject' ? { background: 'var(--destructive)', borderColor: 'var(--destructive)' } : undefined}
          >
            {reviewAction === 'approve' ? t('adminThemes.approve') : t('adminThemes.reject')}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default AdminThemes;
