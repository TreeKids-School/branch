import { useState, useCallback } from 'react';

const DAILY_LIMIT = 20;
const QUOTA_KEY = 'care_pro_quota';

function getQuota() {
    try {
        const raw = localStorage.getItem(QUOTA_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { }
    return { used: 0, resetAt: null };
}

function saveQuota(used, resetAt) {
    localStorage.setItem(QUOTA_KEY, JSON.stringify({ used, resetAt }));
}

function ensureReset(quota) {
    const now = new Date();
    const reset = quota.resetAt ? new Date(quota.resetAt) : null;
    if (!reset || now >= reset) {
        const next9 = new Date();
        next9.setHours(9, 0, 0, 0);
        if (next9 <= now) next9.setDate(next9.getDate() + 1);
        return { used: 0, resetAt: next9.toISOString() };
    }
    return quota;
}

async function fetchAI(prompt, isJson = false) {
    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, isJson }),
    });
    if (!response.ok) throw new Error(`AI API Error: ${response.status}`);
    const data = await response.json();
    if (isJson) {
        const text = data.text || data.result || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        return null;
    }
    return data.text || data.result || '';
}

function getStaffInstruction(staffName) {
    if (staffName === 'ブラック') {
        return `
      - 【重要】事実中心の客観的な描写に徹底すること。
      - スタッフの主観的な感想、感情（「〜と感じました」「嬉しかったです」など）は一切記述しないこと。
      - 「〜しました」「〜という場面がありました」のように、実際に起きた出来事を淡々と記述すること。
    `;
    }
    return `- 記述方針: 事実ベースで、評価や断定は避ける。「取り組む様子」「考える過程」「本人の選択」を大切に描写する。`;
}

export function useAI() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [dailyUsed, setDailyUsed] = useState(() => ensureReset(getQuota()).used);
    const [dailyResetAt, setDailyResetAt] = useState(() => ensureReset(getQuota()).resetAt);

    const persistQuota = useCallback((used, resetAt) => {
        setDailyUsed(used);
        setDailyResetAt(resetAt);
        saveQuota(used, resetAt);
    }, []);

    const generateDocuments = useCallback(async ({
        children, selectedGenerateIds, dailyMessages, results, summaryC, selectedDate, onComplete
    }) => {
        const toGenerate = children.filter(c => selectedGenerateIds.includes(c.id));
        const quota = ensureReset(getQuota());
        const remaining = DAILY_LIMIT - quota.used;

        if (remaining <= 0) {
            alert('本日の残り生成回数がありません（リセットは9:00）');
            return;
        }
        if (toGenerate.length > remaining) {
            alert(`本日の残り生成回数は${remaining}回です。対象を減らしてください。`);
            return;
        }

        setLoading(true);
        setProgress(0);

        try {
            const processedResults = { ...results };
            const totalOps = toGenerate.length + 1;
            let completedOps = 0;

            for (const child of toGenerate) {
                const msgs = dailyMessages[child.id] || [];
                const content = msgs.filter(m => m.included !== false).map(m => m.text).join('\n');
                const needsForceSheet = !!child.forceSheet;

                const forceSheetInstruction = needsForceSheet ? `
【3. 強行シート】 (Key: K_sheet)
- 4つのシーンに分けて作成: 「学習」「自由遊び」「プログラム」「おやつ」
- 各シーンは50文字程度で簡潔にまとめる。
- 文末は「〜だ・である」「〜だった・であった」調（常体）で統一。
- 該当情報がないシーンは「該当なし」と記載。
- 出力形式:
  学習: ...
  自由遊び: ...
  プログラム: ...
  おやつ: ...
` : '';

                const jsonTemplate = needsForceSheet
                    ? '{"B_result": "...", "B_plan": "...", "B_item": "...", "D": "...", "K_sheet": "..."}'
                    : '{"B_result": "...", "B_plan": "...", "B_item": "...", "D": "..."}';

                const prompt = `
あなたは療育施設の事務担当です。以下の児童メモを元に、書類を作成しJSONで返してください。

メモ内容: ${content}

【共通ルール】
- 児童名・実名や「〇〇君」「〇〇さん」などの呼称は一切使用しないでください。
- 保護者宛の文章として、主語を省き、自然な言い回しで記述してください。

【1. 専門的支援実施計画】 (Keys: B_result, B_plan, B_item)
- B_result (結果): 150〜180字。常体（言い切り）。客観的かつ丁寧な観察描写。
- B_plan (予定): 60〜80字。「〜していく」「〜を大切にする」など方針を示す文末。
- B_item (該当項目): ①健康・生活 ②運動・感覚 ③認知・行動 ④言語・コミュニケーション ⑤人間関係・社会性 から該当するものを全て選択。

【2. ツリー通信】 (Key: D)
- 冒頭固定: こんにちは、${child.staff || '〇〇'}です！ 今日のツリー通信です！
- 文字数: 300文字前後
- トーン: 保護者向けのやわらかい文章。療育記録調や専門用語は禁止。
${getStaffInstruction(child.staff)}
- 否定的な表現は使わず、つまずきは「時間がかかった」「迷う様子」などで表現する。
${forceSheetInstruction}

JSON形式で出力:
${jsonTemplate}
`;

                const response = await fetchAI(prompt, true);
                if (response) {
                    processedResults[child.id] = response;
                }
                completedOps++;
                setProgress(Math.round((completedOps / totalOps) * 100));
            }

            // Generate summary
            let newSummary = summaryC;
            if (toGenerate.length > 0) {
                const summaryText = toGenerate.map(c => {
                    const res = processedResults[c.id] || {};
                    return `結果: ${res.B_result || ''}\n通信: ${res.D || ''}${res.K_sheet ? `\n強行: ${res.K_sheet}` : ''}`;
                }).join('\n\n');

                const summaryPrompt = `
以下は各児童について既に生成された書類の抜粋です。
これをもとに、本日の全体の様子を業務管理日誌の「反省」欄として150字程度で1段落にまとめてください。
挨拶・署名は不要です。児童名や個人が特定できる情報は一切書かないでください。
話し言葉や口語表現は使わず、報告書の文体で記述してください。
学習（宿題含む）、プログラム、自由時間のカテゴリごとの傾向をまとめてください。

${summaryText}
`;
                newSummary = await fetchAI(summaryPrompt, false);
                completedOps++;
                setProgress(100);
            }

            persistQuota(quota.used + toGenerate.length + 1, quota.resetAt);
            onComplete(processedResults, newSummary);
        } catch (error) {
            console.error(error);
            alert('エラーが発生しました: ' + error.message);
        } finally {
            setTimeout(() => setLoading(false), 200);
        }
    }, [persistQuota]);

    return { loading, progress, dailyUsed, dailyResetAt, generateDocuments };
}
