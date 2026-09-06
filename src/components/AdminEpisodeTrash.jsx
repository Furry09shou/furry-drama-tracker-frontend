import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import adminApi from '../utils/adminApi';
import { useI18n } from '../contexts/I18nContext';
import ConfirmModal from './ConfirmModal';
import Modal from './Modal';

// 剧集回收站（admin/superadmin）：被删除 / 审核拒绝的剧集在此集中管理。
// 支持查看进入原因与编辑内容日志（版本快照，可回退依据）、
// 恢复回正式集合、彻底删除以释放服务器资源。
const AdminEpisodeTrash = () => {
  const { admin } = useOutletContext();
  const { t, locale } = useI18n();
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [versionsFor, setVersionsFor] = useState(null);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const LIMIT = 20;

  useEffect(() => {
    if (!admin) return;
    fetchList(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, page]);

  const fetchList = async (p = page) => {
    try {
      const res = await adminApi.get(`/api/episode-trash?page=${p}&limit=${LIMIT}`);
      setList(res.data.list || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 0);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || t('adminEpisodeTrash.loadFailed'));
    }
  };

  const openVersions = async (item) => {
    setVersionsFor(item);
    setVersions([]);
    setVersionsLoading(true);
    try {
      const res = await adminApi.get(`/api/episode-trash/${item._id}/versions`);
      setVersions(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t('adminEpisodeTrash.loadFailed'));
    }
    setVersionsLoading(false);
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setBusy(true);
    try {
      await adminApi.put(`/api/episode-trash/${restoreTarget._id}/restore`);
      setRestoreTarget(null);
      fetchList();
    } catch (err) {
      setError(err.response?.data?.message || t('adminEpisodeTrash.restoreFailed'));
    }
    setBusy(false);
  };

  const handlePurge = async () => {
    if (!purgeTarget) return;
    setBusy(true);
    try {
      await adminApi.delete(`/api/episode-trash/${purgeTarget._id}`);
      setPurgeTarget(null);
      fetchList();
    } catch (err) {
      setError(err.response?.data?.message || t('adminEpisodeTrash.purgeFailed'));
    }
    setBusy(false);
  };

  if (!admin) return null;

  const reasonLabels = {
    rejected: t('adminEpisodeTrash.reasonRejected'),
    deleted: t('adminEpisodeTrash.reasonDeleted'),
  };
  const reasonStyles = {
    rejected: { background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' },
    deleted: { background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)' },
  };

  return (
    <div className="admin-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h2>{t('adminEpisodeTrash.title')}</h2>
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{t('adminEpisodeTrash.totalCount', { total })}</span>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 20px 0', lineHeight: 1.6 }}>
        {t('adminEpisodeTrash.desc')}
      </p>

      {error && <div className="error-message">{error}</div>}

      {list.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>{t('adminEpisodeTrash.noItems')}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('adminEpisodeTrash.colTitle')}</th>
                <th>{t('adminEpisodeTrash.colReason')}</th>
                <th>{t('adminEpisodeTrash.colNote')}</th>
                <th>{t('adminEpisodeTrash.colOperator')}</th>
                <th>{t('adminEpisodeTrash.colTime')}</th>
                <th>{t('adminEpisodeTrash.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map(item => (
                <tr key={item._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {item.coverImage && (
                        <img src={item.coverImage} alt="" style={{ width: '36px', height: '52px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 600 }}>{item.title}</div>
                        {item.titleEn && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.titleEn}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                      ...(reasonStyles[item.trashReason] || {})
                    }}>
                      {reasonLabels[item.trashReason] || item.trashReason}
                    </span>
                  </td>
                  <td style={{ maxWidth: '220px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {item.trashNote || '-'}
                  </td>
                  <td style={{ fontSize: '13px' }}>
                    {item.trashBy?.username || '-'}
                  </td>
                  <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                    {item.trashAt ? new Date(item.trashAt).toLocaleString(locale) : '-'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '5px 12px' }} onClick={() => openVersions(item)}>
                        {t('adminEpisodeTrash.viewVersions')}
                      </button>
                      <button className="btn" style={{ fontSize: '12px', padding: '5px 12px' }} onClick={() => setRestoreTarget(item)}>
                        {t('adminEpisodeTrash.restore')}
                      </button>
                      <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '5px 12px', background: 'var(--destructive-bg)', color: 'var(--destructive-text)', borderColor: 'var(--destructive-border)' }} onClick={() => setPurgeTarget(item)}>
                        {t('adminEpisodeTrash.purge')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px', marginTop: '20px' }}>
          <button className="btn btn-secondary" style={{ fontSize: '13px', padding: '6px 14px' }} disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t('common.prevPage')}
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('adminEpisodeTrash.pageInfo', { page, totalPages })}</span>
          <button className="btn btn-secondary" style={{ fontSize: '13px', padding: '6px 14px' }} disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            {t('common.nextPage')}
          </button>
        </div>
      )}

      {/* 编辑内容日志（版本快照）：恢复后可依据版本记录回退内容 */}
      <Modal
        isOpen={!!versionsFor}
        onClose={() => setVersionsFor(null)}
        maxWidth="640px"
        contentStyle={{ maxHeight: '80vh', overflow: 'auto', padding: 0 }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px', borderBottom: '1px solid var(--border)'
        }}>
          <h3 style={{ margin: 0, color: 'var(--foreground)' }}>{t('adminEpisodeTrash.versionsTitle', { title: versionsFor?.title || '' })}</h3>
          <button onClick={() => setVersionsFor(null)} style={{
            background: 'none', border: 'none', color: 'var(--foreground)',
            fontSize: '24px', cursor: 'pointer', padding: '0 4px', lineHeight: 1
          }}>✕</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: 1.6 }}>
            {t('adminEpisodeTrash.versionsDesc')}
          </p>
          {versionsLoading ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>{t('common.loading')}</p>
          ) : versions.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>{t('adminEpisodeTrash.noVersions')}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>{t('adminEpisodeTrash.colVersion')}</th>
                    <th>{t('adminEpisodeTrash.colSummary')}</th>
                    <th>{t('adminEpisodeTrash.colOperator')}</th>
                    <th>{t('adminEpisodeTrash.colTime')}</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map(v => (
                    <tr key={v._id}>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>v{v.version}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{v.changeSummary || '-'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{v.changedBy?.username || '-'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{v.createdAt ? new Date(v.createdAt).toLocaleString(locale) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmModal
        show={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestore}
        type="primary"
        title={t('adminEpisodeTrash.restoreConfirmTitle')}
        message={t('adminEpisodeTrash.restoreConfirmMsg', { title: restoreTarget?.title || '' })}
        confirmText={t('adminEpisodeTrash.restore')}
        cancelText={t('common.cancel')}
      />

      <ConfirmModal
        show={!!purgeTarget}
        onClose={() => setPurgeTarget(null)}
        onConfirm={handlePurge}
        type="danger"
        title={t('adminEpisodeTrash.purgeConfirmTitle')}
        message={t('adminEpisodeTrash.purgeConfirmMsg', { title: purgeTarget?.title || '' })}
        confirmText={t('adminEpisodeTrash.purge')}
        cancelText={t('common.cancel')}
      />
    </div>
  );
};

export default AdminEpisodeTrash;
