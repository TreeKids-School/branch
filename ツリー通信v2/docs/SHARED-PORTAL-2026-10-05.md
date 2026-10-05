# 予約V2の共有保存への接続

2026-10-05 の利用者指示により、ブラウザー仮保存版から予約V2の共有保存へ接続するフロント実装を追加した。旧データのコピー・照合結果・実サーバー配備結果は、予約V2側の移行記録を参照する。この資料の検証は合成データのみであり、移行完了の根拠ではない。

## 接続と保存

- iframe は Firebase 認証トークン、パスワード、クラウド接続設定を受け取らない。親ウィンドウの same-origin / source を確認し、RPC の結果だけを受け取る。
- 通常モードは `shared-firestore`。親が `storageMode: browser-preview` を明示したときだけ従来の IndexedDB を利用する。共有保存の失敗でブラウザー仮保存へ切り替えることはない。
- `portalFirestore.js` が従来の Firestore 風 API を維持する。`sharedFirestore.js` は read set と各文書の version、および書込み予定を親へ渡す。日報・個別通信・日付索引・変更履歴の原子性と権限は、親の callable が検証する。
- confirmed `aborted` のときだけ、transaction callback を最新文書で再実行する（最大5回）。通信の不確かな失敗は同じ `attemptId` を用いて1回再試行する。
- 購読は8秒ごとにまとめて取得し、非表示タブでは定期取得を停止する。フォーカス復帰・自身の保存後は即時取得する。保存前から進行していた古い購読応答は採用しない。
- 入力途中の下書きは既存の UID・事業所・日付・児童単位で端末内に保護する。サーバーに保存済みの本文とは区別する。

## RPC 契約

要求は `{type:'tree-tsushin:rpc', id, operation, payload}`、応答は `{type:'tree-tsushin:rpc-result', id, ok, value}` または `{id, ok:false, error:{code,message}}`。

- `read`: `{documents?:string[], queries?:[{path,constraints}]}` → `{documents:[{path,data,version}], queries:[{path,documents:[{path,data,version}]}]}`。queries は要求と同順。文書なしは `data:null`。
- `commit`: `{attemptId, reads:[{path,version}], writes:[{kind,path,data?,options?}]}`。親の成功応答後にのみ保存完了として返す。
- `syncDay`: `{facilityId,date}` → `{added,skipped,...}`。画面の「予約名簿を取り込む」から明示実行し、その後、記録と児童マスターを再取得する。
- Timestamp は `__treeTsushinBrowserTimestamp` と seconds / nanoseconds、Date は `__treeTsushinDate` の ISO 文字列。arrayUnion 等は従来の `__treeTsushinBrowserOperation` を維持する。

## 管理者による原文確認

「業務・設定」から「移行した旧データ・照合保留」を開く。`meta/migration_unresolved_index` は一覧用、`legacyArchive/{archiveId}` は選択時に1件ずつ取得する。種別・日付・名称等で絞り込み、本文・予定・メモ・日報を読みやすく表示する。その他の項目は原文 JSON を開いて確認できる。すべて読取り専用で、当日の通信へ混ぜたり、統合状態を変更したりしない。管理者以外に入口を表示せず、権限制御はサーバーでも独立して行う。

生年月日相違で照合保留の児童は、児童名を変えずにカード・追加候補へ「照合保留」「生年月日相違」を表示する。`candidateChildId` は照合候補として保持し、統合IDへ書き換えない。当日一覧または追加選択に片方があれば、候補関係にあるもう片方を追加候補から除外する。名前が同じだけの児童をこの判定で除外することはない。予約名簿取込みが `reviewRequired` を返した場合は、追加しなかった人数と理由を表示する。

## 限定検証の結果

- `node scripts/test-shared-portal.mjs`: 7項目成功。値のシリアライズ、文書・一覧取得、競合再試行、同一キーの通信再試行、ローカル保存へ退避しないこと、名簿取込み、まとめた購読を合成RPCで検証。
- `node scripts/verify-shared-portal-ui.mjs`: ローカル配信＋使い捨て Edge で、予約名簿取込みの一覧反映、PC・390pxスマホの原文表示・画面遷移、編集操作なし、一般スタッフへの入口非表示を確認。未処理のブラウザー例外なし。実DB・旧DB・利用者のブラウザー保存領域には接続していない。
- `npm run build:portal`: 成功。直接クラウド接続を含めない分離ガード成功。既存の bundle size / Browserslist 更新案内は残る。
- `node --test tests/communication-child-identity.test.mjs`: 4項目成功。保留児童→予約候補、予約候補→保留児童の双方で重複追加を防ぎ、古い日報も名簿の候補情報を参照する。氏名・候補ID・元の日報オブジェクトを変更しないことを確認。
- 従来の IndexedDB 検証スクリプトは、起動セッションに `browser-preview` を明示するよう変更した。今回の接続作業ではその全回帰検証は行っていない。

実データのコピー件数・照合保留・本番の権限・配信確認は予約V2側で別途検証する。本文の保存や入力完了で、保護者への公開・LINE送信は行わない。
