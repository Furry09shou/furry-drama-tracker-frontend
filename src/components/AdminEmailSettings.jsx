import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import adminApi from '../utils/adminApi';
import { useI18n } from '../contexts/I18nContext';

// 邮件服务配置自后端重构后改由服务器端 env/ini 提供（EMAIL_HOST / EMAIL_PORT /
// EMAIL_USER / EMAIL_PASS / EMAIL_FROM_NAME），不再存于数据库。本页面因此：
//   1. 只读展示当前生效配置（pass 脱敏，不回传）；
//   2. 提供独立诊断表单发送测试邮件（需手动填写 SMTP 参数）。
// 后端 PUT /api/site-content/email 已禁用，保存操作不再可用。
const AdminEmailSettings = () => {
  const { admin } = useOutletContext();
  const [config, setConfig] = useState(null); // { host, port, user, fromName, enabled }
  const [testForm, setTestForm] = useState({
    host: '', port: '465', user: '', pass: '', fromName: '', to: ''
  });
  const [showPass, setShowPass] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const navigate = useNavigate();
  const { t } = useI18n();

  async function fetchEmailConfig() {
    try {
      const res = await adminApi.get('/api/site-content/email');
      if (res.data && res.data.content) {
        const data = JSON.parse(res.data.content);
        setConfig({
          host: data.host || '',
          port: data.port || '465',
          user: data.user || '',
          fromName: data.fromName || '',
          enabled: !!data.enabled
        });
        // 预填测试表单的公共字段（pass 需手动填写）
        setTestForm(prev => ({
          ...prev,
          host: data.host || '',
          port: data.port || '465',
          user: data.user || '',
          fromName: data.fromName || ''
        }));
      }
    } catch (err) {
      console.error('获取邮件配置失败', err);
    }
  }

  useEffect(() => {
    if (admin.role === 'superadmin') {
      fetchEmailConfig();
    } else {
      navigate('/admin/dashboard', { replace: true });
    }
    // fetchEmailConfig 使用函数声明提升，effect 内直接调用；依赖仅 admin 角色与导航
  }, [admin, navigate]);

  const handleTest = async () => {
    if (!testForm.to) {
      setTestMsg(t('adminEmailSettings.testEmailRequired'));
      return;
    }
    if (!testForm.host || !testForm.user || !testForm.pass) {
      setTestMsg(t('adminEmailSettings.testConfigRequired'));
      return;
    }
    setTesting(true);
    setTestMsg('');
    try {
      const res = await adminApi.post('/api/site-content/test-email', {
        host: testForm.host,
        port: testForm.port,
        user: testForm.user,
        pass: testForm.pass,
        fromName: testForm.fromName,
        to: testForm.to
      });
      setTestMsg(res.data.message);
    } catch (err) {
      setTestMsg(err.response?.data?.message || t('adminEmailSettings.testSendFailed'));
    }
    setTesting(false);
  };

  if (!admin) return null;

  return (
    <div className="admin-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h2>{t('adminEmailSettings.title')}</h2>
        </div>
      </div>

      <div className="form-container" style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* 配置来源说明 */}
        <div style={{
          padding: '14px 18px', marginBottom: '24px', borderRadius: '10px',
          background: 'var(--primary-bg-subtle)', border: '1px solid var(--primary-border-subtle)',
          fontSize: '13px', lineHeight: 1.7, color: 'var(--text-secondary)'
        }}>
          <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: 'var(--foreground)' }}>{t('adminEmailSettings.configSourceTitle')}</p>
          <p style={{ margin: '0 0 6px 0' }}>{t('adminEmailSettings.configSourceHint')}</p>
          <p style={{ margin: 0 }}>{t('adminEmailSettings.configReadonlyNote')}</p>
        </div>

        {/* 当前生效配置（只读） */}
        <div style={{
          padding: '18px 20px', borderRadius: '12px', marginBottom: '24px',
          background: 'var(--card)', border: '1px solid var(--border)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--foreground)' }}>{t('adminEmailSettings.currentConfig')}</h3>
          {config ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('adminEmailSettings.smtpHost')}</span>
                <span style={{ color: 'var(--foreground)', fontWeight: 500, wordBreak: 'break-all', textAlign: 'right' }}>{config.host || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('adminEmailSettings.smtpPort')}</span>
                <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{config.port}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('adminEmailSettings.smtpUser')}</span>
                <span style={{ color: 'var(--foreground)', fontWeight: 500, wordBreak: 'break-all', textAlign: 'right' }}>{config.user || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('adminEmailSettings.fromName')}</span>
                <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{config.fromName || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('adminEmailSettings.status')}</span>
                <span style={{ fontWeight: 600, color: config.enabled ? 'var(--success-text)' : 'var(--destructive-text)' }}>
                  {config.enabled ? t('adminEmailSettings.enabled') : t('adminEmailSettings.disabled')}
                </span>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{t('adminEmailSettings.configNotSet')}</p>
          )}
        </div>

        {/* 测试邮件（独立诊断表单） */}
        <div style={{
          padding: '20px', borderRadius: '12px', marginBottom: '24px',
          background: 'var(--card)', border: '1px solid var(--border)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--foreground)' }}>{t('adminEmailSettings.testEmailTitle')}</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
            {t('adminEmailSettings.testEmailDesc')}
          </p>

          <div className="form-group">
            <label>{t('adminEmailSettings.smtpHost')}</label>
            <input
              type="text"
              value={testForm.host}
              onChange={(e) => setTestForm(prev => ({ ...prev, host: e.target.value }))}
              placeholder={t('adminEmailSettings.smtpHostPlaceholder')}
            />
          </div>

          <div className="form-group">
            <label>{t('adminEmailSettings.smtpPort')}</label>
            <input
              type="text"
              value={testForm.port}
              onChange={(e) => setTestForm(prev => ({ ...prev, port: e.target.value }))}
              placeholder={t('adminEmailSettings.smtpPortPlaceholder')}
            />
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {t('adminEmailSettings.smtpPortHint')}
            </p>
          </div>

          <div className="form-group">
            <label>{t('adminEmailSettings.smtpUser')}</label>
            <input
              type="email"
              value={testForm.user}
              onChange={(e) => setTestForm(prev => ({ ...prev, user: e.target.value }))}
              placeholder="your@email.com"
            />
          </div>

          <div className="form-group">
            <label>{t('adminEmailSettings.smtpPass')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={testForm.pass}
                onChange={(e) => setTestForm(prev => ({ ...prev, pass: e.target.value }))}
                placeholder={t('adminEmailSettings.smtpPassPlaceholder')}
                style={{ width: '100%', paddingRight: '80px' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--primary)',
                  cursor: 'pointer', fontSize: '13px', padding: '4px 8px'
                }}
              >
                {showPass ? t('adminEmailSettings.hide') : t('adminEmailSettings.show')}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {t('adminEmailSettings.smtpPassHint')}
            </p>
          </div>

          <div className="form-group">
            <label>{t('adminEmailSettings.fromName')}</label>
            <input
              type="text"
              value={testForm.fromName}
              onChange={(e) => setTestForm(prev => ({ ...prev, fromName: e.target.value }))}
              placeholder={t('adminEmailSettings.fromNamePlaceholder')}
            />
          </div>

          <div className="form-group">
            <label>{t('adminEmailSettings.testEmailRecipient')}</label>
            <input
              type="email"
              value={testForm.to}
              onChange={(e) => setTestForm(prev => ({ ...prev, to: e.target.value }))}
              placeholder={t('adminEmailSettings.testEmailPlaceholder')}
            />
          </div>

          {testMsg && (
            <div style={{
              marginTop: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
              background: testMsg.includes(t('adminEmailSettings.successKeyword')) ? 'var(--success-bg)' : 'var(--destructive-bg)',
              color: testMsg.includes(t('adminEmailSettings.successKeyword')) ? 'var(--success-text)' : 'var(--destructive-text)',
              border: `1px solid ${testMsg.includes(t('adminEmailSettings.successKeyword')) ? 'var(--success-border)' : 'var(--destructive-border)'}`
            }}>
              {testMsg}
            </div>
          )}

          <button
            className="btn"
            onClick={handleTest}
            disabled={testing || !testForm.host || !testForm.user || !testForm.pass}
            style={{ marginTop: '4px' }}
          >
            {testing ? t('adminEmailSettings.sending') : t('adminEmailSettings.testSend')}
          </button>
        </div>

        <div style={{
          marginTop: '24px', padding: '16px', borderRadius: '10px',
          background: 'var(--hover-bg)', border: '1px solid var(--border)',
          fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: 'var(--foreground)' }}>{t('adminEmailSettings.commonSmtpTitle')}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '8px' }}>
            <div><strong>{t('adminEmailSettings.qqMail')}</strong>：smtp.qq.com:465</div>
            <div><strong>{t('adminEmailSettings.mail163')}</strong>：smtp.163.com:465</div>
            <div><strong>Gmail</strong>：smtp.gmail.com:587</div>
            <div><strong>{t('adminEmailSettings.aliyun')}</strong>：smtp.mxhichina.com:465</div>
            <div><strong>Outlook</strong>：smtp.office365.com:587</div>
            <div><strong>{t('adminEmailSettings.tencentExmail')}</strong>：smtp.exmail.qq.com:465</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminEmailSettings;
