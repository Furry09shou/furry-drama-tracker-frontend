import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import API from '../utils/apiEndpoints';
import { THEME_SELECTION_CHANGED_EVENT } from '../contexts/IconContext';
import { computeThemeType, themeTypeBadge } from './ThemeEditorModal';

/**
 * 左下角外观悬浮面板（无需登录即可使用外观设置；主题应用需登录）。
 *
 * 两个板块：
 *   - 外观：深浅模式（跟随系统 / 浅色 / 深色）+ 主题色（预设 + 自定义）细分小节；
 *   - 主题：系统主题 + 我的主题（登录）快捷应用 + 前往制作个人主题的入口。
 */
const ThemeColorPicker = () => {
  const { t } = useI18n();
  const { user, updateUser } = useAuth();
  const { accentColor, setAccentColor, presetColors, themeMode, setThemeModeTo } = useTheme();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('appearance'); // appearance / theme
  const pickerRef = useRef(null);

  // 主题市场（公开系统主题 + 我的主题）与当前两槽选择。
  const [themes, setThemes] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all'); // all / wallpaper / icons / full
  const [selection, setSelection] = useState({ wallpaperThemeId: null, iconsThemeId: null });
  const [applyingId, setApplyingId] = useState(null);
  const [themeMsg, setThemeMsg] = useState('');
  // 全套主题应用时的组合选择（choiceFor 为待选择的主题 id）。
  const [choiceFor, setChoiceFor] = useState(null);
  // 背景调整（透明度/模糊/开关，跟随用户 backgroundPrefs）。
  const [bgSaving, setBgSaving] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 打开主题 tab 时拉取系统主题 + 我的主题（登录）与当前选择。
  const fetchThemes = useCallback(async () => {
    try {
      const reqs = [axios.get(API.THEMES.LIST)];
      if (user) reqs.push(axios.get(API.THEMES.MY));
      const [sysRes, myRes] = await Promise.all(reqs);
      const system = sysRes.data || [];
      const mine = user ? (myRes?.data || []) : [];
      // 我的主题打「我的」标记（个人草稿/审核中均可应用）在前，系统主题在后；
      // 旧版配色主题无壁纸与图标内容、无法应用，不进面板列表。
      setThemes([
        ...mine.map((th) => ({ ...th, isMine: true })),
        ...system,
      ].filter((th) => (th.themeType || computeThemeType(th)) !== 'legacy'));
    } catch { /* 忽略 */ }
    if (user) {
      try {
        const sel = await axios.get(API.THEMES.MY_SELECTION);
        // 两槽回落站点默认主题不算用户的选择（不高亮，只做兜底）。
        setSelection({
          wallpaperThemeId: sel.data?.wallpaperIsDefault ? null : sel.data?.wallpaperTheme?._id || null,
          iconsThemeId: sel.data?.iconsIsDefault ? null : sel.data?.iconsTheme?._id || null,
        });
      } catch { /* 忽略 */ }
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && activeTab === 'theme') fetchThemes();
  }, [isOpen, activeTab, fetchThemes]);

  // 应用主题到指定槽（登录）。part: 'wallpaper' | 'icons' | 'both'。
  // 仅图标主题的背景不动、仅背景主题的图标不动，可自由组合主题A背景+主题B图标。
  const applyTheme = async (theme, part) => {
    if (!user) {
      setThemeMsg(t('colorPicker.needLogin'));
      return;
    }
    setApplyingId(theme._id);
    setThemeMsg('');
    setChoiceFor(null);
    try {
      const body = {};
      if (part === 'wallpaper' || part === 'both') body.wallpaperThemeId = theme._id;
      if (part === 'icons' || part === 'both') body.iconsThemeId = theme._id;
      const res = await axios.put(API.THEMES.SELECTION, body);
      setSelection((prev) => ({
        wallpaperThemeId: part === 'wallpaper' || part === 'both' ? theme._id : prev.wallpaperThemeId,
        iconsThemeId: part === 'icons' || part === 'both' ? theme._id : prev.iconsThemeId,
      }));
      if (res.data?.backgroundPrefs) {
        updateUser((prev) => ({ ...prev, backgroundPrefs: res.data.backgroundPrefs }));
      }
      // 主题带主题色则应用（有则更改，无则保持）。
      if (res.data?.accentColor && /^#[0-9a-fA-F]{6}$/.test(res.data.accentColor)) {
        setAccentColor(res.data.accentColor);
      }
      window.dispatchEvent(new Event(THEME_SELECTION_CHANGED_EVENT));
      setThemeMsg(t('colorPicker.applied', { name: theme.name }));
      setTimeout(() => setThemeMsg(''), 2500);
    } catch (err) {
      setThemeMsg(err.response?.data?.message || t('themeWorkshop.applyFailed'));
    } finally {
      setApplyingId(null);
    }
  };

  // 点击主题卡片：按类型分派（全套弹出组合选择，其余直接应用对应槽）。
  const handleThemeClick = (theme) => {
    if (applyingId) return;
    const type = theme.themeType || computeThemeType(theme);
    if (type === 'wallpaper') return applyTheme(theme, 'wallpaper');
    if (type === 'icons') return applyTheme(theme, 'icons');
    if (type === 'legacy') return;
    setChoiceFor(choiceFor === theme._id ? null : theme._id);
  };

  // 取消主题（两槽都清空，回退站点默认）。
  const resetTheme = async () => {
    setApplyingId('reset');
    setThemeMsg('');
    try {
      const res = await axios.put(API.THEMES.SELECTION, {
        wallpaperThemeId: '',
        iconsThemeId: '',
      });
      setSelection({ wallpaperThemeId: null, iconsThemeId: null });
      // 同步被清除的壁纸偏好，前端壁纸立即回落站点默认主题。
      if (res.data?.backgroundPrefs) {
        updateUser((prev) => ({ ...prev, backgroundPrefs: res.data.backgroundPrefs }));
      }
      window.dispatchEvent(new Event(THEME_SELECTION_CHANGED_EVENT));
      setThemeMsg(t('themeWorkshop.resetSuccess'));
      setTimeout(() => setThemeMsg(''), 2500);
    } catch (err) {
      setThemeMsg(err.response?.data?.message || t('themeWorkshop.applyFailed'));
    } finally {
      setApplyingId(null);
    }
  };

  // 背景调整（透明度/模糊/开关）：写回后端偏好，同步本地 user 即时生效。
  const saveBgPrefs = async (patch) => {
    if (!user || bgSaving) return;
    setBgSaving(true);
    try {
      const res = await axios.put(API.THEMES.BACKGROUND_PREFS, patch);
      if (res.data?.backgroundPrefs) {
        updateUser((prev) => ({ ...prev, backgroundPrefs: res.data.backgroundPrefs }));
      }
    } catch (err) {
      setThemeMsg(err.response?.data?.message || t('colorPicker.bgSaveFailed'));
      setTimeout(() => setThemeMsg(''), 2500);
    } finally {
      setBgSaving(false);
    }
  };

  const tabs = [
    { key: 'appearance', icon: '🎨', label: t('colorPicker.tabAppearance') },
    { key: 'theme', icon: '🖼️', label: t('colorPicker.tabTheme') },
  ];

  // 顺序：跟随系统第一位（也是默认值），其次浅色 / 深色。
  const appearanceOptions = [
    { mode: 'system', icon: '💻', label: t('settings.themeSystem') },
    { mode: 'light', icon: '☀️', label: t('settings.themeLight') },
    { mode: 'dark', icon: '🌙', label: t('settings.themeDark') },
  ];

  return (
    <div ref={pickerRef} style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 50 }}>
      {isOpen && (
        <div style={{
          position: 'absolute', bottom: '48px', left: 0,
          background: 'var(--glass-bg)', backdropFilter: 'var(--glass-backdrop)',
          border: '1px solid var(--glass-border)', borderRadius: '14px',
          padding: '12px', width: 'min(300px, calc(100vw - 40px))',
          boxShadow: '0 8px 32px var(--shadow-modal)',
          display: 'flex', flexDirection: 'column', gap: '10px',
          animation: 'fadeIn 0.2s',
        }}>
          {/* Tab 切换 */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--hover-bg)', borderRadius: '9px', padding: '3px' }}>
            {tabs.map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  flex: 1, border: 'none', cursor: 'pointer', padding: '6px 4px',
                  borderRadius: '7px', fontSize: '11px', fontWeight: 600,
                  background: activeTab === key ? 'var(--card)' : 'transparent',
                  color: activeTab === key ? 'var(--foreground)' : 'var(--text-secondary)',
                  transition: 'all 0.2s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >{icon} {label}</button>
            ))}
          </div>

          {/* 外观 tab：深浅模式 + 主题色两节 */}
          {activeTab === 'appearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '2px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {appearanceOptions.map(({ mode, icon, label }) => {
                  const active = themeMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => setThemeModeTo(mode)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                        padding: '10px 4px', borderRadius: '9px', cursor: 'pointer',
                        background: active ? 'var(--primary-bg)' : 'var(--hover-bg)',
                        border: `1px solid ${active ? 'var(--primary-border)' : 'var(--border)'}`,
                        color: 'var(--foreground)', transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ fontSize: '16px', lineHeight: 1 }}>{icon}</span>
                      <span style={{ fontSize: '10px', fontWeight: 600 }}>{label}</span>
                    </button>
                  );
                })}
              </div>
              {/* 主题色小节 */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>🎨 {t('colorPicker.tabColor')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setAccentColor(color)}
                      style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: color,
                        border: accentColor === color ? '2px solid var(--foreground)' : '2px solid transparent',
                        cursor: 'pointer', transition: 'all 0.2s',
                        outline: 'none', padding: 0, boxShadow: accentColor === color ? `0 0 0 2px var(--background), 0 0 0 4px ${color}` : 'none',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    style={{ width: '28px', height: '28px', border: 'none', borderRadius: '6px', cursor: 'pointer', padding: 0, background: 'transparent' }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('settings.customColor')}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace', marginLeft: 'auto' }}>{accentColor}</span>
                </div>
              </div>
            </div>
          )}

          {/* 主题 tab */}
          {activeTab === 'theme' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '2px', maxHeight: '320px', overflowY: 'auto' }}>
              {!user && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                  padding: '8px 10px', borderRadius: '9px',
                  background: 'var(--warning-bg-subtle)', border: '1px solid var(--warning-border)',
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--warning-text)', lineHeight: 1.4 }}>{t('colorPicker.needLoginHint')}</span>
                  <button
                    onClick={() => navigate('/login')}
                    className="btn"
                    style={{ fontSize: '11px', padding: '4px 10px', flexShrink: 0 }}
                  >{t('nav.login')}</button>
                </div>
              )}

              {/* 背景调整：透明度 / 模糊 / 单独关闭（不影响图标） */}
              {user && user.backgroundPrefs?.image && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '6px',
                  padding: '8px 10px', borderRadius: '9px', background: 'var(--hover-bg)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>{t('colorPicker.bgAdjust')}</span>
                    <button
                      type="button"
                      onClick={() => saveBgPrefs({ enabled: !user.backgroundPrefs.enabled })}
                      disabled={bgSaving}
                      style={{
                        width: '34px', height: '18px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                        background: user.backgroundPrefs.enabled ? 'var(--primary)' : 'var(--bg-tertiary)',
                        position: 'relative', transition: 'background 0.2s', padding: 0, flexShrink: 0,
                      }}
                      title={t('colorPicker.bgToggle')}
                    >
                      <span style={{
                        position: 'absolute', top: '2px', left: user.backgroundPrefs.enabled ? '18px' : '2px',
                        width: '14px', height: '14px', borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                  {user.backgroundPrefs.enabled && (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                        {t('colorPicker.bgOpacity')}
                        <input
                          type="range" min="0" max="100" step="5"
                          defaultValue={user.backgroundPrefs.opacity ?? 30}
                          onChange={(e) => updateUser((prev) => ({
                            ...prev,
                            backgroundPrefs: { ...prev.backgroundPrefs, opacity: Number(e.target.value) },
                          }))}
                          onPointerUp={(e) => saveBgPrefs({ opacity: Number(e.currentTarget.value) })}
                          onTouchEnd={(e) => saveBgPrefs({ opacity: Number(e.currentTarget.value) })}
                          style={{ flex: 1, height: '14px', cursor: 'pointer' }}
                        />
                        <span style={{ fontFamily: 'monospace', minWidth: '24px', textAlign: 'right' }}>{user.backgroundPrefs.opacity ?? 30}</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                        {t('colorPicker.bgBlur')}
                        <input
                          type="range" min="0" max="40" step="1"
                          defaultValue={user.backgroundPrefs.blur ?? 0}
                          onChange={(e) => updateUser((prev) => ({
                            ...prev,
                            backgroundPrefs: { ...prev.backgroundPrefs, blur: Number(e.target.value) },
                          }))}
                          onPointerUp={(e) => saveBgPrefs({ blur: Number(e.currentTarget.value) })}
                          onTouchEnd={(e) => saveBgPrefs({ blur: Number(e.currentTarget.value) })}
                          style={{ flex: 1, height: '14px', cursor: 'pointer' }}
                        />
                        <span style={{ fontFamily: 'monospace', minWidth: '24px', textAlign: 'right' }}>{user.backgroundPrefs.blur ?? 0}</span>
                      </label>
                    </>
                  )}
                </div>
              )}

              {/* 类型筛选 */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { key: 'all', label: t('colorPicker.filterAll') },
                  { key: 'wallpaper', label: t('colorPicker.filterWallpaper') },
                  { key: 'icons', label: t('colorPicker.filterIcons') },
                  { key: 'full', label: t('colorPicker.filterFull') },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTypeFilter(key)}
                    style={{
                      flex: 1, padding: '4px 2px', borderRadius: '7px', cursor: 'pointer',
                      fontSize: '10px', fontWeight: 600,
                      background: typeFilter === key ? 'var(--primary-bg)' : 'var(--hover-bg)',
                      color: typeFilter === key ? 'var(--primary)' : 'var(--text-secondary)',
                      border: `1px solid ${typeFilter === key ? 'var(--primary-border)' : 'transparent'}`,
                      transition: 'all 0.2s', whiteSpace: 'nowrap',
                    }}
                  >{label}</button>
                ))}
              </div>

              {/* 主题列表：分槽标记「背景使用中 / 图标使用中」，全套主题展开组合选择 */}
              {themes.filter((th) => {
                if (typeFilter === 'all') return true;
                return (th.themeType || computeThemeType(th)) === typeFilter;
              }).map((th) => {
                const wpActive = selection.wallpaperThemeId === th._id;
                const icActive = selection.iconsThemeId === th._id;
                const active = wpActive || icActive;
                const isMine = !!th.isMine;
                const type = th.themeType || computeThemeType(th);
                const badge = themeTypeBadge(type, t);
                return (
                  <div key={th._id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button
                      onClick={() => !applyingId && handleThemeClick(th)}
                      disabled={!!applyingId}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left',
                        padding: '7px 9px', borderRadius: '9px', cursor: 'pointer',
                        background: active ? 'var(--primary-bg-subtle)' : 'var(--hover-bg)',
                        border: `1px solid ${active ? 'var(--primary-border)' : 'var(--border)'}`,
                        transition: 'all 0.2s', opacity: applyingId && applyingId !== th._id ? 0.5 : 1,
                      }}
                    >
                      <span style={{
                        width: '40px', height: '24px', borderRadius: '5px', flexShrink: 0,
                        background: th.wallpaperThumb || th.wallpaperUrl
                          ? `url(${th.wallpaperThumb || th.wallpaperUrl}) center/cover`
                          : 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                      }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {th.name}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginTop: '1px' }}>
                          {th.isDefault && !active && (
                            <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>
                              ⭐ {t('colorPicker.badgeDefault')}
                            </span>
                          )}
                          <span style={{ fontSize: '10px', color: badge.fg, fontWeight: 600 }}>
                            {isMine ? `👤 ${t('themeWorkshop.myThemes')}` : `${badge.icon} ${badge.text}`}
                          </span>
                          {wpActive && (
                            <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>
                              🖼 {t('colorPicker.wpInUse')}
                            </span>
                          )}
                          {icActive && (
                            <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>
                              🧩 {t('colorPicker.icInUse')}
                            </span>
                          )}
                        </span>
                      </span>
                      {th.accentColor && (
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: th.accentColor, flexShrink: 0, border: '1px solid var(--border)' }} />
                      )}
                      {applyingId === th._id && <span style={{ fontSize: '11px' }}>⏳</span>}
                      {type === 'full' && <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{choiceFor === th._id ? '▴' : '▾'}</span>}
                    </button>
                    {/* 全套主题的组合选择（仅背景 / 仅图标 / 全套） */}
                    {choiceFor === th._id && type === 'full' && (
                      <div style={{ display: 'flex', gap: '4px', padding: '0 4px' }}>
                        {[
                          { part: 'wallpaper', label: `🖼 ${t('colorPicker.applyWpOnly')}` },
                          { part: 'icons', label: `🧩 ${t('colorPicker.applyIcOnly')}` },
                          { part: 'both', label: `✨ ${t('colorPicker.applyBoth')}` },
                        ].map(({ part, label }) => (
                          <button
                            key={part}
                            onClick={() => applyTheme(th, part)}
                            disabled={!!applyingId}
                            className="btn"
                            style={{ flex: 1, fontSize: '10px', padding: '4px 2px', whiteSpace: 'nowrap' }}
                          >{label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {themes.length === 0 && (
                <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11px' }}>
                  {t('themeWorkshop.emptySystem')}
                </div>
              )}
              {user && (selection.wallpaperThemeId || selection.iconsThemeId) && (
                <button
                  onClick={() => !applyingId && resetTheme()}
                  disabled={!!applyingId}
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '6px 10px', color: 'var(--destructive-text)', borderColor: 'var(--destructive-border)' }}
                >✕ {t('themeWorkshop.reset')}</button>
              )}
              {themeMsg && (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.4 }}>{themeMsg}</div>
              )}
              <button
                onClick={() => (user ? navigate('/settings') : setThemeMsg(t('colorPicker.needLogin')))}
                className="btn"
                style={{ fontSize: '11px', padding: '6px 10px', marginTop: '2px' }}
              >+ {t('colorPicker.createTheme')}</button>
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'var(--glass-bg)', backdropFilter: 'var(--glass-backdrop)',
          border: '1px solid var(--glass-border)',
          cursor: 'pointer', fontSize: '18px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.3s', opacity: 0.6,
          color: 'var(--foreground)', padding: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = 'var(--primary-border)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
      >
        🎨
      </button>
    </div>
  );
};

export default ThemeColorPicker;
