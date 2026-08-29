import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import API from '../utils/apiEndpoints';
import ThemeEditorModal from './ThemeEditorModal';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';

/**
 * ThemeWorkshop 用户主题工坊（Settings 页内嵌）。
 *
 * 功能：
 *   - 浏览系统主题与我的个人主题，一键应用（多端同步）；
 *   - 可视化创建/编辑个人主题（实时预览、导入导出）；
 *   - 提交个人主题审核：审核通过后从个人主题升级为系统主题；
 *   - 删除个人主题。
 */
const ThemeWorkshop = () => {
  const { t } = useI18n();
  const { serverTheme, setServerTheme } = useTheme();

  const [systemThemes, setSystemThemes] = useState([]);
  const [myThemes, setMyThemes] = useState([]);
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sysRes, myRes] = await Promise.all([
        axios.get(API.THEMES.LIST),
        axios.get(API.THEMES.MY),
      ]);
      setSystemThemes(sysRes.data || []);
      setMyThemes(myRes.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || t('themeWorkshop.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const currentId = serverTheme?._id || null;

  // ---- 应用 / 取消主题 ----
  const handleApply = async (theme) => {
    try {
      const res = await axios.put(API.THEMES.SELECTION, { themeId: theme._id });
      // 立即生效：更新前端主题引擎（无需刷新页面）。
      setServerTheme(res.data?.theme || theme);
      notify(t('themeWorkshop.applied', { name: theme.name }));
    } catch (err) {
      setError(err.response?.data?.message || t('themeWorkshop.applyFailed'));
    }
  };

  const handleReset = async () => {
    try {
      await axios.put(API.THEMES.SELECTION, { themeId: '' });
      // 回退站点默认主题。
      const res = await axios.get(API.THEMES.ACTIVE);
      setServerTheme(res.data?.theme || null);
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
            const sel = await axios.put(API.THEMES.SELECTION, { themeId: created._id });
            setServerTheme(sel.data?.theme || created);
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
      if (currentId === theme._id) handleReset();
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
    const active = currentId === theme._id;
    const badge = statusBadge(theme);
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
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {theme.mode === 'light' ? '☀️' : '🌙'} {theme.description || t('themeWorkshop.noDesc')}
            </div>
          </div>
          <span style={{
            fontSize: '10px', padding: '2px 8px', borderRadius: '999px',
            background: badge.bg, color: badge.fg, fontWeight: 600, flexShrink: 0,
          }}>{badge.text}</span>
        </div>

        {/* 主题色预览条 */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {['--primary', '--secondary', '--accent', '--background', '--foreground']
            .map((k) => theme.variables?.[k])
            .filter(Boolean)
            .map((c, i) => (
              <span key={i} title={c} style={{
                width: '20px', height: '20px', borderRadius: '6px',
                background: c, border: '1px solid var(--border)',
              }} />
            ))}
        </div>

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
            <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={handleReset}>
              {t('themeWorkshop.reset')}
            </button>
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
        </div>
      )}

      {/* 主题编辑器（复用可视化编辑组件） */}
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
        title={editingTheme ? t('themeWorkshop.editTitle', { name: editingTheme.name }) : t('themeWorkshop.createTitle')}
      />
    </div>
  );
};

export default ThemeWorkshop;
