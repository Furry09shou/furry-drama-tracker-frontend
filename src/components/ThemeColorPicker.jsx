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

  // 主题市场（公开系统主题）与当前选择。
  const [themes, setThemes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [applyingId, setApplyingId] = useState(null);
  const [themeMsg, setThemeMsg] = useState('');

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
      // 我的主题（个人草稿/审核中均可切换预览）在前，系统主题在后。
      setThemes([...mine, ...system]);
    } catch { /* 忽略 */ }
    if (user) {
      try {
        const sel = await axios.get(API.THEMES.MY_SELECTION);
        // isDefaultFallback：未选主题时回落站点默认主题，不算用户的选择（不高亮）。
        setSelectedId(sel.data?.isDefaultFallback ? null : sel.data?.theme?._id || null);
      } catch { /* 忽略 */ }
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && activeTab === 'theme') fetchThemes();
  }, [isOpen, activeTab, fetchThemes]);

  // 应用主题（登录）：默认全套应用（壁纸+图标+主题色，有则改）。
  const applyTheme = async (theme) => {
    if (!user) {
      setThemeMsg(t('colorPicker.needLogin'));
      return;
    }
    setApplyingId(theme._id);
    setThemeMsg('');
    try {
      const res = await axios.put(API.THEMES.SELECTION, {
        themeId: theme._id,
        applyIcons: true,
        applyWallpaper: true,
      });
      setSelectedId(theme._id);
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

  // 取消主题（回退站点默认）。
  const resetTheme = async () => {
    setApplyingId('reset');
    setThemeMsg('');
    try {
      const res = await axios.put(API.THEMES.SELECTION, { themeId: '' });
      setSelectedId(null);
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '2px', maxHeight: '300px', overflowY: 'auto' }}>
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
              {themes.map((th) => {
                const active = selectedId === th._id;
                const isMine = !!th.isMine;
                const type = computeThemeType(th);
                const badge = themeTypeBadge(type, t);
                return (
                  <button
                    key={th._id}
                    onClick={() => !applyingId && applyTheme(th)}
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
                        {th.name}{active ? ` · ${t('themeWorkshop.inUse')}` : ''}
                      </span>
                      {th.isDefault && !active && (
                        <span style={{ display: 'block', fontSize: '10px', color: 'var(--primary)', fontWeight: 600, marginTop: '1px' }}>
                          ⭐ {t('colorPicker.badgeDefault')}
                        </span>
                      )}
                      <span style={{ display: 'block', fontSize: '10px', color: badge.fg, fontWeight: 600, marginTop: '1px' }}>
                        {isMine ? `👤 ${t('themeWorkshop.myThemes')}` : `${badge.icon} ${badge.text}`}
                      </span>
                    </span>
                    {th.accentColor && (
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: th.accentColor, flexShrink: 0, border: '1px solid var(--border)' }} />
                    )}
                    {applyingId === th._id && <span style={{ fontSize: '11px' }}>⏳</span>}
                  </button>
                );
              })}
              {themes.length === 0 && (
                <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11px' }}>
                  {t('themeWorkshop.emptySystem')}
                </div>
              )}
              {user && selectedId && (
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
