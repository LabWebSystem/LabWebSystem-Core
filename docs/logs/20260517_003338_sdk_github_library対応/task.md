# タスクリスト

## 依頼内容
- 追加要件として、SDK を GitHub 経由で Node.js ライブラリとして呼び出せるようにする。

## 実施タスク
1. ライブラリ利用向けの集約 package (`@lab-core/sdk`) を追加
2. 各 SDK package に exports / prepack を追加
3. GitHub 経由導入手順を README に追記
4. build/test で回帰確認

## 完了条件
- `@lab-core/sdk` からプログラム呼び出し可能
- GitHub 経由導入手順が文書化されている
- `yarn sdk:build` と `yarn sdk:test` が成功
