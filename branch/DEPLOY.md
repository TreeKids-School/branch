# デプロイ手順ルール

このプロジェクト (`branch/branch/`) のデプロイ時は、以下の手順を **必ずセットで** 実行すること。
どのPC、誰が操作しても同じ手順を踏むこと。

## デプロイ手順（必須セット）

### 1. バージョン更新
- `src/app_constants.js` の `APP_VERSION` を更新（形式: `YY.MM.DD.連番`）
- `public/version.json` の `version` を同じ値に更新
- **両方を必ず一致させること**（不一致だとアップデート通知が出続ける）

### 2. ビルド
```bash
npm run build
```

### 3. Firebase デプロイ
```bash
npx firebase-tools deploy --only hosting
```
- プロジェクトID: `test-octopus-5b254`
- サイト: `test-branch-46c5a`
- URL: https://test-branch-46c5a.web.app

### 4. Git コミット & プッシュ
```bash
git add -A
git commit -m "vXX.XX.XX.X: 変更内容の要約"
git push origin main
```
- リポジトリ: `https://github.com/TreeKids-School/branch.git`
- ブランチ: `main`

## 注意事項
- 手順2〜4は **途中で止めず、必ず全て完了させる**こと
- コミットメッセージにはバージョン番号と変更概要を含めること
- version.json の更新忘れに特に注意（過去にこれが原因でアップデート通知が出続けた）
