import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import Modal from './Modal';
import API from '../utils/apiEndpoints';
import { ICON_COMPONENT_KEYS, SvgIconPreview } from '../contexts/IconContext';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

/**
 * computeThemeType 由主题内容推导类型：full（壁纸+图标全套）/
 * wallpaper（仅壁纸）/ icons（仅图标）/ legacy（旧版配色主题，无内容）。
 */
export const computeThemeType = (theme) => {
  const hasWallpaper = !!theme?.wallpaperUrl;
  const hasIcons = theme?.icons && Object.keys(theme.icons).length > 0;
  if (hasWallpaper && hasIcons) return 'full';
  if (hasWallpaper) return 'wallpaper';
  if (hasIcons) return 'icons';
  return 'legacy';
};

/** 类型徽章样式（主题卡片/编辑器共用）。 */
export const themeTypeBadge = (type, t) => {
  switch (type) {
    case 'full':
      return { text: t('themeEditor.typeFull'), bg: 'var(--primary-bg)', fg: 'var(--primary)', icon: '✨' };
    case 'wallpaper':
      return { text: t('themeEditor.typeWallpaper'), bg: 'var(--info-bg)', fg: 'var(--info-text)', icon: '🖼️' };
    case 'icons':
      return { text: t('themeEditor.typeIcons'), bg: 'var(--success-bg)', fg: 'var(--success-text)', icon: '🎯' };
    default:
      return { text: t('themeEditor.typeLegacy'), bg: 'var(--hover-bg)', fg: 'var(--text-secondary)', icon: '🕘' };
  }
};

const URL_RE = /^(\/uploads\/|https?:\/\/)/;

/**
 * ThemeEditorModal 主题编辑器（壁纸 + 图标组合包，管理后台与用户主题工坊共用）。
 *
 * 主题类型：仅壁纸 / 仅图标 / 壁纸+图标全套，至少包含其一。
 *
 * props:
 *   - isOpen / onClose：弹窗开关
 *   - initial：{ name, description, wallpaperUrl, wallpaperThumb, icons } 初始值
 *   - onSave(payload)：保存回调（payload 同 initial 结构）
 *   - saving：保存中状态（禁用按钮）
 *   - title：弹窗标题
 */
const ThemeEditorModal = ({ isOpen, onClose, initial, onSave, saving = false, title }) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [wallpaperUrl, setWallpaperUrl] = useState('');
  const [wallpaperThumb, setWallpaperThumb] = useState('');
  const [icons, setIcons] = useState({});
  // 主题色（选填）：useAccent 开关 + 颜色值；关闭时保存为空串（不改变用户主题色）。
  const [useAccent, setUseAccent] = useState(false);
  const [accentColor, setAccentColor] = useState('#6366f1');
  // 内容构成开关：包含壁纸 / 包含图标（决定主题为仅背景、仅图标还是全套；
  // 关闭的部分不进保存内容，即便素材已选）。
  const [includeWallpaper, setIncludeWallpaper] = useState(true);
  const [includeIcons, setIncludeIcons] = useState(true);
  const [error, setError] = useState('');
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  // 素材库：系统壁纸 / 个人壁纸 / 图标库。
  const [systemWallpapers, setSystemWallpapers] = useState([]);
  const [personalWallpapers, setPersonalWallpapers] = useState([]);
  const [iconLibrary, setIconLibrary] = useState([]);

  // 图标选择器弹窗（pickingKey 为正在挑选的组件 key）。
  const [pickingKey, setPickingKey] = useState(null);
  const wallpaperInputRef = useRef(null);
  const iconInputRef = useRef(null);

  // 打开时用 initial 重置表单。
  useEffect(() => {
    if (isOpen) {
      setName(initial?.name || '');
      setDescription(initial?.description || '');
      setWallpaperUrl(initial?.wallpaperUrl || '');
      setWallpaperThumb(initial?.wallpaperThumb || '');
      setIcons({ ...(initial?.icons || {}) });
      const initialAccent = initial?.accentColor || '';
      setUseAccent(!!initialAccent);
      setAccentColor(initialAccent || '#6366f1');
      // 内容构成由初始内容推导（有壁纸则含壁纸，有图标则含图标）；
      // 新建（无内容）时默认两者都开，用户可自由关掉其一做仅壁纸/仅图标主题
      // ——若默认全关，先打开的那个会被"至少一项"约束锁死关不上。
      const hasWp = !!(initial?.wallpaperUrl);
      const hasIc = !!(initial?.icons && Object.keys(initial.icons).length > 0);
      setIncludeWallpaper(hasWp || hasIc ? hasWp : true);
      setIncludeIcons(hasWp || hasIc ? hasIc : true);
      setError('');
    }
  }, [isOpen, initial]);

  // 打开时拉取素材库。
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    axios.get(API.WALLPAPERS.SYSTEM).then((res) => {
      if (!cancelled) setSystemWallpapers(res.data || []);
    }).catch(() => {});
    if (user) {
      axios.get(API.WALLPAPERS.PERSONAL).then((res) => {
        if (!cancelled) setPersonalWallpapers(res.data || []);
      }).catch(() => {});
    }
    axios.get(API.ICONS.LIST).then((res) => {
      if (!cancelled) setIconLibrary(res.data?.icons || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen, user]);

  // 有效类型按「开关 + 实际内容」推导（关闭的部分不参与保存）。
  const type = useMemo(
    () => computeThemeType({ wallpaperUrl: includeWallpaper ? wallpaperUrl : '', icons: includeIcons ? icons : {} }),
    [wallpaperUrl, icons, includeWallpaper, includeIcons],
  );
  const badge = themeTypeBadge(type, t);
  const iconCount = Object.keys(icons).length;

  // ---- 壁纸选择 ----
  const pickWallpaper = (url, thumb) => {
    setWallpaperUrl(url);
    setWallpaperThumb(thumb || url);
  };

  const handleUploadWallpaper = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingWallpaper(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      // 走个人壁纸接口：上传即保存到「我的壁纸」（≤20 张），后续做主题可复用。
      const res = await axios.post(API.WALLPAPERS.PERSONAL, fd);
      if (URL_RE.test(res.data?.url || '')) {
        pickWallpaper(res.data.url, '');
        // 同步进个人壁纸列表（网格立即可见，无需重开弹窗）。
        setPersonalWallpapers((prev) => [
          { _id: `local-${res.data.url}`, url: res.data.url, name: res.data.name || '', addedAt: res.data.addedAt },
          ...prev,
        ]);
      } else {
        setError(t('themeEditor.uploadFailed'));
      }
    } catch (err) {
      setError(err.response?.data?.message || t('themeEditor.uploadFailed'));
    } finally {
      setUploadingWallpaper(false);
    }
  };

  // ---- 图标选择 ----
  const setIcon = (key, url) => setIcons((prev) => {
    const next = { ...prev };
    if (url) next[key] = url; else delete next[key];
    return next;
  });

  const handleUploadIcon = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pickingKey) return;
    setUploadingIcon(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(API.THEMES.UPLOAD_ICON, fd);
      if (URL_RE.test(res.data?.url || '')) setIcon(pickingKey, res.data.url);
      else setError(t('themeEditor.uploadFailed'));
    } catch (err) {
      setError(err.response?.data?.message || t('themeEditor.uploadFailed'));
    } finally {
      setUploadingIcon(false);
    }
  };

  // ---- 导入导出 ----
  const handleExport = () => {
    const payload = {
      name: name.trim(), description: description.trim(),
      wallpaperUrl, wallpaperThumb, icons,
      accentColor: useAccent ? accentColor : '',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `theme-${(name.trim() || 'untitled').replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (typeof data !== 'object' || !data) throw new Error('invalid');
        if (typeof data.name === 'string') setName(data.name.trim());
        if (typeof data.description === 'string') setDescription(data.description);
        if (typeof data.wallpaperUrl === 'string' && URL_RE.test(data.wallpaperUrl)) {
          setWallpaperUrl(data.wallpaperUrl);
          setWallpaperThumb(typeof data.wallpaperThumb === 'string' && URL_RE.test(data.wallpaperThumb) ? data.wallpaperThumb : data.wallpaperUrl);
        }
        if (data.icons && typeof data.icons === 'object') {
          const next = {};
          for (const [k, v] of Object.entries(data.icons)) {
            if (/^[a-zA-Z][\w.-]*$/.test(k) && typeof v === 'string' && URL_RE.test(v) && v.length <= 500) next[k] = v;
          }
          setIcons(next);
        }
        setError('');
      } catch {
        setError(t('themeEditor.importInvalid'));
      }
    };
    reader.readAsText(file);
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setError(t('themeEditor.nameRequired')); return; }
    if (trimmedName.length > 30) { setError(t('themeEditor.nameTooLong')); return; }
    if (description.length > 200) { setError(t('themeEditor.descTooLong')); return; }
    if (type === 'legacy') { setError(t('themeEditor.contentRequired')); return; }
    onSave({
      name: trimmedName,
      description: description.trim(),
      // 关闭的部分输出为空（主题类型随之确定）。
      wallpaperUrl: includeWallpaper ? wallpaperUrl : '',
      wallpaperThumb: includeWallpaper ? wallpaperThumb : '',
      icons: includeIcons ? icons : {},
      accentColor: useAccent ? accentColor : '',
    });
  };

  // ---- 壁纸网格 ----
  const wallpaperGrid = (list, kind) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
      {list.map((wp) => {
        const url = kind === 'system' ? wp.url : wp.url;
        const thumb = kind === 'system' ? (wp.thumbnailUrl || wp.url) : wp.url;
        const selected = wallpaperUrl === url;
        return (
          <button
            key={`${kind}-${wp._id || url}`}
            type="button"
            onClick={() => pickWallpaper(url, thumb)}
            title={wp.name || url}
            style={{
              position: 'relative', aspectRatio: '16 / 9', borderRadius: '6px', overflow: 'hidden',
              cursor: 'pointer', border: 'none', padding: 0, width: '100%', display: 'block',
              outline: selected ? '2px solid var(--primary)' : '2px solid transparent',
              outlineOffset: '-2px', transition: 'transform 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center',
            }} />
            {selected && (
              <div style={{
                position: 'absolute', top: '3px', right: '3px', width: '14px', height: '14px',
                borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: '9px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✓</div>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="860px">
      <div className="modal-header">
        <h3>{title || t('themeEditor.title')}</h3>
        <button className="btn btn-secondary" onClick={onClose}>{t('common.close')}</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* 名称 / 描述 / 类型 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '12px', alignItems: 'start' }}>
          <div>
            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label>{t('themeEditor.name')}</label>
              <input
                type="text" value={name} maxLength={30}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('themeEditor.namePlaceholder')}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>{t('themeEditor.description')}</label>
              <input
                type="text" value={description} maxLength={200}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('themeEditor.descPlaceholder')}
              />
            </div>
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
            padding: '10px 14px', borderRadius: '10px', background: badge.bg,
            border: '1px solid var(--border)', minWidth: '90px',
          }}>
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{badge.icon}</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: badge.fg, whiteSpace: 'nowrap' }}>{badge.text}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{t('themeEditor.typeLabel')}</span>
          </div>
        </div>

        {/* 内容构成开关：包含壁纸 / 包含图标（决定主题类型） */}
        <div style={{
          background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>{t('themeEditor.composeTitle')}</div>
          {[
            { label: `🖼️ ${t('themeEditor.composeWallpaper')}`, value: includeWallpaper, toggle: () => {
              const next = !includeWallpaper;
              if (!next && !includeIcons) { setError(t('themeEditor.composeAtLeastOne')); return; }
              setError('');
              setIncludeWallpaper(next);
            } },
            { label: `🎯 ${t('themeEditor.composeIcons')}`, value: includeIcons, toggle: () => {
              const next = !includeIcons;
              if (!next && !includeWallpaper) { setError(t('themeEditor.composeAtLeastOne')); return; }
              setError('');
              setIncludeIcons(next);
            } },
          ].map(({ label, value, toggle }) => (
            <button
              key={label}
              type="button"
              onClick={toggle}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                background: 'none', border: 'none', padding: 0, fontSize: '12px', fontWeight: 600,
                color: 'var(--foreground)',
              }}
            >
              <span style={{
                width: '36px', height: '20px', borderRadius: '10px', flexShrink: 0,
                background: value ? 'var(--primary)' : 'var(--bg-tertiary)',
                position: 'relative', transition: 'background 0.2s',
              }}>
                <span style={{
                  position: 'absolute', top: '2px', left: value ? '19px' : '2px',
                  width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </span>
              {label}
            </button>
          ))}
        </div>

        {/* 壁纸区 */}
        {includeWallpaper && (
        <div style={{
          background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '14px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>
              🖼️ {t('themeEditor.wallpaperSection')}
              <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '6px' }}>
                {wallpaperUrl ? '' : t('themeEditor.wallpaperNone')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                ref={wallpaperInputRef} type="file" accept="image/*"
                onChange={handleUploadWallpaper} style={{ display: 'none' }}
              />
              <button
                type="button" className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '4px 10px' }}
                disabled={uploadingWallpaper}
                onClick={() => wallpaperInputRef.current?.click()}
              >{uploadingWallpaper ? '⏳' : `⬆ ${t('themeEditor.wallpaperUpload')}`}</button>
              {wallpaperUrl && (
                <button
                  type="button" className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 10px', color: 'var(--destructive-text)', borderColor: 'var(--destructive-border)' }}
                  onClick={() => { setWallpaperUrl(''); setWallpaperThumb(''); }}
                >✕ {t('themeEditor.wallpaperClear')}</button>
              )}
            </div>
          </div>
          {wallpaperUrl && (
            <div style={{
              position: 'relative', aspectRatio: '21 / 9', borderRadius: '8px', overflow: 'hidden',
              marginBottom: '10px', border: '1px solid var(--border)',
              backgroundImage: `url(${wallpaperUrl})`, backgroundSize: 'cover', backgroundPosition: 'center',
            }} />
          )}
          <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {systemWallpapers.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>🌍 {t('themeEditor.wallpaperSystem')}</div>
                {wallpaperGrid(systemWallpapers, 'system')}
              </div>
            )}
            {user && personalWallpapers.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>👤 {t('themeEditor.wallpaperPersonal')}</div>
                {wallpaperGrid(personalWallpapers, 'personal')}
              </div>
            )}
          </div>
        </div>
        )}

        {/* 图标区（关闭「包含图标」时整块隐藏） */}
        {includeIcons && (
        <div style={{
          background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '14px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>
              🎯 {t('themeEditor.iconsSection')}
              <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '6px' }}>
                {iconCount > 0 ? t('themeEditor.iconsCount', { count: iconCount }) : t('themeEditor.iconsNone')}
              </span>
            </div>
            {iconCount > 0 && (
              <button
                type="button" className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '4px 10px', color: 'var(--destructive-text)', borderColor: 'var(--destructive-border)' }}
                onClick={() => setIcons({})}
              >✕ {t('themeEditor.iconsClearAll')}</button>
            )}
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {ICON_COMPONENT_KEYS.map(({ key, label }) => {
              const url = icons[key];
              return (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px',
                  borderRadius: '8px', background: url ? 'var(--primary-bg-subtle)' : 'var(--hover-bg)',
                  border: `1px solid ${url ? 'var(--primary-border-subtle)' : 'var(--border)'}`,
                  transition: 'background 0.2s',
                }}>
                  <SvgIconPreview url={url} size={22} />
                  <span style={{ fontSize: '12px', color: 'var(--foreground)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                  <button
                    type="button" className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '3px 10px', flexShrink: 0 }}
                    onClick={() => setPickingKey(key)}
                  >{url ? t('themeEditor.iconChange') : `+ ${t('themeEditor.iconPick')}`}</button>
                  {url && (
                    <button
                      type="button" className="btn btn-secondary"
                      style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--destructive-text)', borderColor: 'var(--destructive-border)', flexShrink: 0 }}
                      onClick={() => setIcon(key, null)}
                    >✕</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* 主题色（选填） */}
        <div style={{
          background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '14px',
          display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>🎨 {t('themeEditor.accentColorLabel')}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.5 }}>
              {t('themeEditor.accentColorDesc')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setUseAccent((v) => !v)}
              style={{
                width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer',
                background: useAccent ? 'var(--primary)' : 'var(--hover-bg)',
                position: 'relative', transition: 'background 0.2s', padding: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: '2px', left: useAccent ? '21px' : '2px',
                width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
            {useAccent && (
              <>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer', padding: 0, background: 'transparent' }}
                />
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{accentColor}</span>
              </>
            )}
          </div>
        </div>

        {/* 导入导出 */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={handleExport}>
            ⬇ {t('themeEditor.export')}
          </button>
          <label className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer' }}>
            ⬆ {t('themeEditor.import')}
            <input type="file" accept=".json,application/json" onChange={handleImportFile} style={{ display: 'none' }} />
          </label>
        </div>

        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="form-group" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn" onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>

      {/* 图标选择器：图标库 + 上传 */}
      <Modal isOpen={!!pickingKey} onClose={() => setPickingKey(null)} maxWidth="520px">
        <div className="modal-header">
          <h3>{t('themeEditor.iconPickTitle')}</h3>
          <button className="btn btn-secondary" onClick={() => setPickingKey(null)}>{t('common.close')}</button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
          {ICON_COMPONENT_KEYS.find((k) => k.key === pickingKey)?.label}
          <span style={{ fontFamily: 'monospace', marginLeft: '6px', color: 'var(--text-tertiary)' }}>{pickingKey}</span>
        </p>
        <input ref={iconInputRef} type="file" accept=".svg" onChange={handleUploadIcon} style={{ display: 'none' }} />
        <div style={{ marginBottom: '10px' }}>
          <button
            type="button" className="btn"
            style={{ fontSize: '12px', padding: '6px 12px' }}
            disabled={uploadingIcon}
            onClick={() => iconInputRef.current?.click()}
          >{uploadingIcon ? '⏳' : `⬆ ${t('themeEditor.iconUpload')}`}</button>
        </div>
        <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
          {iconLibrary.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
              {t('themeEditor.iconLibEmpty')}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '8px' }}>
              {iconLibrary.map((ic) => (
                <button
                  key={ic._id || ic.url}
                  type="button"
                  title={ic.name}
                  onClick={() => { setIcon(pickingKey, ic.url); setPickingKey(null); }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                    padding: '10px 6px', borderRadius: '8px', cursor: 'pointer',
                    background: 'var(--hover-bg)', border: '1px solid var(--border)',
                    color: 'var(--foreground)', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary-border)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <SvgIconPreview url={ic.url} size={26} />
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ic.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </Modal>
  );
};

export default ThemeEditorModal;
