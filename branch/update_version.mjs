import fs from 'fs';
import path from 'path';

// constants.jsのパス
const constantsPath = path.join(process.cwd(), 'src', 'constants.js');

try {
    let content = fs.readFileSync(constantsPath, 'utf-8');

    // APP_VERSION = 'YY.MM.DD.BUILD'; を抽出
    const match = content.match(/export const APP_VERSION = '(\d{2}\.\d{2}\.\d{2})\.(\d+)';/);
    if (!match) {
        console.error("APP_VERSION not found in constants.js");
        process.exit(1);
    }

    const curDate = match[1];
    const curBuild = parseInt(match[2], 10);

    // 今日の日付を取得 (日本時間)
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstDate = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + jstOffset);

    const yy = String(jstDate.getFullYear()).slice(-2);
    const mm = String(jstDate.getMonth() + 1).padStart(2, '0');
    const dd = String(jstDate.getDate()).padStart(2, '0');
    const today = `${yy}.${mm}.${dd}`;

    // バージョン番号の加算
    let newBuild = 1;
    if (curDate === today) {
        newBuild = curBuild + 1;
    }

    const newVersion = `${today}.${newBuild}`;

    // 文字列の置き換えと保存
    content = content.replace(match[0], `export const APP_VERSION = '${newVersion}';`);
    fs.writeFileSync(constantsPath, content, 'utf-8');

    console.log(`バージョンを ${curDate}.${curBuild} から ${newVersion} に更新しました`);
} catch (error) {
    console.error("エラーが発生しました:", error.message);
    process.exit(1);
}
