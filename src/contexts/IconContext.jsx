import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import API from '../utils/apiEndpoints';

const IconContext = createContext();

export const useIcons = () => useContext(IconContext);

/**
 * ICON_COMPONENT_KEYS 图标可绑定的组件标识注册表。
 * 管理后台「图标映射」下拉从此列表选择，前端组件通过 <Icon name="nav.home" /> 消费。
 */
export const ICON_COMPONENT_KEYS = [
  { key: 'nav.home', label: '导航 · 首页' },
  { key: 'nav.search', label: '导航 · 搜索' },
  { key: 'nav.calendar', label: '导航 · 更新日历' },
  { key: 'nav.timeline', label: '导航 · 动态' },
  { key: 'nav.notifications', label: '导航 · 通知' },
  { key: 'nav.profile', label: '导航 · 个人中心' },
  { key: 'nav.settings', label: '导航 · 设置' },
  { key: 'nav.admin', label: '导航 · 后台' },
  { key: 'nav.theme', label: '导航 · 主题切换' },
  { key: 'nav.language', label: '导航 · 语言切换' },
  { key: 'nav.feedback', label: '导航 · 反馈' },
  { key: 'action.favorite', label: '操作 · 收藏' },
  { key: 'action.follow', label: '操作 · 关注' },
  { key: 'action.share', label: '操作 · 分享' },
  { key: 'action.report', label: '操作 · 举报' },
  { key: 'action.edit', label: '操作 · 编辑' },
  { key: 'action.delete', label: '操作 · 删除' },
  { key: 'action.upload', label: '操作 · 上传' },
  { key: 'action.download', label: '操作 · 下载' },
  { key: 'action.close', label: '操作 · 关闭' },
  { key: 'action.refresh', label: '操作 · 刷新' },
  { key: 'status.playing', label: '状态 · 播出中' },
  { key: 'status.completed', label: '状态 · 已完结' },
  { key: 'status.upcoming', label: '状态 · 未开播' },
  { key: 'tab.latest', label: '标签页 · 最新' },
  { key: 'tab.recommended', label: '标签页 · 推荐' },
  { key: 'tab.following', label: '标签页 · 追番' },
  { key: 'misc.logo', label: '杂项 · 站点 Logo' },
  { key: 'misc.empty', label: '杂项 · 空状态' },
  { key: 'misc.loading', label: '杂项 · 加载中' },
];

// ---- SVG 内容清洗：移除脚本与事件属性，颜色改为 currentColor 以适配主题 ----

const sanitizeSvg = (text) => {
  if (!text || typeof text !== 'string') return null;
  let s = text;
  // 去掉外层 <?xml ...?> 声明与 DOCTYPE（防 XXE）。
  s = s.replace(/<\?xml[\s\S]*?\?>/gi, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  // 必须是 <svg> 开头。
  if (!s.trimStart().startsWith('<svg')) return null;
  // 移除 script/foreignObject/iframe 等危险节点。
  s = s.replace(/<(script|foreignObject|iframe|object|embed|link)\b[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<(script|foreignObject|iframe|object|embed|link)\b[^>]*\/?>/gi, '');
  // 移除 on* 事件属性与 javascript: 协议。
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
  // 颜色适配主题：显式颜色值替换为 currentColor。
  s = s.replace(/(fill|stroke)\s*=\s*("|')\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))\s*\2/gi, '$1="currentColor"');
  s = s.replace(/(fill|stroke)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))\s*;?/gi, '$1:currentColor;');
  return s.trim();
};

/**
 * IconProvider 图标引擎。
 *
 * 页面加载时拉取 /api/icons/list 获取图标与组件映射表，并预加载映射图标的
 * SVG 内容（inline 渲染，fill/stroke 转为 currentColor，颜色自动跟随主题）。
 */
export const IconProvider = ({ children }) => {
  const [mappings, setMappings] = useState({});
  const [icons, setIcons] = useState([]);
  // url -> 已清洗的 SVG 内容（inline 渲染用）。
  const [svgMap, setSvgMap] = useState({});

  useEffect(() => {
    let cancelled = false;
    axios.get(API.ICONS.LIST).then((res) => {
      if (cancelled) return;
      const list = res.data?.icons || [];
      const map = res.data?.mappings || {};
      setIcons(list);
      setMappings(map);
      // 预加载被映射引用的图标内容。
      const urls = [...new Set(Object.values(map))];
      urls.forEach((url) => {
        axios.get(url, { responseType: 'text' }).then((r2) => {
          const clean = sanitizeSvg(r2.data);
          if (!cancelled && clean) setSvgMap((prev) => ({ ...prev, [url]: clean }));
        }).catch(() => { /* 单个图标失败忽略 */ });
      });
    }).catch(() => { /* 图标服务不可用时静默回退 emoji */ });
    return () => { cancelled = true; };
  }, []);

  // 供管理页手动刷新图标表（上传/删除后调用）。
  const refreshIcons = async () => {
    try {
      const res = await axios.get(API.ICONS.LIST);
      const list = res.data?.icons || [];
      const map = res.data?.mappings || {};
      setIcons(list);
      setMappings(map);
      const urls = [...new Set(Object.values(map))];
      const next = {};
      await Promise.all(urls.map(async (url) => {
        try {
          const r2 = await axios.get(url, { responseType: 'text' });
          const clean = sanitizeSvg(r2.data);
          if (clean) next[url] = clean;
        } catch { /* 忽略 */ }
      }));
      setSvgMap(next);
    } catch { /* 忽略 */ }
  };

  // 加载单个未映射图标的内容（预览用）。
  const loadSvgContent = async (url) => {
    if (svgMap[url]) return svgMap[url];
    try {
      const r = await axios.get(url, { responseType: 'text' });
      const clean = sanitizeSvg(r.data);
      if (clean) setSvgMap((prev) => ({ ...prev, [url]: clean }));
      return clean;
    } catch {
      return null;
    }
  };

  const value = useMemo(() => ({
    icons, mappings, svgMap, refreshIcons, loadSvgContent,
  }), [icons, mappings, svgMap]);

  return (
    <IconContext.Provider value={value}>
      {children}
    </IconContext.Provider>
  );
};

/**
 * Icon 主题图标组件：按组件 key 渲染服务端映射的 SVG（currentColor 适配主题），
 * 无映射或加载失败时回退到 fallback（通常是 emoji）。
 *
 * 用法：<Icon name="nav.home" fallback="🏠" size={18} />
 */
export const Icon = ({ name, size = 18, fallback = null, style }) => {
  const { mappings, svgMap } = useIcons();
  const url = mappings[name];
  const svg = url ? svgMap[url] : null;

  if (svg) {
    return (
      <span
        aria-hidden="true"
        className="theme-icon"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: size, height: size, flexShrink: 0,
          color: 'inherit', ...style,
        }}
        dangerouslySetInnerHTML={{
          __html: svg.replace('<svg', `<svg width="${size}" height="${size}" style="display:block"`),
        }}
      />
    );
  }
  if (fallback !== null) {
    return (
      <span
        aria-hidden="true"
        style={{ display: 'inline-flex', fontSize: size * 0.9, lineHeight: 1, ...style }}
      >
        {fallback}
      </span>
    );
  }
  return null;
};

export default IconContext;
