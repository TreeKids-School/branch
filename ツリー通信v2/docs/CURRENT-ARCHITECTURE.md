# ツリー通信システム：現行構成と V2 への引継ぎ

> 2026-10-05追記：この初期調査の機能概説には、関数・保存項目の存在を現在の操作入口と混同した箇所があります。[最新の機能対応・訂正表](mockups/2026-10-05-feature-completion/FEATURE-MATRIX.md)を優先してください。個別DocViewer・支援編集・個別印刷、履歴の自動復元、全員コピー、手動並び替え、出欠スワイプ、職員業務項目選択の到達性と、CSV期間・PDF印刷・Excel保存方式を再整理しました。元アプリにも残存していた処理を今回V2で削除したという意味ではありません。

調査日：2026-10-04

この文書は、ローカルにある現行ソースを読み取った構成調査です。実データの取得・変更、現行アプリへのログイン、外部 AI への送信、デプロイは、この調査では行っていません。「実装がある」と「配信環境で正常動作する」は区別しています。以下の行番号は調査時点の現行 `branch/` ソースを指します。

## 1. どれが現行か

| 場所 | 構成 | ソース上の接続先・配信先 | 扱い |
|---|---|---|---|
| リポジトリ直下の `index.html`・`functions/` | CDN 版 React 18、ブラウザ Babel、大きな単一 HTML。Realtime Database と HTTP Functions を利用 | `octopus-5735b` | 旧構成の参照用。V2 の起点にしない |
| `branch/` | Vite 5、React 18、Tailwind CSS、Firebase JS SDK 10、Lucide、xlsx | Auth / Firestore は `test-octopus-5b254`、Hosting site は `test-branch-46c5a` | ユーザー指定サイトに対応する現行構成。既存データを保持する対象 |
| `ツリー通信v2/` | 現行 `branch/` の UI を引き継いで分離する開発用フォルダ | 開発用の接続方針は V2 自身の設定を参照 | 現行データへ直接接続するコピーとして扱わない |

根拠：直下 `package.json`・`.firebaserc`・`firebase.json`、`index.html:166` 以降、`branch/package.json`、`branch/.firebaserc`、`branch/firebase.json`、`branch/src/firebase.js:15`。

現行の `branch/firebase.json` は Hosting と Firestore の定義を持ち、Hosting の全パスを `index.html` に戻します。Functions の登録や `/api/gemini` 専用 rewrite はありません。一方、直下の旧設定は `/api/storage`・`/api/pii`・`/api/gemini` を Functions へ転送します。この二つを混ぜると、保存方式も配備先も変わります。

`README.md` は現行 `branch/` と旧構成の違いを十分に説明しておらず、AI や Functions の説明を、そのまま現行で利用中と解釈しないこと。

## 2. 現行画面で引き継ぐ機能

エントリポイントは `branch/src/main.jsx`、中心は `branch/src/App.jsx` です。App が認証、事業所・日付の選択、日次データ、児童の選択、スタッフ勤務、各モーダル、保存とリアルタイム同期をまとめています。

| 領域 | ソースから確認できた機能 | 主な実装 |
|---|---|---|
| ログイン | Firebase のメール・パスワード認証。ログイン後に児童・スタッフ・事業所を取得 | `components/Login.jsx`、`App.jsx:678` |
| 事業所・日付 | 事業所選択、事業所に応じた色、日付移動、カレンダー、記録のある日付の取得 | `App.jsx`、`CalendarModal.jsx`、`utils/themeUtils.js` |
| 当日の児童 | 児童マスターから当日の一覧へ追加、通常・キャンセル待ち・欠席の区分、並び替え | `App.jsx:1086`、`AddChildModal.jsx` |
| 当日の業務表 | 学習、プログラム、送迎時刻・終了時刻・迎え場所、通信本文、今後の予定、備考 | `App.jsx:3143` |
| ツリー通信作成 | 児童別の文章入力、チャットメモの参照・挿入、担当スタッフ、挨拶テンプレート、入力完了の指定 | `MemoPanel.jsx`、`App.jsx:1795` |
| 編集の保護 | ブラウザ内下書き、競合表示、他端末の編集ロック、自動保存 | `MemoPanel.jsx:490` 以降、`App.jsx:267` 以降 |
| コピーと送信確認 | 一人分・選択分・全員分のクリップボードコピー、兄弟分の結合、送信済みチェック | `App.jsx:1970` 以降、`App.jsx:3509` |
| 支援記録・書類 | 支援結果・支援計画・支援項目・Force シートの編集とプレビュー | `DocViewer.jsx`、`utils/parseForceSheet.js` |
| 施設共通記録 | 特記事項、活動、複数プログラムと内容・担当、業務管理日誌用の情報 | `App.jsx` の `globalLog` |
| スタッフ勤務 | 出勤・公休・有給、開始・終了時刻、役割・業務項目 | `App.jsx:601`、`AttendanceModal.jsx` |
| 変更履歴 | 児童ごとの本文・支援記録・業務表・メモ変更を日単位に保存、過去値の復元 | `App.jsx:1190`、`LogModal.jsx` |
| 取込み | 送迎 CSV の確認・新規のみ／上書き選択・日付と事業所への反映、バックアップ CSV の復元 | `CSVImportModal.jsx`、`BackupImportModal.jsx` |
| 書き出し・印刷 | 日・週・月・年・全期間の CSV、業務管理日誌の Excel 反映、個別／一括印刷 | `App.jsx:2136`、`ExportModal.jsx`、`utils/print.js` |
| 共通設定・案内 | タグ、挿入文、タグと表の対応、OK ワード、スタッフ別挨拶、ヘルプ、更新案内 | `SettingsModal.jsx`、`HelpGuide.jsx`、`UpdateTour.jsx` |

通常枠の上限値は `App.jsx:1086` で 10 に固定されています。予約システムの定員や事業所設定へ連携するときは、この値が正しいとは自動判断しないこと。

### 連絡文に関する現在の状態

- 本文は `results[childId].D`、今後の予定は `results[childId].futurePlan`。
- `results[childId].isCompleted` はスタッフが「入力を完了して保存」を選んだ状態。
- `dailyTable[childId].sentChecked` は手動の送信済みチェック。
- 本文は入力が一段落して約 2 秒、今後の予定は約 800 ミリ秒で保存される（`MemoPanel.jsx:539`）。「完了」ボタンを押す前の下書きも保存される。
- コピーはクリップボード操作。送信済みチェックは LINE の配信結果と連携していない。
- 調査した有効な画面からは、写真アップロード、画像添付、LINE API 送信、保護者向け公開の実装を確認できない。これらは V2 の追加設計になる。

## 3. 保存先の地図

現在のブラウザは Firestore に直接アクセスします。`useStorage.js:7` の `isLocal()` は常に `false` を返すため、ファイルを複製するだけではローカル保存になりません。

| Firestore のパス | 内容・役割 | 読書きの主な実装 |
|---|---|---|
| `children/{childId}` | 児童マスター。日次一覧の児童とは別に存在 | `hooks/useStorage.js:104` |
| `offices/{officeId}` | 事業所設定・名称・テーマなど | `hooks/useStorage.js:153` |
| `staff/{staffId}` | スタッフ情報・名前・役割など。取得失敗時だけ `staffs` を試す処理あり | `hooks/useStorage.js:328` |
| `reports/{officeId}_{YYYY-MM-DD}` | 当日児童 `children`、チャット `messages`、児童別 `results`、全体まとめ `summaryC`、業務表 `dailyTable`、共通記録 `globalLog`、更新日時、編集ロック `activeLocks` | `App.jsx:754`、`hooks/useStorage.js:159` |
| `reports/{YYYY-MM-DD}` | 事業所指定のない保存処理との互換パス | 同上 |
| `children/{childId}/app_categories/書類管理/tree_communications/{YYYY-MM-DD}` | 他アプリ共有用の個別記録。`tree_comm_text`、`future_plan`、迎え場所・時刻・備考・更新日時 | `App.jsx:1153`、`hooks/useStorage.js:233` |
| `attendance/{officeId}_{YYYY-MM-DD}` | スタッフごとの当日勤務情報。事業所なしの日付キーも扱う | `hooks/useStorage.js:371` |
| `changeLogs/{officeId}_{YYYY-MM-DD}` | 当日の変更履歴配列、日付、事業所、更新日時 | `hooks/useStorage.js:388` |
| `meta/reports_index_{officeId}` | 記録のある日付一覧。事業所なしは `meta/reports_index` | `hooks/useStorage.js:207` |
| `meta/greeting_templates` | スタッフ別の挨拶テンプレート | `App.jsx:869` |
| `meta/ok_words` | 実名確認等で用いる OK ワード | `App.jsx:885` |
| `meta/tag_settings` | タグ・挿入文・表との対応 | `App.jsx:901` |
| `meta/importLock` | CSV 取込み中の他端末操作ロック | `App.jsx:734`、`CSVImportModal.jsx:326` |
| `daily_reports/{id}` | `childId`、日付 Timestamp、`externalInfo`、`staffName` など。未接続の旧パネルが使う保存先 | `hooks/useStorage.js:285`、`TreeCommPanel.jsx` |

### 二重保存と他アプリ共有

`saveDailyData`（`App.jsx:1139`）と `saveDailyDataGranular`（`App.jsx:1190`）は、日次 `reports` と児童別 `tree_communications` に同じ通信内容を書き込みます。保存は複数の Promise をまとめて待つ構成で、複数ドキュメントを一つの原子的トランザクションで更新する構成ではありません。

児童別パスのキーには **事業所が含まれません**。同じ児童が同じ日に複数事業所を利用する場合の扱いは、連携前に整理が必要です。また、個別側には `isCompleted` や LINE 送信確認を同じ構成で保存していないため、個別本文が存在するだけで「完成・公開済み」と判定できません。

`MemoPanel.jsx:490` は児童別の `tree_communications` を監視し、別アプリの変更を画面へ反映します。Firestore rules には `supportPlans`、`professionalPlans`、`monthlySettings`、`children/{childId}/treeNewsletters` 等、他アプリ向けと思われるパスもあります。この Firebase プロジェクトを通信アプリ専用として扱わないこと。

ブラウザの `localStorage` にも、事業所選択、表示設定、テンプレート用設定、下書き等を `care_pro_*` の名前で保持します。V2 は保存キーも分離し、現行の下書きを混ぜない設計が必要です。

## 4. 認証・外部サービス・未接続コード

### 認証とアクセス制御

- Firebase Authentication のメール・パスワード認証を使用。
- 現行ソースには、特定 ID で認証に失敗した場合に利用者を自動作成する分岐があります（`Login.jsx`）。V2 の通常ログインに引き継ぐかを分けて検討する必要があります。
- `App.jsx:710` のポータル認証ブリッジは `window.message` の payload に含まれる資格情報でログインします。ソースには送信元 origin の確認がありません。予約 V2 との認証連携に、この処理を流用しないこと。
- 現行 Firestore rules は多くのパスで `request.auth != null` を基準に許可しています。保護者が自分の児童の公開記録だけを見られる境界は、このルールにはありません。
- Auth へのログイン成功と、アプリ上の管理者・保護者などのロールは別の設計事項です。現行画面はスタッフ向けで、ロール分離を確認できません。

### AI

`src/hooks/useAI.js` には Gemini で通信や支援記録を生成するコードが残っています。ただし現行 `src` 内にこの hook を import する利用箇所を確認できず、動作中の AI 機能とは扱えません。

残存コードは `/api/gemini` を呼びますが、現行 Hosting 設定に専用 rewrite はありません。`branch/functions/index.js` は Vertex AI の別プロジェクト `octopus2-ae965` を固定し、`gemini-1.5-flash` / `gemini-1.5-pro` を指定しています。モデルの現在の利用可否や配備状況は未確認です。JSON 応答も、hook が期待する `text` / `result` と Functions の直接オブジェクト応答が一致しない分岐があります。

V2 の「バディの 3 行」は、この残存コードを接続し直せば完成する機能ではありません。送信内容の選別、認証されたサーバー API、事実に沿う生成、確認と公開、再生成履歴、料金管理を新たに設計します。

### 残っているが現行画面に接続していないもの

`TreeCommPanel.jsx` は `daily_reports` を編集する別実装ですが、現行 App は `MemoPanel.jsx` を使用しています。`Header.jsx`、`DashboardView.jsx`、`ActivitiesModal.jsx`、`NoticeModal.jsx` なども、ファイルの存在だけで有効画面とは判断しないこと。改修の起点は `main.jsx` からの import 関係です。

## 5. 元データを守るために分離が必要な処理

| 現行の挙動 | 単純コピーで起きること | V2 の対応方針 |
|---|---|---|
| Firebase 接続先の固定、常時 Firestore 保存 | V2 で操作した内容が現行に反映される | エミュレーター等へ強制接続し、既存クラウドへ接続できない設定にする |
| ログイン後に過去の変更履歴を自動削除 | 閲覧調査でも現行 `changeLogs` を消しうる | 自動削除を V2 で無効化する |
| タグ読込時の補完・移行書込み | 単に開くだけでも `meta/tag_settings` を変更する | 分離された保存先だけで実行する |
| 児童パネルを開くと編集ロックを書込む | 現行スタッフの編集に影響する | ロックも V2 の保存先で完結させる |
| 本文・予定の自動保存、他アプリ連動 | 下書きや読込差分が現行・共有パスへ書き戻される | 現行への読込と V2 の編集保存を別の経路にする |
| CSV 取込み・履歴復元・児童追加 | 本文や日次一覧、共有記録、マスターを変更する | 架空データのみで先に検証する |
| 旧ポータル認証・AI エンドポイント | 意図しない認証・外部送信につながる | 分離段階では無効化する |

自動削除の根拠は `App.jsx:694` と `useStorage.js:412` です。日付が今日より前の `changeLogs` を検索して削除します。タグの自動書込みは `App.jsx:903` 以降、編集ロックは `App.jsx:267` 以降にあります。

既存の `isSandboxMode` は完全な保護境界ではありません。日付・事業所を変えると解除され（`App.jsx:730`）、履歴削除・設定変更・ロック等を包括して止める構成でもありません。V2 の安全性はこのフラグだけに依存させないこと。

## 6. V2 で順に解決する課題

1. **接続の分離と現行機能の保存**：現行サイト・Firestore を変えず、V2 を独立した開発対象として起動できるようにする。エミュレーターの架空児童で自動保存・コピー・CSV・印刷を確認する。
2. **通信の状態を明確化**：下書き、スタッフ確認済み、保護者公開済みを区別する。現行の `isCompleted` と `sentChecked` は自動的に公開権限へ読み替えない。
3. **児童・事業所 ID の対応**：予約 V2 との ID 対応表を用意し、氏名一致だけで紐付けない。同日複数事業所、再取込み、本文修正、削除・公開取消の扱いを決める。
4. **既存からの一方向取込み**：最初は現行を読取り元として、確定した通信を V2 の下書きへ取り込む。元の project / path / office / child / date / revision を残して重複を防ぎ、取込み差分を確認できるようにする。
5. **写真の所在を確認**：現行コード内に写真保存機能を確認できないため、スタッフが実際に保管する場所を把握してから設計する。
6. **保護者公開の境界**：スタッフの内部メモ、支援記録、送迎情報などを、通信本文と一緒に保護者公開へ流さない。予約 V2 の家族と児童の権限に従って公開する。
7. **バディの言葉**：公開対象の通信本文から 3 行の下書きを生成し、原文・生成時刻・確認・公開状態を保存する。未記載の出来事・成長・将来の活動は作らない。
8. **運用保守**：日次全体の read-modify-write と個別更新の競合、二重保存の途中失敗、履歴保持期間、バックアップ復元、ログに児童やスタッフ情報を出す処理を整理する。

追加で確認したい実装差分：`BackupImportModal.jsx:163` の新規マスター保存呼出しは `userId` を渡さず、`useStorage.js:115` は `createdBy` にその値を使います。現行 rules の新規作成条件と整合するか、実データを使わない検証が必要です。現在の利用者操作で失敗したと断定するものではありません。

## 7. 未確認事項

- 現在の配信 bundle がローカル `branch/` と完全に同じか。
- 現行 Firestore に実際に配備されている rules、件数、個々のレコードの状態。
- 各スタッフの実運用、通信の「完了」「送信済み」の運用上の意味。
- 写真の保管先と権限、過去 LINE データとの対応。
- 残存 Functions の配備・認証・課金・AI モデル利用状況。
- 予約 V2 との実データの児童・事業所対応、公開文の承認手順。

この文書の作成にあたり、現行の児童・通信・認証ユーザーのエクスポートを取得していません。実データや資格情報をこの文書へ含めないこと。
