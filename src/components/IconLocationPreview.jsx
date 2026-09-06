import React from 'react';
import { SvgIconPreview } from '../contexts/IconContext';

/**
 * IconLocationPreview 图标位置预览：按图标 key 分组绘制对应页面区域的
 * 迷你示意图（纯 CSS 色块，跟随明暗主题），var(--primary) 高亮标注该图标的
 * 落点，并在落点处叠加当前已配置的 SVG（slot 预览），让主题制作者直观
 * 看到「这个图标会出现在页面的哪里」。
 *
 * props:
 *   - iconKey: ICON_COMPONENT_KEYS 中的 key
 *   - iconUrl: 当前配置的图标地址（可选，落点处内嵌预览）
 *   - style: 容器附加样式
 */

// 高亮落点样式（图标槽）：主色描边 + 光晕 + 主色浅底。
const slotStyle = (active) => active ? {
  borderColor: 'var(--primary)',
  boxShadow: '0 0 8px var(--primary)',
  background: 'var(--primary-bg)',
} : {};

// 图标落点（可叠加当前 SVG 预览；未配置时显示 ⊕ 占位）。
const Slot = ({ active, size = 14, iconUrl, style }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: size, height: size, borderRadius: '4px',
    border: active ? '1.5px solid var(--primary)' : '1px dashed var(--border)',
    fontSize: size * 0.7, color: 'var(--text-tertiary)', flexShrink: 0,
    boxSizing: 'border-box', ...slotStyle(active), ...style,
  }}>
    {active && iconUrl
      ? <SvgIconPreview url={iconUrl} size={size - 4} />
      : (active ? '⊕' : '')}
  </span>
);

// 灰色骨架条（模拟文字/色块）。
const Bar = ({ w = 20, h = 6, style }) => (
  <span style={{
    display: 'inline-block', width: w, height: h, borderRadius: h / 2,
    background: 'var(--border)', flexShrink: 0, ...style,
  }} />
);

// 统一示意画布（模拟页面区域的外框）。
const Frame = ({ children, style }) => (
  <div style={{
    width: '100%', aspectRatio: '2.6 / 1', borderRadius: '8px',
    background: 'var(--hover-bg)', border: '1px solid var(--border)',
    padding: '8px 10px', boxSizing: 'border-box', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px',
    ...style,
  }}>{children}</div>
);

// ---- 导航栏场景（nav.*）----
const NavbarMock = ({ iconKey, iconUrl }) => {
  // 顶部导航项依次为：首页 / 日历 / 动态 / 个人中心；右侧：通知 / 语言。
  const itemActive = { 'nav.home': 0, 'nav.calendar': 1, 'nav.timeline': 2, 'nav.profile': 3 }[iconKey];
  const isSearch = iconKey === 'nav.search';
  const isNotif = iconKey === 'nav.notifications';
  const isLang = iconKey === 'nav.language';
  const isTheme = iconKey === 'nav.theme';
  const isFeedback = iconKey === 'nav.feedback';
  const isAdmin = iconKey === 'nav.admin';
  const isSettings = iconKey === 'nav.settings';
  return (
    <Frame>
      {/* 站点头部（logo 行） */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', opacity: iconKey === 'misc.logo' ? 1 : 0.55 }}>
        <Slot active={iconKey === 'misc.logo'} size={12} iconUrl={iconUrl} />
        <Bar w={44} h={7} />
      </div>
      {/* 导航栏主体 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <Bar w={10} h={10} style={{ borderRadius: '3px', opacity: 0.4 }} />
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: '2px',
            padding: '2px 5px', borderRadius: '4px', boxSizing: 'border-box',
            border: itemActive === i ? '1.5px solid var(--primary)' : '1px solid transparent',
            boxShadow: itemActive === i ? '0 0 6px var(--primary)' : 'none',
            background: itemActive === i ? 'var(--primary-bg)' : 'transparent',
          }}>
            <Slot active={itemActive === i} size={9} iconUrl={iconUrl} />
            <Bar w={14} h={5} />
          </span>
        ))}
        {/* 搜索框 */}
        <span style={{
          flex: 1, height: 12, borderRadius: '4px', boxSizing: 'border-box',
          border: isSearch ? '1.5px solid var(--primary)' : '1px solid var(--border)',
          boxShadow: isSearch ? '0 0 6px var(--primary)' : 'none',
          background: isSearch ? 'var(--primary-bg)' : 'var(--card)',
          display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '0 4px',
        }}>
          <Slot active={isSearch} size={9} iconUrl={iconUrl} />
        </span>
        {/* 通知按钮（文字 + 可选图标） */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '2px 5px',
          borderRadius: '4px', boxSizing: 'border-box',
          border: isNotif ? '1.5px solid var(--primary)' : '1px solid transparent',
          boxShadow: isNotif ? '0 0 6px var(--primary)' : 'none',
          background: isNotif ? 'var(--primary-bg)' : 'transparent',
        }}>
          <Slot active={isNotif} size={9} iconUrl={iconUrl} />
          <Bar w={16} h={5} />
        </span>
        {/* 主题切换 */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', padding: '2px', borderRadius: '4px', boxSizing: 'border-box',
          border: isTheme ? '1.5px solid var(--primary)' : '1px solid transparent',
          boxShadow: isTheme ? '0 0 6px var(--primary)' : 'none',
          background: isTheme ? 'var(--primary-bg)' : 'transparent',
        }}>
          <Slot active={isTheme} size={9} iconUrl={iconUrl} />
        </span>
        {/* 语言切换 */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '2px 4px',
          borderRadius: '4px', boxSizing: 'border-box',
          border: isLang ? '1.5px solid var(--primary)' : '1px solid transparent',
          boxShadow: isLang ? '0 0 6px var(--primary)' : 'none',
          background: isLang ? 'var(--primary-bg)' : 'transparent',
        }}>
          <Slot active={isLang} size={9} iconUrl={iconUrl} />
          <Bar w={10} h={5} />
        </span>
        {/* 更多（含反馈/后台/设置） */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '2px 4px',
          borderRadius: '4px', boxSizing: 'border-box',
          border: (isFeedback || isAdmin || isSettings) ? '1.5px solid var(--primary)' : '1px solid transparent',
          boxShadow: (isFeedback || isAdmin || isSettings) ? '0 0 6px var(--primary)' : 'none',
          background: (isFeedback || isAdmin || isSettings) ? 'var(--primary-bg)' : 'transparent',
        }}>
          {(isFeedback || isAdmin || isSettings) && <Slot active size={9} iconUrl={iconUrl} />}
          <Bar w={8} h={5} />
          <span style={{ fontSize: '6px', color: 'var(--text-tertiary)', lineHeight: 1 }}>▼</span>
        </span>
      </div>
      {/* 页面内容占位 */}
      <div style={{ display: 'flex', gap: '4px', opacity: 0.5 }}>
        {[0, 1, 2, 3].map((i) => <Bar key={i} w={30} h={16} style={{ borderRadius: '3px' }} />)}
      </div>
    </Frame>
  );
};

// ---- 剧集详情操作区（action.*）----
const ActionsMock = ({ iconKey, iconUrl }) => {
  const row1 = ['action.follow', 'action.favorite', 'action.share', 'action.report'];
  const row2 = ['action.edit', 'action.delete', 'action.upload', 'action.download', 'action.play', 'action.refresh', 'action.close'];
  const inRow1 = row1.includes(iconKey);
  const inRow2 = row2.includes(iconKey);
  return (
    <Frame>
      {/* 剧集标题条 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', opacity: 0.55 }}>
        <Bar w={16} h={16} style={{ borderRadius: '3px' }} />
        <Bar w={90} h={7} />
        <Slot active={iconKey === 'misc.star'} size={10} iconUrl={iconUrl} />
        <Bar w={14} h={5} />
      </div>
      {/* 操作按钮第一行 */}
      <div style={{ display: 'flex', gap: '5px' }}>
        {row1.map((k) => {
          const active = iconKey === k;
          return (
            <span key={k} style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 7px',
              borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--card)', boxSizing: 'border-box',
              ...slotStyle(active),
            }}>
              <Slot active={active} size={10} iconUrl={iconUrl} />
              <Bar w={20} h={5} />
            </span>
          );
        })}
        {/* 评分星组 */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '3px 6px',
          borderRadius: '5px', boxSizing: 'border-box',
          ...slotStyle(iconKey === 'misc.star'),
        }}>
          <Slot active={iconKey === 'misc.star'} size={10} iconUrl={iconUrl} />
          {[0, 1, 2].map((i) => <Bar key={i} w={7} h={7} style={{ borderRadius: '2px', background: 'var(--warning-bg)' }} />)}
        </span>
      </div>
      {/* 操作按钮第二行（编辑/删除等） */}
      <div style={{ display: 'flex', gap: '4px', opacity: inRow2 ? 1 : 0.75 }}>
        {row2.map((k) => {
          const active = iconKey === k;
          return (
            <span key={k} style={{
              display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '2px 5px',
              borderRadius: '4px', border: active ? '1.5px solid var(--primary)' : '1px dashed var(--border)',
              boxShadow: active ? '0 0 6px var(--primary)' : 'none',
              background: active ? 'var(--primary-bg)' : 'transparent', boxSizing: 'border-box',
            }}>
              <Slot active={active} size={9} iconUrl={iconUrl} />
              <Bar w={12} h={4} />
            </span>
          );
        })}
      </div>
    </Frame>
  );
};

// ---- 状态徽章场景（status.* / tab.*）----
const StatusTabsMock = ({ iconKey, iconUrl }) => {
  const statusKeys = { 'status.playing': 0, 'status.completed': 1, 'status.upcoming': 2 };
  const tabKeys = { 'tab.latest': 0, 'tab.recommended': 1, 'tab.following': 2 };
  const statusIdx = statusKeys[iconKey];
  const tabIdx = tabKeys[iconKey];
  const isStatus = statusIdx !== undefined;
  const isTab = tabIdx !== undefined;
  return (
    <Frame>
      {/* 栏目标题/标签页 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        {['tab.latest', 'tab.recommended', 'tab.following'].map((k, i) => {
          const active = isTab && tabIdx === i;
          return (
            <span key={k} style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px',
              borderRadius: '5px', boxSizing: 'border-box',
              background: active ? 'var(--primary-bg)' : 'var(--border)',
              border: active ? '1.5px solid var(--primary)' : '1px solid transparent',
              boxShadow: active ? '0 0 6px var(--primary)' : 'none',
            }}>
              {active && <Slot active size={10} iconUrl={iconUrl} />}
              <Bar w={18} h={5} style={{ background: active ? 'var(--primary)' : 'var(--text-tertiary)' }} />
            </span>
          );
        })}
      </div>
      {/* 剧集卡片行 */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {[0, 1, 2].map((i) => {
          const active = isStatus && statusIdx === i;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', gap: '4px', padding: '4px', borderRadius: '5px', background: 'var(--card)', border: '1px solid var(--border)', boxSizing: 'border-box' }}>
              <Bar w={16} h={22} style={{ borderRadius: '3px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '1px 4px',
                  borderRadius: '3px', background: 'var(--primary-bg)', boxSizing: 'border-box',
                  border: active ? '1.5px solid var(--primary)' : '1px solid transparent',
                  boxShadow: active ? '0 0 6px var(--primary)' : 'none',
                }}>
                  {active && <Slot active size={8} iconUrl={iconUrl} />}
                  <Bar w={12} h={4} style={{ background: 'var(--primary)' }} />
                </span>
                <Bar w={24} h={4} />
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
};

// ---- 杂项场景（misc.empty / misc.loading）----
const MiscMock = ({ iconKey, iconUrl }) => {
  const isEmpty = iconKey === 'misc.empty';
  const isLoading = iconKey === 'misc.loading';
  return (
    <Frame style={{ alignItems: 'center', justifyContent: 'center' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: '8px', boxSizing: 'border-box',
        border: (isEmpty || isLoading) ? '1.5px solid var(--primary)' : '1px dashed var(--border)',
        boxShadow: (isEmpty || isLoading) ? '0 0 10px var(--primary)' : 'none',
        background: (isEmpty || isLoading) ? 'var(--primary-bg)' : 'transparent',
      }}>
        <Slot active={isEmpty || isLoading} size={22} iconUrl={iconUrl} />
      </span>
      {isEmpty
        ? <Bar w={110} h={6} />
        : <div style={{ display: 'flex', gap: '4px' }}><Bar w={40} h={6} /><Bar w={40} h={6} /><Bar w={40} h={6} /></div>}
    </Frame>
  );
};

// ---- 站点 Logo（misc.logo）----
const LogoMock = ({ iconKey, iconUrl }) => (
  <Frame style={{ justifyContent: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: '7px', boxSizing: 'border-box',
        border: '1.5px solid var(--primary)', boxShadow: '0 0 10px var(--primary)',
        background: 'var(--primary-bg)',
      }}>
        <Slot active size={20} iconUrl={iconUrl} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <Bar w={90} h={8} />
        <Bar w={60} h={5} style={{ opacity: 0.6 }} />
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', opacity: 0.5 }}>
        {[0, 1, 2, 3].map((i) => <Bar key={i} w={20} h={6} />)}
      </div>
    </div>
    <Bar w={'60%'} h={5} style={{ opacity: 0.35 }} />
  </Frame>
);

// ---- 评分星（misc.star）----
const StarMock = ({ iconKey, iconUrl }) => (
  <Frame style={{ justifyContent: 'center', gap: '8px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 18, height: 18, borderRadius: '4px', boxSizing: 'border-box',
        border: '1.5px solid var(--primary)', boxShadow: '0 0 8px var(--primary)',
        background: 'var(--primary-bg)',
      }}>
        <Slot active size={13} iconUrl={iconUrl} />
      </span>
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--warning-text)' }}>8.5</span>
      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>(123 人评分)</span>
    </div>
    {/* 交互评分星组 */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Slot key={i} active={i === 0} size={14} iconUrl={i === 0 ? iconUrl : null} />
      ))}
      <Bar w={50} h={5} style={{ marginLeft: '4px' }} />
    </div>
  </Frame>
);

const IconLocationPreview = ({ iconKey, iconUrl, style }) => {
  let mock;
  if (iconKey === 'misc.logo') mock = <LogoMock iconKey={iconKey} iconUrl={iconUrl} />;
  else if (iconKey === 'misc.star') mock = <StarMock iconKey={iconKey} iconUrl={iconUrl} />;
  else if (iconKey === 'misc.empty' || iconKey === 'misc.loading') mock = <MiscMock iconKey={iconKey} iconUrl={iconUrl} />;
  else if (iconKey.startsWith('nav.')) mock = <NavbarMock iconKey={iconKey} iconUrl={iconUrl} />;
  else if (iconKey.startsWith('action.')) mock = <ActionsMock iconKey={iconKey} iconUrl={iconUrl} />;
  else mock = <StatusTabsMock iconKey={iconKey} iconUrl={iconUrl} />;
  return <div style={style}>{mock}</div>;
};

export default IconLocationPreview;
