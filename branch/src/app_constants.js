// ── App Constants ─────────────────────────────────────────────────────────────

export const APP_VERSION = '26.09.18.1';

export const DAILY_LIMIT = 20;

export const STAFF_OPTIONS = ['ブラック', 'パープル', 'さくら', 'ブラウン', 'ブルー', 'ネイビー'];

export function getStaffInstruction(staff) {
    if (!staff) return '';
    const map = {
        'ブラック': '- 文体: 明瞭で力強い表現を好む。簡潔にまとめる。',
        'パープル': '- 文体: 丁寧で落ち着いた表現。情緒的なニュアンスも大切にする。',
        'さくら': '- 文体: 温かみがあり、やわらかい表現。ひらがな多め。',
        'ブラウン': '- 文体: 安心感を与える穏やかな文体。保護者に寄り添う言い回し。',
        'ブルー': '- 文体: 爽やかで明るい表現。前向きな言葉を多く使う。',
        'ネイビー': '- 文体: 信頼感のある落ち着いた表現。論理的にまとめる。',
    };
    return map[staff] || '';
}

// parseForceSheet / buildForceSheet
export { parseForceSheet, buildForceSheet } from './utils/parseForceSheet';

export function getRoleFromPost(post) {
    if (!post) return '';
    const posts = Array.isArray(post) ? post : [post];
    if (posts.includes('管理者')) return '管理者';
    if (posts.includes('児発管')) return '児発管';
    if (posts.includes('児童指導員・保育士')) return '児童指導員・保育士';
    if (posts.includes('指導員')) return '指導員';
    if (posts.includes('スタッフ')) return 'スタッフ';
    return '';
}

/**
 * システムアップデート履歴データ
 * - version: バージョン文字列
 * - date: リリース日付
 * - title: バージョンの主なテーマ
 * - items: 各更新項目
 *   - title: 項目名
 *   - location: どこで（場所）
 *   - action: どんな操作で（操作手順）
 *   - description: 詳細な説明・ポイント
 *   - badge: 'new' | 'update' | 'fix'
 */
export const UPDATE_TOUR_STEPS = [
    {
        id: 'tour-monthly-import',
        title: '送迎アプリからの月間児童出席データ反映',
        targetId: 'guide-import',
        mobileTargetId: 'guide-import-mobile-btn',
        inMobileMenu: true,
        badge: 'new',
        focusLabel: '画面右上の「インポート」ボタン（スマホでは右下メニュー内）',
        description: '毎月、送迎管理アプリの月間データを日誌に反映し、その月の各児童の出席予定・送迎時間を一括自動登録します。（※毎月の取込作業はいったんブラックが担当します）'
    },
    {
        id: 'tour-program-staff',
        title: 'プログラムの担当スタッフ設定',
        targetId: 'guide-program-staff',
        openProgram: true,
        badge: 'new',
        focusLabel: 'メイン画面「プログラム」欄の「担当スタッフ」選択ボックス',
        description: '本日のプログラム活動をどのスタッフが担当するかを記録できます。一覧テーブルのヘッダーやタブにも担当者名が表示されます。'
    },
    {
        id: 'tour-tag-rename',
        title: 'タグの名称変更（リネーム）',
        targetId: 'guide-settings',
        mobileTargetId: 'guide-settings-mobile-btn',
        inMobileMenu: true,
        badge: 'new',
        focusLabel: '画面右上の「設定（歯車）」ボタン（スマホでは右下メニュー内）',
        description: '「設定」画面の「タグ管理」タブから、登録済みタグの名称をいつでも直接書き換えて変更できます。'
    },
    {
        id: 'tour-tag-insert-text',
        title: 'タグ選択時の自動挿入文字カスタマイズ',
        targetId: 'guide-settings',
        mobileTargetId: 'guide-settings-mobile-btn',
        inMobileMenu: true,
        badge: 'new',
        focusLabel: '画面右上の「設定（歯車）」ボタン（スマホでは右下メニュー内）',
        description: 'チャットメモでタグを選択した際に、入力欄の冒頭へ自動で差し込む定型文（プログラム内容など）をタグごとに自由に設定できます。'
    },
    {
        id: 'tour-chat-edit-tag',
        title: 'チャットメモ編集中にタグの付け替え',
        targetId: 'guide-chat-textarea',
        inMemoPanel: true,
        memoTab: 'chat',
        badge: 'new',
        focusLabel: '個別パネル「チャットメモ」入力欄',
        description: '投稿済みチャットメモの編集時に、文章だけでなくタグの追加・変更・解除が自由に行えます。'
    },
    {
        id: 'tour-table-swipe',
        title: '横スワイプで業務タブ切り替え',
        targetId: 'guide-table-section',
        badge: 'update',
        focusLabel: 'メイン業務テーブル一覧',
        description: 'スマホやタブレットで画面を左右にスワイプするだけで、「学習」「プログラム」「時間」「ツリー通信」などの表示タブを素早く切り替えられます。'
    },
    {
        id: 'tour-staff-icon-color',
        title: 'ツリー通信担当スタッフのアイコンカラー連動',
        targetId: 'guide-child-name',
        badge: 'update',
        focusLabel: 'メイン業務テーブルの児童名枠',
        description: '児童枠を長押しして担当スタッフを選択すると、スタッフ固有のカラーが児童名右上の丸アイコンに自動反映されます。'
    },
    {
        id: 'tour-greeting-template',
        title: '挨拶テンプレのワンタップ即座挿入＆長押し編集',
        targetId: 'guide-tree-textarea',
        inMemoPanel: true,
        memoTab: 'tree',
        badge: 'update',
        focusLabel: '個別パネル「ツリー通信」入力欄',
        description: '「挨拶テンプレ」ボタンを押すと文末に定型挨拶が即座挿入されます。長押しすると文面の編集・保存ができます。'
    }
];

export const UPDATE_HISTORY = [
    {
        version: '26.09.18.1',
        date: '2026-09-18',
        title: '送迎アプリからの月間出席データ取込・プログラム担当者・タグ管理などの機能改善',
        items: [
            {
                id: 'tour-monthly-import',
                title: '送迎アプリからの月間児童出席データ反映（月初インポート）',
                badge: 'new',
                location: '画面右上「インポート」メニュー / 各日の日誌テーブル',
                action: '毎月初めに送迎管理アプリから出席データを手動インポート（※ブラックが毎月担当して一括取込作業を行います）',
                description: '毎月、送迎管理アプリから当月1ヶ月分の児童出席情報を手動インポートできるようになりました。これにより、月初にはその月の各児童の登所予定・送迎時間が日誌に自動で事前登録されます。※なお、こちらのインポート作業はいったん【ブラック】が毎月初めにまとめて実施しますので、各現場のスタッフ様が個別に操作する必要はありません（自動的にその月の児童出席情報が反映されます）。'
            },
            {
                id: 'tour-program-staff',
                title: 'プログラムの担当スタッフ設定',
                badge: 'new',
                location: 'メイン画面「プログラム」入力欄 / メイン業務テーブル',
                action: 'プログラム欄の「担当スタッフ」セレクトボックスから選択',
                description: '本日のプログラム活動をどのスタッフが担当するかを記録できるようになりました。複数プログラムにも対応し、メイン業務テーブルのヘッダーやタブにも担当者名が表示されます。'
            },
            {
                id: 'tour-tag-rename',
                title: 'タグの名称変更（リネーム）',
                badge: 'new',
                location: '画面上部「歯車アイコン（設定）」 ＞ 「タグ管理」タブ',
                action: 'タグ名の入力欄を直接タップして文字を打ち替え ＞ 「保存して閉じる」',
                description: '登録済みタグの名称をいつでも直接変更できるようになりました。タグ名を変更しても、紐付けられた自動挿入テキストはそのまま保持されます。'
            },
            {
                id: 'tour-tag-insert-text',
                title: 'タグ選択時の自動挿入文字カスタマイズ',
                badge: 'new',
                location: '画面上部「歯車アイコン（設定）」 ＞ 「タグ管理」タブ',
                action: '各タグの右側「自動挿入文字」欄に入力。「＋プログラム内容」ボタンでプログラム概要の自動挿入も可能',
                description: 'チャットメモでタグを選んだ際に、入力欄の冒頭に自動で入る定型文を設定できるようになりました。空欄に設定するとタグのみが付与されます。'
            },
            {
                id: 'tour-chat-edit-tag',
                title: 'チャットメモ編集中にタグの変更・付け替え',
                badge: 'new',
                location: '個別パネル「チャットメモ（赤）」 ＞ 各メッセージの「鉛筆アイコン（編集）」',
                action: '編集ボタンを押すと入力欄の上に表示されるタグ一覧チップをタップ（複数選択・解除可能）',
                description: '投稿済みチャットメモの編集時に、文章だけでなくタグの付け替え・追加・解除も自由に行えるようになりました。右上の「タグ解除」で一括解除も可能です。'
            },
            {
                id: 'tour-table-swipe',
                title: 'スマホ・タブレットの横スワイプで業務タブ切り替え',
                badge: 'update',
                location: 'メイン業務テーブル（学習／プログラム／時間／ツリー通信／今後の予定／備考）',
                action: 'テーブルまたはヘッダー部分を指で左右に横フリック（スライド）',
                description: '左スワイプで次のタブ、右スワイプで前のタブへスムーズに切り替わります。感度を向上させ、スマホでも軽快にタブ移動が可能です。'
            },
            {
                id: 'tour-staff-icon-color',
                title: 'ツリー通信担当スタッフのアイコンカラー連動',
                badge: 'update',
                location: 'メインテーブルの児童名右上の担当スタッフ丸アイコン',
                action: '児童枠を長押し ＞ 担当スタッフを選択',
                description: 'Firestore（staffコレクション）に登録されたスタッフ固有のアイコン色（iconColor）が、児童名横の丸アイコンや選択メニューに自動反映されます。'
            },
            {
                id: 'tour-greeting-template',
                title: '挨拶テンプレのワンタップ即座挿入＆長押し編集',
                badge: 'update',
                location: '個別パネル「ツリー通信（緑）」 ＞ 「挨拶テンプレ」ボタン',
                action: 'ボタンをタップで文末に即座挿入 / ボタンを長押しでテンプレ設定画面が開く',
                description: '文章作成の手間を減らすため、ワンタップですぐに定型挨拶が挿入されるようになりました。長押しで自由に文面を変更できます。'
            }
        ]
    },
    {
        version: '26.09.08.1',
        date: '2026-09-08',
        title: '送迎CSVインポート機能強化・定員自動判定',
        items: [
            {
                title: '送迎管理表CSVインポートの重複制御',
                badge: 'new',
                location: '画面右上メニュー ＞ 「CSVインポート」',
                action: 'CSVファイルを選択後、重複データに対して「スキップ」または「上書き」を選択',
                description: '1か月分の出席・送迎予定を一括インポートする際、既存のデータと突き合わせて重複を確認し、安全にスキップまたは上書きできるようになりました。'
            },
            {
                title: '定員（10名）超過時の自動キャンセル待ち配置＆通知',
                badge: 'new',
                location: 'CSVインポート画面 または 児童追加時',
                action: '11人目以降の児童が追加されると自動判定',
                description: '定員を超過した児童は自動的に「キャンセル待ち」枠に配置され、登録時に警告ダイアログで確認通知が表示されます。'
            },
            {
                title: '児童一覧の送迎時間順自動ソート',
                badge: 'update',
                location: 'メイン業務テーブル一覧',
                action: '自動適用（送迎時間の早い順に並び替え）',
                description: '当日の運行予定を把握しやすいよう、児童の並び順が送迎時間の早い順に自動ソートされるようになりました。'
            }
        ]
    }
];
