# TreeKids Branch Management System

## 概要 (Overview)
児童発達支援・放課後等デイサービスなどの施設向け、連絡帳・日々の記録を管理するためのシステムです。
Firebase (Firestore, Cloud Functions) と React を利用して構築されています。

## 主な機能 (Features)
- **児童管理**: 児童の一覧表示、新規追加、ステータス（待機・欠席など）の管理。
- **連絡帳（Tree通信）**: 日々の活動記録や保護者向けの連絡事項を入力・管理。
- **出席管理**: 日別の出席状況の記録。
- **変更履歴管理**: 日々の記録の変更履歴を自動で保存（`changeLogs`コレクションによる管理）。
- **バックアップ・インポート機能**: CSV形式でのデータ入出力によるバックアップ。

## 技術スタック (Tech Stack)
- **Frontend**: React (Hooks, Context), TailwindCSS, Lucide-React
- **Backend**: Firebase (Firestore, Cloud Functions)
- **AI Integration**: Google Cloud Vertex AI (Gemini 1.5 Pro / Flash) による自動生成支援

## ディレクトリ構成 (Directory Structure)
- `/src/components/`: UIコンポーネント (モーダル、パネルなど)
- `/src/hooks/`: カスタムフック (`useStorage.js` などによるFirebase連携)
- `/functions/`: Firebase Cloud Functions (Vertex AI との連携 APIなど)
- `firestore.rules`: データベースのセキュリティルール

## セットアップ手順 (Setup Instructions)
1. 依存関係のインストール
   ```bash
   npm install
   ```
2. 開発用サーバーの起動
   ```bash
   npm run dev
   ```
3. Firebaseのデプロイ
   ```bash
   # セキュリティルールのデプロイ
   firebase deploy --only firestore:rules
   
   # Cloud Functionsのデプロイ
   firebase deploy --only functions
   ```

## 最近の主な変更点 (Recent Changes)
- 変更履歴（`changeLogs`）がタスクキルやリロード時にリセットされてしまう不具合を修正（`firestore.rules` への権限追加）。
