import React, { useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import API from '../utils/apiEndpoints';

/**
 * ServerThemeBridge 主题同步桥。
 *
 * ThemeProvider 在 AuthProvider 之外（无法 useAuth），本组件渲染在 AuthProvider
 * 子树内，负责把「服务端生效主题」同步进 ThemeContext：
 *
 *   - 未登录：拉取站点默认主题（GET /api/themes/active）；
 *   - 已登录：拉取用户选择主题（GET /api/themes/my/selection），无选择时回退默认主题；
 *   - 用户登录态变化时重新同步，实现用户主题多端一致。
 *
 * 本地缓存由 ThemeContext（server_theme_cache）负责，首屏不闪烁。
 */
const ServerThemeBridge = () => {
  const { user } = useAuth();
  const { setServerTheme } = useTheme();
  const lastSynced = useRef(null);

  useEffect(() => {
    // 同一登录态只同步一次（user 引用可能因 updateUser 变化）。
    const syncKey = user ? user._id : 'anonymous';
    if (lastSynced.current === syncKey) return;
    lastSynced.current = syncKey;

    let cancelled = false;
    const controller = new AbortController();

    const applyDefault = async () => {
      try {
        const res = await axios.get(API.THEMES.ACTIVE, { signal: controller.signal });
        if (!cancelled) setServerTheme(res.data?.theme || null);
      } catch {
        /* 网络失败保持缓存主题 */
      }
    };

    if (user) {
      axios.get(API.THEMES.MY_SELECTION, { signal: controller.signal })
        .then((res) => {
          if (cancelled) return;
          const t = res.data?.theme || null;
          if (t) {
            setServerTheme(t);
          } else {
            // 用户未选择主题：回退站点默认主题。
            applyDefault();
          }
        })
        .catch(() => { /* 保持缓存 */ });
    } else {
      applyDefault();
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user, setServerTheme]);

  return null;
};

export default ServerThemeBridge;
