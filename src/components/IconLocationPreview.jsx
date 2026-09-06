import React from 'react';
import { SvgIconPreview } from '../contexts/IconContext';

/**
 * IconLocationPreview 图标位置预览：按图标 key 分组绘制对应页面区域的
 * 迷你界面模拟图（真实文字 + 主题变量，跟随明暗主题），var(--primary)
 * 高亮框标注该图标的落点，落点处叠加当前已配置的 SVG（未配置显示 ⊕），
 * 让主题制作者直观看到「这个图标会出现在页面的哪里」。
 *
 * props:
 *   - iconKey: ICON_COMPONENT_KEYS 中的 key
 *   - iconUrl: 当前配置的图标地址（可选，落点处内嵌预览）
 *   - style: 容器附加样式
 */

// 文字样式（模拟真实页面文案）。
const text = (size = 9, extra = {}) => ({
  fontSize: size, lineHeight: 1.2, color: 'var(--foreground)',
  whiteSpace: 'nowrap', ...extra,
});
const textSecondary = (size = 8, extra = {}) => text(size, { color: 'var(--text-secondary)', ...extra });

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

// 「图标 + 文字」导航/按钮项（模拟真实组件：图标在前文字在后）。
const IconItem = ({ label, active, iconUrl, size = 10, fontSize = 9, style }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 5px',
    borderRadius: '4px', boxSizing: 'border-box',
    border: active ? '1.5px solid var(--primary)' : '1px solid transparent',
    boxShadow: active ? '0 0 6px var(--primary)' : 'none',
    background: active ? 'var(--primary-bg)' : 'transparent',
    ...style,
  }}>
    <Slot active={active} size={size} iconUrl={iconUrl} />
    <span style={text(fontSize, active ? { color: 'var(--primary)', fontWeight: 600 } : {})}>{label}</span>
  </span>
);

// 灰色骨架条（仅用于卡片缩略图等无文字占位）。
const Bar = ({ w = 20, h = 6, style }) => (
  <span style={{
    display: 'inline-block', width: w, height: h, borderRadius: h / 2,
    background: 'var(--border)', flexShrink: 0, ...style,
  }} />
);

// 统一示意画布（模拟页面区域的外框）。
const Frame = ({ children, style }) => (
  <div style={{
    width: '100%', aspectRatio: '2.4 / 1', borderRadius: '8px',
    background: 'var(--hover-bg)', border: '1px solid var(--border)',
    padding: '8px 10px', boxSizing: 'border-box', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px',
    ...style,
  }}>{children}</div>
);

// ---- 导航栏场景（nav.*）----
const NavbarMock = ({ iconKey, iconUrl }) => {
  // 顶部导航项依次为：首页 / 日历 / 动态 / 个人中心；右侧：通知 / 语言。
  const labels = ['首页', '日历', '动态', '个人中心'];
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
      {/* 站点头部（logo 行）：真实站名，misc.logo 落点在此 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', opacity: iconKey === 'misc.logo' ? 1 : 0.55 }}>
        <Slot active={iconKey === 'misc.logo'} size={12} iconUrl={iconUrl} />
        <span style={text(9, { fontWeight: 700 })}>兽剧聚合平台</span>
      </div>
      {/* 导航栏主体 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {labels.map((label, i) => (
          <IconItem key={label} label={label} active={itemActive === i} iconUrl={iconUrl} />
        ))}
        {/* 搜索框 */}
        <span style={{
          flex: 1, height: 14, borderRadius: '4px', boxSizing: 'border-box',
          border: isSearch ? '1.5px solid var(--primary)' : '1px solid var(--border)',
          boxShadow: isSearch ? '0 0 6px var(--primary)' : 'none',
          background: isSearch ? 'var(--primary-bg)' : 'var(--card)',
          display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '0 5px', minWidth: 0,
        }}>
          <Slot active={isSearch} size={9} iconUrl={iconUrl} />
          <span style={textSecondary(8)}>搜索剧名…</span>
        </span>
        {/* 通知按钮（文字 + 可选图标） */}
        <IconItem label="通知" active={isNotif} iconUrl={iconUrl} />
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
        <IconItem label="中文" active={isLang} iconUrl={iconUrl} fontSize={8} />
        {/* 更多（含反馈/后台/设置） */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '2px 4px',
          borderRadius: '4px', boxSizing: 'border-box',
          border: (isFeedback || isAdmin || isSettings) ? '1.5px solid var(--primary)' : '1px solid transparent',
          boxShadow: (isFeedback || isAdmin || isSettings) ? '0 0 6px var(--primary)' : 'none',
          background: (isFeedback || isAdmin || isSettings) ? 'var(--primary-bg)' : 'transparent',
        }}>
          {(isFeedback || isAdmin || isSettings) && <Slot active size={9} iconUrl={iconUrl} />}
          <span style={textSecondary(8)}>更多</span>
          <span style={{ fontSize: '6px', color: 'var(--text-tertiary)', lineHeight: 1 }}>▼</span>
        </span>
      </div>
      {/* 页面内容占位（卡片行） */}
      <div style={{ display: 'flex', gap: '5px', opacity: 0.5 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <Bar w={34} h={18} style={{ borderRadius: '3px' }} />
            <Bar w={26} h={4} />
          </div>
        ))}
      </div>
    </Frame>
  );
};

// ---- 剧集详情操作区（action.*）----
const ActionsMock = ({ iconKey, iconUrl }) => {
  const row1 = [
    { key: 'action.follow', label: '关注' },
    { key: 'action.favorite', label: '收藏' },
    { key: 'action.share', label: '分享' },
    { key: 'action.report', label: '举报' },
  ];
  const row2 = [
    { key: 'action.edit', label: '编辑' },
    { key: 'action.delete', label: '删除' },
    { key: 'action.upload', label: '上传' },
    { key: 'action.download', label: '下载' },
    { key: 'action.play', label: '播放' },
    { key: 'action.refresh', label: '刷新' },
    { key: 'action.close', label: '关闭' },
  ];
  const inRow2 = row2.some(({ key }) => key === iconKey);
  return (
    <Frame>
      {/* 剧集标题条：封面 + 标题 + 评分 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', opacity: iconKey === 'misc.star' ? 1 : 0.6 }}>
        <Bar w={16} h={16} style={{ borderRadius: '3px' }} />
        <span style={text(9, { fontWeight: 700 })}>虚构兽人短剧 第一季</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '2px 5px', borderRadius: '5px', boxSizing: 'border-box', ...slotStyle(iconKey === 'misc.star') }}>
          <Slot active={iconKey === 'misc.star'} size={10} iconUrl={iconUrl} />
          <span style={text(8, { color: 'var(--warning-text)', fontWeight: 700 })}>8.5</span>
          <span style={textSecondary(7)}>(123 人评分)</span>
        </span>
      </div>
      {/* 操作按钮第一行 */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {row1.map(({ key, label }) => {
          const active = iconKey === key;
          return (
            <span key={key} style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 7px',
              borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--card)', boxSizing: 'border-box',
              ...slotStyle(active),
            }}>
              <Slot active={active} size={10} iconUrl={iconUrl} />
              <span style={text(8, active ? { color: 'var(--primary)', fontWeight: 600 } : {})}>{label}</span>
            </span>
          );
        })}
      </div>
      {/* 操作按钮第二行（编辑/删除等） */}
      <div style={{ display: 'flex', gap: '3px', opacity: inRow2 || iconKey === 'misc.star' ? 1 : 0.75 }}>
        {row2.map(({ key, label }) => {
          const active = iconKey === key;
          return (
            <span key={key} style={{
              display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '2px 5px',
              borderRadius: '4px', border: active ? '1.5px solid var(--primary)' : '1px dashed var(--border)',
              boxShadow: active ? '0 0 6px var(--primary)' : 'none',
              background: active ? 'var(--primary-bg)' : 'transparent', boxSizing: 'border-box',
            }}>
              <Slot active={active} size={9} iconUrl={iconUrl} />
              <span style={textSecondary(7, active ? { color: 'var(--primary)' } : {})}>{label}</span>
            </span>
          );
        })}
      </div>
    </Frame>
  );
};

// ---- 状态徽章场景（status.* / tab.*）----
const StatusTabsMock = ({ iconKey, iconUrl }) => {
  const tabs = [
    { key: 'tab.latest', label: '最新' },
    { key: 'tab.recommended', label: '推荐' },
    { key: 'tab.following', label: '追番' },
  ];
  const statuses = ['播出中', '已完结', '未开播'];
  const statusKeys = { 'status.playing': 0, 'status.completed': 1, 'status.upcoming': 2 };
  const tabIdx = tabs.findIndex(({ key }) => key === iconKey);
  const statusIdx = statusKeys[iconKey];
  const isStatus = statusIdx !== undefined;
  const isTab = tabIdx >= 0;
  return (
    <Frame>
      {/* 栏目标题/标签页 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        {tabs.map(({ key, label }, i) => {
          const active = isTab && tabIdx === i;
          return (
            <span key={key} style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px',
              borderRadius: '5px', boxSizing: 'border-box',
              background: active ? 'var(--primary-bg)' : 'var(--border)',
              border: active ? '1.5px solid var(--primary)' : '1px solid transparent',
              boxShadow: active ? '0 0 6px var(--primary)' : 'none',
            }}>
              {active && <Slot active size={10} iconUrl={iconUrl} />}
              <span style={text(8, active ? { color: 'var(--primary)', fontWeight: 700 } : { color: 'var(--text-secondary)' })}>{label}</span>
            </span>
          );
        })}
      </div>
      {/* 剧集卡片行：每张卡片带状态徽章 */}
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
                  <span style={{ fontSize: 7, lineHeight: 1.2, color: 'var(--primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>{statuses[i]}</span>
                </span>
                <span style={textSecondary(7)}>虚构兽人短剧</span>
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
};

// ---- 杂项场景（misc.empty）----
const MiscMock = ({ iconKey, iconUrl }) => {
  const isEmpty = iconKey === 'misc.empty';
  return (
    <Frame style={{ alignItems: 'center', justifyContent: 'center' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: '8px', boxSizing: 'border-box',
        border: isEmpty ? '1.5px solid var(--primary)' : '1px dashed var(--border)',
        boxShadow: isEmpty ? '0 0 10px var(--primary)' : 'none',
        background: isEmpty ? 'var(--primary-bg)' : 'transparent',
      }}>
        <Slot active={isEmpty} size={22} iconUrl={iconUrl} />
      </span>
      <span style={textSecondary(8)}>当前浏览器不支持在线播放，请更换浏览器或下载观看</span>
    </Frame>
  );
};

// ---- 评分星（misc.star）----
const StarMock = ({ iconUrl }) => (
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
      <span style={text(11, { fontWeight: 700, color: 'var(--warning-text)' })}>8.5</span>
      <span style={textSecondary(8)}>(123 人评分)</span>
    </div>
    {/* 交互评分星组 */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Slot key={i} active={i === 0} size={14} iconUrl={i === 0 ? iconUrl : null} />
      ))}
      <span style={textSecondary(8, { marginLeft: '4px' })}>点击星星评分</span>
    </div>
  </Frame>
);

const IconLocationPreview = ({ iconKey, iconUrl, style }) => {
  let mock;
  if (iconKey === 'misc.star') mock = <StarMock iconUrl={iconUrl} />;
  else if (iconKey === 'misc.empty') mock = <MiscMock iconKey={iconKey} iconUrl={iconUrl} />;
  else if (iconKey.startsWith('nav.')) mock = <NavbarMock iconKey={iconKey} iconUrl={iconUrl} />;
  else if (iconKey.startsWith('action.')) mock = <ActionsMock iconKey={iconKey} iconUrl={iconUrl} />;
  else mock = <StatusTabsMock iconKey={iconKey} iconUrl={iconUrl} />;
  return <div style={style}>{mock}</div>;
};

export default IconLocationPreview;
