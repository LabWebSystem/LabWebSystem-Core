# 実装計画

## 方針
- SDK を「テンプレ配布」ではなく「適合判定と運用安全性を提供するプロダクト」として設計する。
- 既存の Lab-Core backend と仕様ドリフトしないことを最重要要件とする。

## 設計ステップ
1. SDK の必須機能を `contract / inspect / profile / guard / ci` に分解
2. 技術選定を既存基盤（Node.js, TypeScript, Yarn, mise）に合わせる
3. 実装可能なディレクトリ・ファイル構成を具体化
4. 新規作成・既存移行・デバイス依存の 3 ユースケースを記述
5. core 変更時の保守プロセス（互換テスト、バージョン運用、リリース判定）を定義

## 成果物
- `sdk_technical_design.md`（本設計書）
- `walkthrough.md`（要点サマリ）
