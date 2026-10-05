import { deliveryReason, isLineAccepted, lineDeliveryStatus } from '../utils/lineDelivery';

const recipientName = recipient => [recipient?.displayName || '連携済みの保護者', recipient?.relation].filter(Boolean).join(' · ');
const timeLabel = value => value ? new Date(value).toLocaleString('ja-JP') : '';

export default function LineDeliveryStatus({ rows, submitted, busy, onRetry }) {
  const all = rows.flatMap(row => (row.deliveries || []).map(job => ({ row, job })));
  const cancelled = all.filter(({ job }) => job.status === 'cancelled' && job.attempts === 0);
  const current = all.filter(({ job }) => !(job.status === 'cancelled' && job.attempts === 0));
  const recentIds = new Set(submitted?.jobIds || []);
  current.sort((a, b) => Number(recentIds.has(b.job.jobId)) - Number(recentIds.has(a.job.jobId)));
  const awaiting = submitted?.children?.filter(child => !all.some(({ row, job }) => row.childId === child.childId && recentIds.has(job.jobId))) || [];
  const renderJob = ({ row, job }) => <article className="line-status-item" key={job.jobId}>
    <div>{recentIds.has(job.jobId) && <small>今回の送信</small>}<h4>{row.childName}</h4><p>{recipientName(row.recipients?.find(recipient => recipient.recipientId === job.recipientId))}</p></div>
    <div><strong className={'line-status-badge ' + (isLineAccepted(job) ? 'is-accepted' : job.status)}>{lineDeliveryStatus(job.status)}</strong>
      {job.acceptedAt && <small>{timeLabel(job.acceptedAt)}</small>}
      {job.errorCode && <p className="line-delivery-reasons">{deliveryReason(job.errorCode)}</p>}
      {job.retryable && <button disabled={busy} onClick={() => onRetry(job)}>この失敗分を再試行</button>}
    </div>
  </article>;
  return <>
    <div className="line-status-summary" aria-live="polite">
      <span>送信待ち・処理中 <strong>{current.filter(({ job }) => ['pending', 'sending'].includes(job.status)).length}</strong>件</span>
      <span>LINE受付済 <strong>{current.filter(({ job }) => isLineAccepted(job)).length}</strong>件</span>
      <span>要確認 <strong>{current.filter(({ job }) => ['failed', 'uncertain', 'cancelled'].includes(job.status)).length}</strong>件</span>
    </div>
    {!!awaiting.length && <div className="line-delivery-excluded" role="status">{awaiting.map(child => <p key={child.childId}><strong>{child.childName}</strong>：送信要求は登録済みです。受付状況を取得しています。</p>)}</div>}
    {current.map(renderJob)}
    {!current.length && !awaiting.length && <p className="line-delivery-empty">{cancelled.length ? '現在、送信待ち・受付済みの通信はありません。過去の取消履歴は下から確認できます。' : 'この日の送信履歴はまだありません。「送信する」から児童を選んでください。'}</p>}
    {!!cancelled.length && <details className="line-delivery-content line-status-history"><summary>過去の取消履歴（{cancelled.length}件）</summary>{cancelled.map(renderJob)}</details>}
  </>;
}
