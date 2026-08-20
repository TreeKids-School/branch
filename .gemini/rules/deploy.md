---
description: branch/branch プロジェクトのデプロイ時に必ず従うルール
globs: ["branch/**"]
---

# デプロイルール（branch/branch）

`branch/` のコードを変更してデプロイする際は、以下の手順を **必ず全てセットで** 実行すること。

## 必須手順

1. **バージョン更新**
   - `branch/src/app_constants.js` の `APP_VERSION` を `YY.MM.DD.連番` 形式で更新
   - `branch/public/version.json` の `version` を **同じ値** に更新（不一致厳禁）

2. **ビルド**: `npm run build`（`branch/branch/` ディレクトリで実行）

3. **Firebase デプロイ**: `npx firebase-tools deploy --only hosting`（`branch/branch/` ディレクトリで実行）

4. **Git コミット & プッシュ**:
   ```
   git add -A
   git commit -m "vXX.XX.XX.X: 変更内容の要約"
   git push origin main
   ```

## 注意
- 手順1〜4は **必ず全て完了させる**（途中で止めない）
- version.json と APP_VERSION の一致を常に確認する
- デプロイだけしてコミット・プッシュを忘れないこと
