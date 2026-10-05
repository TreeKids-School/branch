import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Copy, FileText, HelpCircle, MessageSquare, Settings, X } from 'lucide-react';
import './WorkspaceHelp.css';

const chapters = [
    {
        id: 'start', title: '予約V2から始める', Icon: HelpCircle,
        intro: '予約システムのスタッフメニューから「ツリー通信v2」を開きます。',
        items: [
            ['最初に事業所と日付を確認', '通信側で扱う事業所・日付を選びます。予約側で見ていた日付や児童が、自動で引き継がれるわけではありません。'],
            ['今日の児童を一覧へ', '「児童追加」でマスターを検索し、通常利用またはキャンセル待ちとして追加します。児童ごとの出欠・送迎時間・迎え場所・通信担当を確認してください。'],
            ['対象児童を見失わない', 'スタッフメモ、通信本文、今後の予定の編集画面には、児童名・事業所・日付を表示しています。編集を終えたら「保存して閉じる」で業務画面へ戻ります。'],
        ],
    },
    {
        id: 'memo', title: '気づきをメモに残す', Icon: MessageSquare,
        intro: '療育の合間に短く記録し、後から通信に使える形で残します。',
        items: [
            ['メモを保存すると一覧へ反映', '入力してタグを付け、「メモを保存」を押します。保存が成功すると履歴に追加され、タグの表示先に応じて業務表の学習・プログラム・備考に表示されます。タグは複数選べます。'],
            ['プログラムの文章を差し込む', 'プログラム用のタグでは、その日のプログラムを個別またはまとめて挿入できます。「文字挿入なし」ならタグだけ付きます。タグを解除しても、挿入済みの文章は消えません。'],
            ['【共有】は日報にも追記', '【共有】付きの新規メモは、児童名とともに日報の共有事項へ追加されます。その後メモを編集・削除しても、追記済みの共有事項は自動で変わりません。必要な訂正は日報側も確認してください。'],
            ['編集・削除はメモごとに', '保存したメモの下にある「編集」から本文とタグを変更できます。入力途中のメモと、保存済みのメモは別です。'],
        ],
    },
    {
        id: 'writing', title: '通信と次の見通しを書く', Icon: FileText,
        intro: '日々の記録を、ご家庭に伝わる文章に整えます。',
        items: [
            ['メモを選んだ順に本文へ', '「メモから反映」で、入れたい順にメモを選びます。挨拶やプログラムの挿入もできます。挿入した文章は通信本文の一部になり、後から元のメモやプログラムを変えても自動では書き換わりません。'],
            ['今後の予定は独立した欄', '次回の関わり方や見通しを残します。参考メモからの挿入も可能です。80文字は目安で、予約の追加や変更は行いません。'],
            ['名前の警告は本文を見て判断', '敬称の付いた名前の可能性がある言葉を表示します。すべての個人情報を検出する機能ではありません。OKワードへの登録は、以後のチェックからも除外する設定です。'],
            ['入力完了と保護者公開は別', '本文と今後の予定を確認して「入力を完了」。修正が必要なら「完了を解除」できます。完了にしても保護者への公開やLINE送信は行われません。'],
        ],
    },
    {
        id: 'copy', title: '確認してコピーする', Icon: Copy,
        intro: '文章を整えた後も、宛先と本文の確認を大切にします。',
        items: [
            ['コピー前に児童と本文を確認', '一人分または選択した児童の通信をコピーできます。結合コピーでは同じ姓をまとめる場合がありますが、姓だけで同じ家庭やLINEの宛先と判断しないでください。'],
            ['LINEでの送信は別の操作', '共有保存版では「LINE送信を確認」から保存済み本文を確認済みにし、対象を選んで宛先と本文をプレビューした後、一斉送信します。コピーしてLINEへ貼り付けて送る方法も使えます。'],
            ['送信後に手動で確認を付ける', '手動でLINEから送った場合は、今日の記録または通信一覧で「送信済み（手動確認）」を付けます。自動送信の「LINE受付済」はサーバーの結果です。受付済は既読や配達確認ではありません。失敗分は送信画面から個別に再試行できます。'],
            ['コピーに失敗したとき', '失敗表示が出た場合は成功扱いになりません。本文を選択して端末のコピー操作を使い、貼り付け先で内容を確認してください。'],
        ],
    },
    {
        id: 'daily', title: '日報・勤務・入出力', Icon: ClipboardList,
        intro: '記録の入力先と出力先を確かめながら扱います。',
        items: [
            ['日報とプログラム', '事前の特記事項、実施後の共有事項、複数のプログラムを保存できます。前7日分の記録も参照できます。プログラムを編集しても、すでにメモや通信本文に挿入した文章までは変更されません。'],
            ['スタッフの勤務', '勤務・公休・有給、開始時刻と終了時刻を記録します。職種の表示は勤務記録用で、アプリへのアクセス権限を変更する欄ではありません。'],
            ['CSVは差分を見て取込み', '送迎CSVは既存データとの差分と対象行を確認します。マスターに見つからない児童はそのまま登録されません。バックアップ復元は対象日・児童・復元範囲と上書き先を確認して実行します。'],
            ['書出し・印刷', '日報のExcel・CSVやバックアップCSVを書き出せます。月間日誌のPDF保存はブラウザーの印刷画面で行います。スマホなど、元Excelファイルに上書きできない環境では、編集済みファイルをダウンロードします。'],
        ],
    },
    {
        id: 'settings', title: '設定と保存の確認', Icon: Settings,
        intro: '入力を助ける設定と、困ったときの確認場所です。',
        items: [
            ['挨拶・タグ・OKワード', '挨拶はスタッフごとに保存します。タグ設定では挿入文と一覧の表示先を選びます。設定で表示先を変えると、同じタグの既存メモの表示先も変わります。OKワードは名前チェックから除外する言葉です。'],
            ['変更履歴は変更前後を確認', '履歴で児童・日付を絞り、変更前と後を見比べます。変更前の値はコピーできます。履歴を押すだけで元データに自動復元する機能ではありません。'],
            ['保存に失敗したら画面を閉じない', '入力内容を画面に残して再試行します。通信本文・今後の予定・入力途中のメモは端末内の下書きにも保護しますが、端末の保存領域が使えないときは警告が出ます。必要な文章をコピーして控えてください。'],
            ['別の保存内容が届いたとき', '編集中の文章と保存済みの文章を比較し、残す方を選びます。比較が終わるまで自動保存・コピー・入力完了を止めます。'],
        ],
    },
    {
        id: 'publication', title: '保護者へ公開する', Icon: FileText,
        intro: '共有保存版では、確認した通信を保護者の「日々のあしあと」に公開できます。',
        items: [
            ['対象と公開内容を確認', '一覧の「保護者へ公開」から一人または複数の児童を選び、保存済みの本文・今後の予定を確認します。確認チェックを付けて「公開する」を押した内容だけが公開されます。スタッフメモは公開しません。'],
            ['親子の紐付けで閲覧', '予約V2で対象児童に紐付いた保護者が閲覧できます。公開のためにLINEへ再ログインする必要はありません。紐付けが0名でも公開できますが、紐付けられるまで閲覧できる保護者はいません。'],
            ['修正したら再公開', '公開後に本文や予定を保存し直すと「変更あり・未反映」になります。保護者には以前の公開内容が表示されるため、最新の内容を確認して再公開してください。'],
            ['公開の取り消し', '公開済みの児童から「公開を取り消す」を選び、対象と内容を確認して実行します。「日々のあしあと」から非表示になりますが、スタッフ側の原文と、すでに送ったLINEは残ります。入力完了・送信済みチェック・LINE送信は公開とは別の操作です。'],
        ],
    },
];

function initialChapter(startStepId) {
    if (!startStepId) return 0;
    if (/publication/.test(startStepId)) return 6;
    if (/chat|memo/.test(startStepId)) return 1;
    if (/tree|future|greeting/.test(startStepId)) return 2;
    if (/copy|sent/.test(startStepId)) return 3;
    if (/program|notice|activit|attendance|export|print|csv/.test(startStepId)) return 4;
    if (/setting|tag|word|history/.test(startStepId)) return 5;
    return 0;
}

export default function WorkspaceHelp({ onClose, startStepId, mode = 'help', browserPreview = true, sharedStorage = false }) {
    const [chapter, setChapter] = useState(() => initialChapter(startStepId));
    const dialogRef = useRef(null);
    const contentRef = useRef(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    const current = chapters[chapter];
    useEffect(() => {
        const previousFocus = document.activeElement;
        dialogRef.current?.querySelector('button')?.focus();
        const keydown = event => {
            if (event.key === 'Escape') closeRef.current();
            if (event.key !== 'Tab') return;
            const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), [href], [tabindex="0"]')];
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        document.addEventListener('keydown', keydown);
        return () => { document.removeEventListener('keydown', keydown); if (previousFocus instanceof HTMLElement) previousFocus.focus(); };
    }, []);
    useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [chapter]);
    return <div className="workspace-help-backdrop"><section className="workspace-help" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="workspace-help-title">
        <header><div><p>予約V2内 · ツリー通信v2</p><h2 id="workspace-help-title">{mode === 'tour' ? '新しい画面の使い方' : 'ツリー通信の使い方'}</h2></div><button type="button" onClick={onClose} aria-label="ヘルプを閉じる"><X size={22} /></button></header>
        <div className="workspace-help-boundary">{sharedStorage ? '記録は予約V2に共有保存します。ほかのスタッフの変更は約8秒ごとに反映されます。入力途中の下書きは端末内に保護します。「保護者へ公開」と「LINE送信を確認」で、それぞれ対象と内容を確認して実行します。入力完了やコピーだけでは公開・送信しません。' : browserPreview ? '現在は利用者別のブラウザー内仮保存です。他スタッフや別端末との共有・保護者公開は未接続です。' : '現在は開発環境です。旧データの移行・保護者公開は行っていません。'}</div>
        <div className="workspace-help-layout"><nav aria-label="ヘルプの項目">{chapters.map(({ title, Icon }, index) => <button type="button" key={title} aria-current={index === chapter ? 'step' : undefined} onClick={() => setChapter(index)}><span>{String(index + 1).padStart(2, '0')}</span><Icon size={16} />{title}</button>)}</nav><main ref={contentRef}><div className="workspace-help-title"><current.Icon size={24} /><span>{chapter + 1} / {chapters.length}</span></div><h3>{current.title}</h3><p className="workspace-help-intro">{current.intro}</p>{current.items.map(([title, text]) => <article key={title}><h4><CheckCircle2 size={17} />{title}</h4><p>{text}</p></article>)}</main></div>
        <footer><button type="button" disabled={chapter === 0} onClick={() => setChapter(value => value - 1)}><ArrowLeft size={17} />前へ</button><div>{chapters.map((item, index) => <span key={item.id} className={index === chapter ? 'active' : ''} />)}</div>{chapter === chapters.length - 1 ? <button type="button" className="primary" onClick={onClose}>業務に戻る<CheckCircle2 size={17} /></button> : <button type="button" className="primary" onClick={() => setChapter(value => value + 1)}>次へ<ArrowRight size={17} /></button>}</footer>
    </section></div>;
}
