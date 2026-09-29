// ── App Constants ─────────────────────────────────────────────────────────────

export const APP_VERSION = '26.09.29.5';

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
        id: 'tour-staff-assigned-greeting',
        title: '担当スタッフ決定時の挨拶文自動入力',
        targetId: 'guide-child-name',
        badge: 'new',
        focusLabel: 'メイン業務テーブルの児童名枠（長押し）',
        description: '児童枠を長押ししてツリー通信の担当スタッフを選択すると、そのスタッフ固有の挨拶文がツリー通信へ自動的に挿入されます。（※既に挨拶が入力済みの場合は重複挿入されません）'
    },
    {
        id: 'tour-tree-completed-ring',
        title: 'ツリー通信「入力を完了して保存」とチェックマーク表示',
        targetId: 'guide-tree-textarea',
        inMemoPanel: true,
        memoTab: 'tree',
        badge: 'new',
        focusLabel: 'ツリー通信画面の「入力を完了して保存」ボタン / 児童名横の担当者アイコン',
        description: 'ツリー通信に「入力を完了して保存」ボタン（赤色・確認付き）が追加されました。完了保存された児童は、メイン一覧の担当者丸アイコンにチェックマークが付き、一目で作成完了が分かります。'
    },
    {
        id: 'tour-chat-import-modal',
        title: 'チャットメモからの一括・順番指定反映',
        targetId: 'guide-tree-textarea',
        inMemoPanel: true,
        memoTab: 'tree',
        badge: 'new',
        focusLabel: 'ツリー通信画面「チャットメモから反映」ボタン',
        description: '「チャットメモから反映」ボタンを押すと大型ウィンドウが表示され、挿入したいメモをタップした順番（①, ②, ③...）で選んで「挿入」を押すだけで、メモごとに1行改行してツリー通信に順番通り反映されます。'
    },
    {
        id: 'tour-tree-program-insert',
        title: 'プログラム内容のワンタップ挿入',
        targetId: 'guide-tree-textarea',
        inMemoPanel: true,
        memoTab: 'tree',
        badge: 'new',
        focusLabel: 'ツリー通信画面「プログラム」ボタン',
        description: 'ツリー通信入力中に「プログラム」ボタンを押すと、本日のプログラム内容をワンタップで文末へ挿入できます。'
    },
    {
        id: 'tour-greeting-settings',
        title: 'スタッフ別 挨拶テンプレの設定・変更',
        targetId: 'guide-settings',
        mobileTargetId: 'guide-settings-mobile-btn',
        inMobileMenu: true,
        badge: 'update',
        focusLabel: '画面右上の「設定（歯車）」＞「挨拶設定」タブ',
        description: '設定画面から各スタッフの定型挨拶文をいつでも確認・変更・保存できます。ツリー通信の「挨拶テンプレ」ボタンを押すと、登録された挨拶文を即座に文末へ挿入することも可能です。'
    },
    {
        id: 'tour-chat-memo-window',
        title: 'チャットメモの独立ウィンドウ化',
        targetId: 'guide-chat-textarea',
        inMemoPanel: true,
        memoTab: 'chat',
        badge: 'update',
        focusLabel: 'チャットメモウィンドウ',
        description: 'チャットメモは独立した専用ウィンドウとして表示されるようになり、スタッフ間の記録や確認がスムーズに行えるようになりました。'
    },
    {
        id: 'tour-table-swipe',
        title: '横スワイプで業務タブ切り替え',
        targetId: 'guide-table-section',
        badge: 'update',
        focusLabel: 'メイン業務テーブル一覧',
        description: 'スマホやタブレットで画面を左右にスワイプするだけで、「学習」「プログラム」「時間」「ツリー通信」などの表示タブを素早く切り替えられます。'
    }
];

export const UPDATE_HISTORY = [
    {
        version: '26.09.29.5',
        date: '2026-09-29',
        title: '変更履歴（Change Log）の保存不具合の修正',
        items: [
            {
                id: 'fix-changelog-persistence',
                title: '本日の変更履歴が消える問題を修正',
                badge: 'fix',
                location: '変更履歴モーダル / データベース',
                action: 'タスクキルやリロード後の確認',
                description: '変更履歴データを専用コレクションに保存する際のセキュリティルール設定が漏れていたため、リロード等を行うと保存されていたはずの履歴が消えてしまう不具合を修正しました。今後は確実に履歴が保存され、いつでも復元可能です。'
            }
        ]
    },
    {
        version: '26.09.24.1',
        date: '2026-09-24',
        title: 'ツリー通信の入力完了・完了チェックマーク・チャットメモ順序反映・挨拶自動挿入などの機能改善',
        items: [
            {
                id: 'tour-tree-completed-ring',
                title: 'ツリー通信「入力を完了して保存」とチェックマーク表示',
                badge: 'new',
                location: '個別パネル「ツリー通信（緑）」下部 / メイン一覧の児童名横アイコン',
                action: 'ツリー通信入力後、下部の「入力を完了して保存（赤色）」を押す',
                description: 'ツリー通信に入力を完了して保存するボタン（赤色・確認ダイアログ付き）を追加しました。完了保存された児童は、メイン一覧の担当者丸アイコンに緑のチェックマークが付き、作成完了が一目で把握できます。'
            },
            {
                id: 'tour-staff-assigned-greeting',
                title: '担当スタッフ決定時の挨拶文自動入力',
                badge: 'new',
                location: 'メイン業務テーブルの児童名枠（長押しメニュー）',
                action: '児童枠を長押しして担当スタッフを選択',
                description: '児童のツリー通信担当スタッフを長押しメニューから設定した際、そのスタッフの挨拶テンプレがツリー通信の末尾へ自動挿入されます。（※既に挨拶が入力されている場合は重複挿入されません）'
            },
            {
                id: 'tour-chat-import-modal',
                title: 'チャットメモからの一括・順番指定反映',
                badge: 'new',
                location: '個別パネル「ツリー通信（緑）」 ＞ 「チャットメモから反映」ボタン',
                action: '「チャットメモから反映」ボタン ＞ メモを挿入したい順にタップ ＞ 「挿入」',
                description: 'チャットメモから反映するボタンを押すと大きなウィンドウが開き、挿入したいメモをタップした順番（①, ②, ③...）で選択できます。「挿入」を押すと、メモごとに1行改行を入れて順番通りツリー通信に挿入されます。'
            },
            {
                id: 'tour-tree-program-insert',
                title: 'プログラム内容のワンタップ挿入',
                badge: 'new',
                location: '個別パネル「ツリー通信（緑）」 ＞ 「プログラム」ボタン',
                action: '「プログラム」ボタンをタップして対象のプログラムを選択',
                description: 'ツリー通信の入力中に「プログラム」ボタンを押すことで、当日のプログラム内容をワンタップでツリー通信の末尾へ挿入できるようになりました。'
            },
            {
                id: 'tour-greeting-settings',
                title: 'スタッフ別の挨拶テンプレ設定・編集（設定画面）',
                badge: 'update',
                location: '画面右上「設定（歯車）」 ＞ 「挨拶設定」タブ',
                action: 'スタッフ名を選択して挨拶文面を編集 ＞ 「この挨拶を保存」',
                description: '挨拶テンプレの変更を設定画面に集約しました。各スタッフの挨拶文面を一覧で確認・編集でき、ツリー通信内の「挨拶テンプレ」ボタンからワンタップで即座挿入も可能です。'
            },
            {
                id: 'tour-chat-memo-window',
                title: 'チャットメモの独立ウィンドウ化',
                badge: 'update',
                location: 'チャットメモ（赤）',
                action: '学習・プログラム欄などをタップしてチャットメモを開く',
                description: 'ツリー通信や今後の予定のタブからチャットメモを分離し、独立した専用ウィンドウとして表示するように改善しました。'
            },
            {
                id: 'tour-monthly-import',
                title: '送迎アプリからの月間児童出席データ反映（月初インポート）',
                badge: 'new',
                location: '画面右上「インポート」メニュー / 各日の日誌テーブル',
                action: '毎月初めに送迎管理アプリから出席データを手動インポート（※ブラックが毎月担当して一括取込作業を行います）',
                description: '毎月、送迎管理アプリから当月1ヶ月分の児童出席情報を手動インポートできるようになりました。月初にはその月の各児童の登所予定・送迎時間が日誌に自動で事前登録されます。※取込作業は【ブラック】がまとめて実施します。'
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
                id: 'tour-table-swipe',
                title: 'スマホ・タブレットの横スワイプで業務タブ切り替え',
                badge: 'update',
                location: 'メイン業務テーブル（学習／プログラム／時間／ツリー通信／今後の予定／備考）',
                action: 'テーブルまたはヘッダー部分を指で左右に横フリック（スライド）',
                description: '左スワイプで次のタブ、右スワイプで前のタブへスムーズに切り替わります。スマホでも軽快にタブ移動が可能です。'
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
