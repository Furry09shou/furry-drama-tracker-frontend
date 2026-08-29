import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { themes } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';

/**
 * 可视化编辑的主题变量分组（覆盖高频样式变量；完整变量集可通过导入/导出 JSON 维护）。
 */
export const THEME_VAR_GROUPS = [
  { key: 'primary', labelKey: 'themeEditor.groupPrimary', vars: ['--primary', '--primary-light', '--primary-dark', '--primary-hover'] },
  { key: 'surface', labelKey: 'themeEditor.groupSurface', vars: ['--background', '--bg-secondary', '--bg-tertiary', '--card', '--popover', '--glass-bg'] },
  { key: 'text', labelKey: 'themeEditor.groupText', vars: ['--foreground', '--text-secondary', '--text-tertiary', '--text-light'] },
  { key: 'border', labelKey: 'themeEditor.groupBorder', vars: ['--border', '--input'] },
  { key: 'semantic', labelKey: 'themeEditor.groupSemantic', vars: ['--secondary', '--accent', '--destructive', '--success', '--warning', '--info', '--purple'] },
];

// 颜色输入可编辑的变量（纯 #hex）；其余（rgba/hsla 等）用文本输入。
const isHexColor = (v) => /^#[0-9a-fA-F]{6}$/.test(v || '');

/**
 * ThemeEditorModal 主题可视化编辑器（管理后台与用户主题工坊共用）。
 *
 * props:
 *   - isOpen / onClose：弹窗开关
 *   - initial：{ name, description, mode, variables } 初始值
 *   - onSave(payload)：保存回调（payload 同 initial 结构）
 *   - saving：保存中状态（禁用按钮）
 *   - title：弹窗标题
 */
const ThemeEditorModal = ({ isOpen, onClose, initial, onSave, saving = false, title }) => {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState('dark');
  const [variables, setVariables] = useState({});
  const [error, setError] = useState('');
  const [rawJson, setRawJson] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  // 打开时用 initial 重置表单。
  useEffect(() => {
    if (isOpen) {
      setName(initial?.name || '');
      setDescription(initial?.description || '');
      setMode(initial?.mode === 'light' ? 'light' : 'dark');
      setVariables({ ...(initial?.variables || {}) });
      setError('');
      setRawJson('');
      setShowRaw(false);
    }
  }, [isOpen, initial]);

  // 编辑中的变量解析结果：基础主题 + 编辑覆盖（预览与最终保存共用）。
  const resolved = useMemo(() => ({
    ...themes[mode],
    ...Object.fromEntries(Object.entries(variables).filter(([, v]) => typeof v === 'string' && v !== '')),
  }), [mode, variables]);

  const setVar = (key, value) => setVariables((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setError(t('themeEditor.nameRequired')); return; }
    if (trimmedName.length > 30) { setError(t('themeEditor.nameTooLong')); return; }
    if (description.length > 200) { setError(t('themeEditor.descTooLong')); return; }
    // 过滤空值变量。
    const cleanVars = Object.fromEntries(Object.entries(variables).filter(([, v]) => typeof v === 'string' && v.trim() !== ''));
    onSave({ name: trimmedName, description: description.trim(), mode, variables: cleanVars });
  };

  // 导出主题配置 JSON（下载文件）。
  const handleExport = () => {
    const payload = { name: name.trim(), description: description.trim(), mode, variables };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `theme-${(name.trim() || 'untitled').replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 从文件导入主题配置。
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (typeof data !== 'object' || !data) throw new Error('invalid');
        if (typeof data.name === 'string' && data.name.trim()) setName(data.name.trim());
        if (typeof data.description === 'string') setDescription(data.description);
        if (data.mode === 'light' || data.mode === 'dark') setMode(data.mode);
        if (data.variables && typeof data.variables === 'object') {
          const next = {};
          for (const [k, v] of Object.entries(data.variables)) {
            if (/^--[a-zA-Z][\w-]*$/.test(k) && typeof v === 'string' && v.length <= 500) next[k] = v;
          }
          setVariables(next);
        }
        setError('');
      } catch {
        setError(t('themeEditor.importInvalid'));
      }
    };
    reader.readAsText(file);
  };

  // 原始 JSON 直接编辑（高级模式）。
  const applyRawJson = () => {
    try {
      const data = JSON.parse(rawJson);
      if (typeof data !== 'object' || !data) throw new Error('invalid');
      const next = {};
      for (const [k, v] of Object.entries(data)) {
        if (/^--[a-zA-Z][\w-]*$/.test(k) && typeof v === 'string' && v.length <= 500) next[k] = v;
      }
      setVariables(next);
      setShowRaw(false);
      setError('');
    } catch {
      setError(t('themeEditor.jsonInvalid'));
    }
  };

  // ---- 预览面板（用解析后的变量直接渲染，实时反映编辑效果） ----
  const previewPanel = (
    <div
      style={{
        background: resolved['--background'],
        borderRadius: '12px',
        border: '1px solid var(--border)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'sticky',
        top: '0',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: '15px', color: resolved['--foreground'] }}>
        {name || t('themeEditor.previewTitle')}
      </div>
      <div style={{ fontSize: '12px', color: resolved['--text-secondary'], lineHeight: 1.5 }}>
        {description || t('themeEditor.previewDesc')}
      </div>

      {/* 卡片 */}
      <div
        style={{
          background: resolved['--card'],
          border: `1px solid ${resolved['--border']}`,
          borderRadius: '10px',
          padding: '12px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600, color: resolved['--card-foreground'] || resolved['--foreground'] }}>
          {t('themeEditor.previewCard')}
        </div>
        <div style={{ fontSize: '12px', color: resolved['--text-secondary'], marginTop: '4px' }}>
          {t('themeEditor.previewCardBody')}
        </div>
      </div>

      {/* 按钮组 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{
          background: resolved['--primary'], color: '#fff',
          padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
        }}>{t('themeEditor.previewPrimaryBtn')}</span>
        <span style={{
          background: resolved['--primary-bg'], color: resolved['--primary'],
          padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
          border: `1px solid ${resolved['--primary-border']}`,
        }}>{t('themeEditor.previewSecondaryBtn')}</span>
        <span style={{
          background: resolved['--destructive-bg'], color: resolved['--destructive-text'],
          padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
        }}>{t('themeEditor.previewDangerBtn')}</span>
      </div>

      {/* 徽章 */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {[
          { bg: resolved['--success-bg'], fg: resolved['--success-text'] },
          { bg: resolved['--warning-bg'], fg: resolved['--warning-text'] },
          { bg: resolved['--info-bg'], fg: resolved['--info-text'] },
        ].map((b, i) => (
          <span key={i} style={{ background: b.bg, color: b.fg, padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}>
            {t('themeEditor.previewBadge')}
          </span>
        ))}
      </div>

      {/* 输入框 */}
      <div style={{
        background: resolved['--input'], border: `1px solid ${resolved['--border']}`,
        borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: resolved['--text-tertiary'],
      }}>
        {t('themeEditor.previewInput')}
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="960px">
      <div className="modal-header">
        <h3>{title || t('themeEditor.title')}</h3>
        <button className="btn btn-secondary" onClick={onClose}>{t('common.close')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: '16px' }}>
        {/* 左：表单 */}
        <div>
          <div className="form-group">
            <label>{t('themeEditor.name')}</label>
            <input
              type="text" value={name} maxLength={30}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('themeEditor.namePlaceholder')}
            />
          </div>
          <div className="form-group">
            <label>{t('themeEditor.description')}</label>
            <input
              type="text" value={description} maxLength={200}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('themeEditor.descPlaceholder')}
            />
          </div>
          <div className="form-group">
            <label>{t('themeEditor.mode')}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['dark', 'light'].map((m) => (
                <button
                  key={m} type="button"
                  onClick={() => setMode(m)}
                  style={{
                    padding: '6px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
                    background: mode === m ? 'var(--primary-bg)' : 'var(--hover-bg)',
                    color: mode === m ? 'var(--primary)' : 'var(--foreground)',
                    border: mode === m ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                    fontWeight: mode === m ? 600 : 400,
                  }}
                >
                  {m === 'dark' ? `🌙 ${t('themeEditor.modeDark')}` : `☀️ ${t('themeEditor.modeLight')}`}
                </button>
              ))}
            </div>
          </div>

          {/* 变量分组编辑 */}
          {THEME_VAR_GROUPS.map((group) => (
            <div key={group.key} style={{
              marginBottom: '12px', background: 'var(--card)', borderRadius: '10px',
              border: '1px solid var(--border)', padding: '12px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>{t(group.labelKey)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {group.vars.map((key) => {
                  const value = variables[key] ?? '';
                  const base = themes[mode][key];
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="color"
                        aria-label={key}
                        value={isHexColor(value) ? value : (isHexColor(base) ? base : '#6366f1')}
                        onChange={(e) => setVar(key, e.target.value)}
                        style={{ width: '32px', height: '32px', padding: 0, border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', background: 'none', flexShrink: 0 }}
                      />
                      <input
                        type="text" value={value}
                        placeholder={base || key}
                        onChange={(e) => setVar(key, e.target.value)}
                        style={{
                          flex: 1, minWidth: 0, padding: '6px 8px', fontSize: '12px',
                          borderRadius: '6px', border: '1px solid var(--border)',
                          background: 'var(--input)', color: 'var(--foreground)',
                          fontFamily: 'monospace',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* 高级：原始 JSON 编辑 */}
          <div style={{ marginBottom: '12px' }}>
            <button
              type="button" className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={() => { setShowRaw(!showRaw); setRawJson(JSON.stringify(variables, null, 2)); }}
            >
              {showRaw ? t('themeEditor.hideRaw') : t('themeEditor.showRaw')}
            </button>
            {showRaw && (
              <div style={{ marginTop: '8px' }}>
                <textarea
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  rows={8}
                  style={{
                    width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '12px',
                    padding: '8px', borderRadius: '8px', border: '1px solid var(--border)',
                    background: 'var(--input)', color: 'var(--foreground)', resize: 'vertical',
                  }}
                />
                <button type="button" className="btn" style={{ fontSize: '12px', padding: '6px 12px', marginTop: '6px' }} onClick={applyRawJson}>
                  {t('themeEditor.applyRaw')}
                </button>
              </div>
            )}
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

          {error && <div className="error-message" style={{ marginTop: '12px' }}>{error}</div>}
        </div>

        {/* 右：实时预览 */}
        <div>{previewPanel}</div>
      </div>

      <div className="form-group" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn" onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </Modal>
  );
};

export default ThemeEditorModal;
