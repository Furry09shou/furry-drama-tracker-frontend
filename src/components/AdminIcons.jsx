import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import adminApi from '../utils/adminApi';
import API from '../utils/apiEndpoints';
import Modal from './Modal';
import { ICON_COMPONENT_KEYS } from '../contexts/IconContext';
import { useIcons } from '../contexts/IconContext';
import { useI18n } from '../contexts/I18nContext';

/**
 * AdminIcons 图标管理页（/admin/icons）。
 *
 * 功能：
 *   - 拖拽 / 点选批量上传 SVG 图标（带分类）；
 *   - 图标分类管理（按分类筛选、编辑分类名）；
 *   - 可视化配置图标与页面组件的映射关系（多选组件标识）；
 *   - 启用/停用、删除（同步删除服务器文件）。
 */
const AdminIcons = () => {
  const { admin } = useOutletContext();
  const { t } = useI18n();
  const { refreshIcons, loadSvgContent } = useIcons();

  const [icons, setIcons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 上传状态。
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('general');
  const fileInputRef = useRef(null);

  // 筛选分类。
  const [categoryFilter, setCategoryFilter] = useState('all');

  // 编辑弹窗状态。
  const [editTarget, setEditTarget] = useState(null); // icon
  const [editForm, setEditForm] = useState({ name: '', category: '', description: '', mappings: [] });
  const [saving, setSaving] = useState(false);

  // 图标 SVG 预览缓存：url -> 清洗后的内容。
  const [svgCache, setSvgCache] = useState({});

  const notify = useCallback((msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }, []);

  const fetchIcons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get(API.ICONS.ALL);
      setIcons(res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || t('adminIcons.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (admin) fetchIcons();
  }, [admin, fetchIcons]);

  // 预加载全部图标内容用于预览。
  useEffect(() => {
    icons.forEach((ic) => {
      if (svgCache[ic.url]) return;
      loadSvgContent(ic.url).then((clean) => {
        if (clean) setSvgCache((prev) => (prev[ic.url] ? prev : { ...prev, [ic.url]: clean }));
      });
    });
  }, [icons, svgCache, loadSvgContent]);

  if (!admin) return null;

  // ---- 上传 ----
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.name.toLowerCase().endsWith('.svg'));
    if (files.length === 0) {
      setError(t('adminIcons.onlySvg'));
      return;
    }
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      form.append('category', uploadCategory.trim() || 'general');
      const res = await adminApi.post(API.ICONS.UPLOAD, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const created = res.data?.created?.length || 0;
      const failed = res.data?.failed?.length || 0;
      if (failed > 0) {
        setError(t('adminIcons.uploadPartial', { created, failed }));
      } else {
        notify(t('adminIcons.uploadSuccess', { count: created }));
      }
      fetchIcons();
      refreshIcons();
    } catch (err) {
      setError(err.response?.data?.message || t('adminIcons.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  // ---- 编辑 ----
  const openEdit = (icon) => {
    setEditTarget(icon);
    setEditForm({
      name: icon.name || '',
      category: icon.category || 'general',
      description: icon.description || '',
      mappings: icon.mappings || [],
    });
  };

  const toggleMapping = (key) => {
    setEditForm((prev) => ({
      ...prev,
      mappings: prev.mappings.includes(key)
        ? prev.mappings.filter((k) => k !== key)
        : [...prev.mappings, key],
    }));
  };

  const handleSave = async () => {
    if (!editForm.name.trim()) { setError(t('adminIcons.nameRequired')); return; }
    setSaving(true);
    try {
      await adminApi.put(API.ICONS.DETAIL(editTarget._id), {
        name: editForm.name.trim(),
        category: editForm.category.trim() || 'general',
        description: editForm.description.trim(),
        mappings: editForm.mappings,
      });
      notify(t('adminIcons.updateSuccess'));
      setEditTarget(null);
      fetchIcons();
      refreshIcons();
    } catch (err) {
      setError(err.response?.data?.message || t('adminIcons.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (icon) => {
    try {
      await adminApi.put(API.ICONS.DETAIL(icon._id), { enabled: !icon.enabled });
      fetchIcons();
      refreshIcons();
    } catch (err) {
      setError(err.response?.data?.message || t('adminIcons.opFailed'));
    }
  };

  const handleDelete = async (icon) => {
    if (!window.confirm(t('adminIcons.deleteConfirm', { name: icon.name }))) return;
    try {
      await adminApi.delete(API.ICONS.DETAIL(icon._id));
      notify(t('adminIcons.deleteSuccess'));
      fetchIcons();
      refreshIcons();
    } catch (err) {
      setError(err.response?.data?.message || t('adminIcons.deleteFailed'));
    }
  };

  // ---- 分类 ----
  const categories = ['all', ...new Set(icons.map((ic) => ic.category || 'general'))];
  const filtered = categoryFilter === 'all'
    ? icons
    : icons.filter((ic) => (ic.category || 'general') === categoryFilter);

  // 按分类分组渲染。
  const grouped = filtered.reduce((acc, ic) => {
    const cat = ic.category || 'general';
    (acc[cat] = acc[cat] || []).push(ic);
    return acc;
  }, {});

  // SVG 预览渲染（currentColor 适配主题）。
  const renderPreview = (icon, size = 32) => {
    const svg = svgCache[icon.url];
    if (svg) {
      return (
        <span
          aria-hidden="true"
          style={{ display: 'inline-flex', color: 'var(--foreground)' }}
          dangerouslySetInnerHTML={{
            __html: svg.replace('<svg', `<svg width="${size}" height="${size}" style="display:block"`),
          }}
        />
      );
    }
    return <span style={{ fontSize: size * 0.8 }}>📄</span>;
  };

  return (
    <div className="admin-panel">
      <h2 style={{ marginTop: 0, marginBottom: '20px' }}>{t('adminIcons.title')}</h2>

      {error && <div className="error-message" style={{ marginBottom: '15px' }}>{error}</div>}
      {success && (
        <div style={{
          marginBottom: '15px', padding: '10px', background: 'var(--success-bg-strong)',
          border: '1px solid var(--success-border)', borderRadius: '6px', color: 'var(--success-text)',
        }}>{success}</div>
      )}

      {/* 拖拽上传区 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: '12px',
          padding: '32px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'var(--primary-bg-subtle)' : 'var(--card)',
          transition: 'all 0.2s',
          marginBottom: '20px',
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>{uploading ? '⏳' : '📤'}</div>
        <div style={{ fontWeight: 600, marginBottom: '4px' }}>
          {uploading ? t('adminIcons.uploading') : t('adminIcons.dropHint')}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {t('adminIcons.dropSub')}
        </div>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}
        >
          <input
            type="text"
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
            maxLength={30}
            placeholder={t('adminIcons.categoryPlaceholder')}
            style={{
              padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)',
              background: 'var(--input)', color: 'var(--foreground)', fontSize: '13px', width: '140px',
            }}
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".svg,image/svg+xml"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {/* 分类筛选 */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
              background: categoryFilter === cat ? 'var(--primary-bg)' : 'var(--hover-bg)',
              color: categoryFilter === cat ? 'var(--primary)' : 'var(--foreground)',
              border: categoryFilter === cat ? '1px solid var(--primary-border)' : '1px solid var(--border)',
              fontWeight: categoryFilter === cat ? 600 : 400,
            }}
          >{cat === 'all' ? t('adminIcons.allCategories') : cat}</button>
        ))}
      </div>

      {/* 图标网格（按分类分组） */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: '60px', textAlign: 'center', color: 'var(--text-secondary)',
          background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)',
        }}>{t('adminIcons.empty')}</div>
      ) : (
        Object.entries(grouped).map(([cat, list]) => (
          <div key={cat} style={{ marginBottom: '24px' }}>
            <div style={{
              fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              📁 {cat}
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>({list.length})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {list.map((icon) => (
                <div key={icon._id} style={{
                  background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)',
                  padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px',
                  opacity: icon.enabled ? 1 : 0.55,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                      background: 'var(--hover-bg)', border: '1px solid var(--border)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>{renderPreview(icon, 28)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '13px', fontWeight: 600, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{icon.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        {icon.enabled ? '' : `⛔ ${t('adminIcons.disabled')} · `}
                        {(icon.mappings || []).length > 0
                          ? t('adminIcons.mappedCount', { count: icon.mappings.length })
                          : t('adminIcons.unmapped')}
                      </div>
                    </div>
                  </div>
                  {(icon.mappings || []).length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {icon.mappings.slice(0, 4).map((k) => (
                        <span key={k} style={{
                          fontSize: '10px', padding: '1px 8px', borderRadius: '999px',
                          background: 'var(--primary-bg)', color: 'var(--primary)',
                        }}>{k}</span>
                      ))}
                      {icon.mappings.length > 4 && (
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          +{icon.mappings.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', flexWrap: 'wrap' }}>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => openEdit(icon)}>
                      {t('common.edit')}
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleToggleEnabled(icon)}>
                      {icon.enabled ? t('common.disable') : t('common.enable')}
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--destructive-text)', borderColor: 'var(--destructive-border)' }} onClick={() => handleDelete(icon)}>
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* 编辑弹窗 */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} maxWidth="640px">
        <div className="modal-header">
          <h3>{t('adminIcons.editTitle', { name: editTarget?.name || '' })}</h3>
          <button className="btn btn-secondary" onClick={() => setEditTarget(null)}>{t('common.close')}</button>
        </div>
        {editTarget && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <span style={{
                width: '56px', height: '56px', borderRadius: '12px', flexShrink: 0,
                background: 'var(--hover-bg)', border: '1px solid var(--border)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{renderPreview(editTarget, 36)}</span>
              <a href={editTarget.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--primary)' }}>
                {editTarget.url}
              </a>
            </div>
            <div className="form-group">
              <label>{t('adminIcons.name')}</label>
              <input
                type="text" value={editForm.name} maxLength={50}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>{t('adminIcons.category')}</label>
              <input
                type="text" value={editForm.category} maxLength={30}
                placeholder="general"
                onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>{t('adminIcons.description')}</label>
              <input
                type="text" value={editForm.description} maxLength={200}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>{t('adminIcons.mappings')}</label>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                {t('adminIcons.mappingsHint')}
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '6px', maxHeight: '240px', overflowY: 'auto', padding: '2px',
              }}>
                {ICON_COMPONENT_KEYS.map((item) => {
                  const active = editForm.mappings.includes(item.key);
                  return (
                    <button
                      key={item.key} type="button"
                      onClick={() => toggleMapping(item.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'left',
                        padding: '6px 10px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
                        background: active ? 'var(--primary-bg)' : 'var(--hover-bg)',
                        color: active ? 'var(--primary)' : 'var(--foreground)',
                        border: active ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      <span style={{ flexShrink: 0 }}>{active ? '☑' : '☐'}</span>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="form-group" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setEditTarget(null)}>{t('common.cancel')}</button>
              <button className="btn" onClick={handleSave} disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default AdminIcons;
