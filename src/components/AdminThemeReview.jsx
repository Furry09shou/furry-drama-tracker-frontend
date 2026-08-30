import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import adminApi from '../utils/adminApi';
import API from '../utils/apiEndpoints';
import Modal from './Modal';
import { computeThemeType, themeTypeBadge } from './ThemeEditorModal';
import { SvgIconPreview } from '../contexts/IconContext';
import { useI18n } from '../contexts/I18nContext';

/**
 * AdminThemeReview 主题审批页（/admin/theme-review，superadmin 专用）。
 *
 * 与剧集审核（/admin/review）对齐的专门审批工作流：
 *   - 待审核 / 已通过 / 已驳回 三档列表；
 *   - 卡片预览主题内容（类型徽章、壁纸缩略图、图标预览、主题色圆点）；
 *   - 通过 → 升级为系统主题上架市场；驳回 → 附原因退回作者（可修改后重新提交）；
 *   - 审核结果自动向主题作者发送站内通知（后端 notifyThemeReviewResult）。
 */
const AdminThemeReview = () => {
  const { admin } = useOutletContext();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('pending'); // pending | approved | rejected

  // 审核弹窗。
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewAction, setReviewAction] = useState('approve');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const notify = useCallback((msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }, []);

  const fetchThemes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get(API.THEMES.ALL);
      setThemes(res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || t('adminThemeReview.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!admin) return;
    if (admin.role !== 'superadmin') {
      navigate('/admin/dashboard', { replace: true });
      return;
    }
    fetchThemes();
  }, [admin, navigate, fetchThemes]);

  if (!admin) return null;

  const filtered = themes.filter((th) => {
    // 已通过含三类：审核通过上架的系统主题（有 owner 的用户投稿）+ 超管直建
    // + 历史遗留主题（status 为空，早于审核流程创建，视为已上架）。
    if (tab === 'pending') return th.status === 'pending';
    if (tab === 'approved') return th.status === 'approved' || !th.status;
    if (tab === 'rejected') return th.status === 'rejected';
    return true;
  });
  const pendingCount = themes.filter((th) => th.status === 'pending').length;

  const openReview = (theme, action) => {
    setReviewTarget(theme);
    setReviewAction(action);
    setReviewNote('');
    setReviewError('');
  };

  const handleReview = async () => {
    if (reviewAction === 'reject' && !reviewNote.trim()) {
      setReviewError(t('adminThemeReview.rejectNoteRequired'));
      return;
    }
    setReviewing(true);
    try {
      await adminApi.post(API.THEMES.REVIEW(reviewTarget._id), {
        action: reviewAction,
        note: reviewNote.trim(),
      });
      notify(reviewAction === 'approve'
        ? t('adminThemeReview.approveSuccess', { name: reviewTarget.name })
        : t('adminThemeReview.rejectSuccess', { name: reviewTarget.name }));
      setReviewTarget(null);
      fetchThemes();
    } catch (err) {
      setReviewError(err.response?.data?.message || t('adminThemeReview.reviewFailed'));
    } finally {
      setReviewing(false);
    }
  };

  const tabs = [
    { key: 'pending', label: t('adminThemeReview.tabPending'), badge: pendingCount, icon: '⏳' },
    { key: 'approved', label: t('adminThemeReview.tabApproved'), icon: '✅' },
    { key: 'rejected', label: t('adminThemeReview.tabRejected'), icon: '❌' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>{t('adminThemeReview.title')}</h2>
        <Link to="/admin/themes" className="btn btn-secondary" style={{ fontSize: '12px', padding: '5px 12px', textDecoration: 'none' }}>
          {t('adminThemeReview.manageThemes')}
        </Link>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.6 }}>
        {t('adminThemeReview.desc')}
      </p>

      {error && <div className="error-message" style={{ marginBottom: '12px' }}>{error}</div>}
      {success && (
        <div style={{
          marginBottom: '12px', padding: '10px 14px', background: 'var(--success-bg-strong)',
          border: '1px solid var(--success-border)', borderRadius: '8px', color: 'var(--success-text)', fontSize: '13px',
        }}>{success}</div>
      )}

      {/* 状态筛选 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {tabs.map(({ key, label, badge, icon }) => (
          <button
            key={key}
            className={`btn ${tab === key ? '' : 'btn-secondary'}`}
            style={{ fontSize: '13px', padding: '6px 14px', position: 'relative' }}
            onClick={() => setTab(key)}
          >
            {icon} {label}
            {badge > 0 && (
              <span style={{
                marginLeft: '6px', background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 700,
                minWidth: '18px', height: '18px', borderRadius: '9px', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', padding: '0 5px', lineHeight: '18px',
              }}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          {t('common.loading')}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '13px' }}>
          {t('adminThemeReview.empty')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filtered.map((th) => {
            const type = computeThemeType(th);
            const badge = themeTypeBadge(type, t);
            const iconEntries = Object.entries(th.icons || {});
            return (
              <div key={th._id} style={{
                background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)',
                padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {th.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '10px', padding: '1px 7px', borderRadius: '999px', fontWeight: 600,
                        background: badge.bg, color: badge.fg, whiteSpace: 'nowrap',
                      }}>{badge.icon} {badge.text}</span>
                      {th.accentColor && (
                        <span title={th.accentColor} style={{
                          width: '10px', height: '10px', borderRadius: '50%',
                          background: th.accentColor, border: '1px solid var(--border)',
                        }} />
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    {new Date(th.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* 壁纸缩略 */}
                {(th.wallpaperThumb || th.wallpaperUrl) && (
                  <div style={{
                    aspectRatio: '21 / 9', borderRadius: '8px', border: '1px solid var(--border)',
                    backgroundImage: `url(${th.wallpaperThumb || th.wallpaperUrl})`,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                  }} />
                )}

                {/* 图标预览 */}
                {iconEntries.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {iconEntries.slice(0, 8).map(([key, url]) => (
                      <span key={key} title={key} style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '28px', height: '28px', borderRadius: '6px',
                        background: 'var(--hover-bg)', border: '1px solid var(--border)', color: 'var(--foreground)',
                      }}>
                        <SvgIconPreview url={url} size={17} />
                      </span>
                    ))}
                    {iconEntries.length > 8 && (
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>+{iconEntries.length - 8}</span>
                    )}
                  </div>
                )}

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {th.description || t('adminThemes.noDesc')}
                </div>

                {/* 驳回原因（已驳回卡展示上次原因，供复审参考） */}
                {th.status === 'rejected' && th.reviewNote && (
                  <div style={{
                    fontSize: '11px', color: 'var(--destructive-text)', background: 'var(--destructive-bg-subtle)',
                    borderRadius: '6px', padding: '6px 8px', lineHeight: 1.5,
                  }}>💬 {th.reviewNote}</div>
                )}

                {/* 操作 */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
                  {th.status === 'pending' && (
                    <>
                      <button
                        className="btn"
                        style={{ padding: '5px 12px', fontSize: '12px', background: 'var(--success-bg-strong)', borderColor: 'var(--success-border)', color: 'var(--success-text)' }}
                        onClick={() => openReview(th, 'approve')}
                      >✅ {t('adminThemeReview.approve')}</button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '5px 12px', fontSize: '12px', color: 'var(--destructive-text)', borderColor: 'var(--destructive-border)' }}
                        onClick={() => openReview(th, 'reject')}
                      >❌ {t('adminThemeReview.reject')}</button>
                    </>
                  )}
                  {(th.status === 'approved' || th.status === 'rejected') && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '5px 12px', fontSize: '12px' }}
                      onClick={() => openReview(th, th.status === 'approved' ? 'reject' : 'approve')}
                    >{th.status === 'approved' ? t('adminThemeReview.reReject') : t('adminThemeReview.reApprove')}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 审核确认弹窗 */}
      <Modal isOpen={!!reviewTarget} onClose={() => setReviewTarget(null)} maxWidth="460px">
        <div className="modal-header">
          <h3>{reviewAction === 'approve' ? t('adminThemeReview.reviewApproveTitle') : t('adminThemeReview.reviewRejectTitle')}</h3>
          <button className="btn btn-secondary" onClick={() => setReviewTarget(null)}>{t('common.close')}</button>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
          {t('adminThemeReview.reviewTarget', { name: reviewTarget?.name })}
          {reviewAction === 'approve'
            ? t('adminThemeReview.approveHint')
            : t('adminThemeReview.rejectHint')}
        </p>
        <div className="form-group">
          <label>{t('adminThemeReview.reviewNote')}</label>
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder={reviewAction === 'reject' ? t('adminThemeReview.rejectNotePlaceholder') : ''}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 12px', fontSize: '13px',
              borderRadius: '8px', border: '1px solid var(--border)',
              background: 'var(--input)', color: 'var(--foreground)', resize: 'vertical',
            }}
          />
        </div>
        {reviewError && <div className="error-message">{reviewError}</div>}
        <div className="form-group" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => setReviewTarget(null)}>{t('common.cancel')}</button>
          <button
            className="btn"
            onClick={handleReview}
            disabled={reviewing}
            style={reviewAction === 'reject' ? { background: 'var(--destructive)', borderColor: 'var(--destructive)' } : undefined}
          >
            {reviewing ? t('common.saving') : (reviewAction === 'approve' ? t('adminThemeReview.approve') : t('adminThemeReview.reject'))}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default AdminThemeReview;
