export function publicationLabel(state) {
  return ({ unpublished:'未公開', published:'保護者公開済み', changed:'変更あり・未反映' })[state] || '公開状況を確認中';
}
export function publicationReason(reason) {
  if (reason && typeof reason === 'object') return reason.message || publicationReason(reason.code || reason.reason);
  return ({ source_missing:'当日の児童一覧から外れています。公開の取消はできます', child_identity_unresolved:'児童の照合が保留されています', empty_body:'公開する本文が未入力です', content_too_long:'公開できる文字数を超えています', child_not_found:'予約V2の児童情報を確認してください', child_inactive:'現在利用できない児童、またはこの事業所に所属していない児童です', source_changed:'本文が変更されました。最新の内容で公開前の確認をやり直してください', already_published:'現在の本文は公開済みです', publication_changed:'公開内容が変更されています。最新の状態を確認してください', guardian_not_linked:'今は閲覧できる保護者の紐付けがありません' })[reason] || reason || '公開条件を確認してください';
}
