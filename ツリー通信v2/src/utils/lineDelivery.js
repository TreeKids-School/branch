const reasonLabels = {
  child_identity_unresolved:'児童の照合が保留されています', empty_body:'通信本文が未入力です', message_too_long:'本文がLINEの送信可能な文字数を超えています', manually_sent:'手動で送信済みとして確認されています', already_accepted:'LINEがすでに送信を受け付けています', delivery_exists:'この本文の送信処理がすでにあります', review_required:'保存済みの本文を確認してください', guardian_not_linked:'予約V2で保護者との紐付けがありません', no_ready_recipient:'送信できる保護者LINEがありません', line_unavailable:'LINE送信の接続設定を確認してください', guardian_inactive:'保護者アカウントが利用停止になっています', line_login_required:'保護者のLINE再ログインが必要です', line_reconnect_required:'公式LINEの友だち追加と再ログインを確認してください', line_recipient_unavailable:'LINEの宛先を一時的に確認できません', source_changed:'本文または宛先が変更されています。最新の内容を確認してください', authorization_changed:'送信に必要な権限が変更されています', retry_window_expired:'再試行できる期限を過ぎています', attempt_limit:'再試行回数の上限に達しました', delivery_guard_changed:'送信条件が変更されています。最新の内容を確認してください', network_uncertain:'通信が途切れ、LINEの受付結果を確認できていません', line_rate_limited:'LINEへの送信が混み合っています', line_server_uncertain:'LINEの受付結果を確認できていません',
  line_account_changed:'公式LINEのアカウントが変更されました。接続を確認してください', recipient_verification_unavailable:'宛先を一時的に確認できません。自動で再試行します',
};
export function deliveryReason(value) {
  if (typeof value === 'string') return reasonLabels[value] || (/^line_http_\d+$/.test(value)?'LINEが送信要求を受け付けませんでした。':value);
  if (value && typeof value === 'object') return value.message || value.reason && deliveryReason(value.reason) || value.code && deliveryReason(value.code) || '送信条件の確認が必要です';
  return '送信条件の確認が必要です';
}
export function isLineAccepted(delivery) { return delivery?.status === 'accepted'; }
export function lineDeliveryStatus(status) {
  return ({ pending:'送信待ち', sending:'送信処理中', accepted:'LINE受付済', failed:'送信失敗', uncertain:'LINE受付結果が未確認', cancelled:'送信取消' })[status] || '送信状況を確認中';
}
export function communicationDelivery(row, table = {}) {
  const deliveries = Array.isArray(row?.deliveries) ? row.deliveries : [];
  const recipients = row?.recipients || [];
  const accepted = deliveries.filter(isLineAccepted);
  const complete = recipients.length > 0 && deliveries.length > 0 && deliveries.every(isLineAccepted) && recipients.every(recipient => recipient.eligible && accepted.some(item => item.recipientId === recipient.recipientId));
  if (complete) return { sent: true, kind: 'accepted', label: 'LINE受付済' };
  if (table.sentChecked) return { sent: true, kind: 'manual', label: '送信済み（手動確認）' };
  if (accepted.length) return { sent: false, kind: 'partial', label: 'LINE一部受付' };
  if (deliveries.some(item => ['failed', 'uncertain', 'cancelled'].includes(item.status))) return { sent: false, kind: 'failed', label: 'LINE送信を要確認' };
  if (deliveries.length) return { sent: false, kind: 'pending', label: 'LINE送信待ち' };
  return { sent: false, kind: '', label: '' };
}
export function previewExpiry(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value);
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  return 0;
}
