# タスク

## 目的
`yarn config:init` のIP自動設定で、公開先IPとSSH用IPを同一選択に固定せず、別々に設定できるようにする。

## 要求
- `LAB_CORE_MAIN_SERVICE_IP` と `LAB_CORE_SSH_SERVICE_IP` を独立して選択できる。
- 同じIPを選ぶことも可能にする。
- 各項目で適用前に確認ダイアログを表示する。
