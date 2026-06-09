# ダッシュボードUIデザインルール

対象読者:
- ダッシュボードUIを追加・修正する開発者
- ダッシュボードの保守担当者

文書ステータス:
- current

最終更新日:
- 2026-06-09

## 1. この文書の役割

この文書は、現在のダッシュボードデザインを崩さずに新しい UI を追加するための基準です。

ダッシュボード配下の UI を変更するときは、実装前に必ずこの文書を確認してください。

対象範囲:
- `core/dashboard/src/components`
- `core/dashboard/src/views`
- `core/dashboard/src/styles.css`

## 2. デザインの基調

- 全体トーンは `slate` ベースの無彩色を中心にする
- 強調色は `violet` を主アクセントとして使う
- 成功は `emerald`、注意は `amber`、異常は `rose` を使う
- 背景は `bg-slate-50` 系、主要面は `bg-white` を使う
- 情報量は高く保つが、見た目は軽く、余白は狭すぎず広すぎない

避けること:
- 紫以外の強いアクセント色を新しい主色として混在させること
- グラスモーフィズムや濃いグラデーションを多用すること
- 黒背景カードや派手なネオン表現を追加すること

## 3. レイアウトルール

### 3.1 アプリ全体

- 左に幅 `w-16` の細い固定サイドバーを置く
- 上部に高さ `h-14` のミニマルヘッダーを置く
- 実データ表示領域は `bg-slate-50/50` のスクロール領域に置く

### 3.2 サイドバー

- 白背景、右ボーダー、上下 2 ブロック構成にする
- 上部はロゴ + ナビゲーション、下部は補助アクション + 小さなプロフィール表示にする
- ナビゲーションはアイコン主体で、アクティブ状態は `bg-slate-100 text-slate-700`

### 3.3 ヘッダー

- 左側は `VIEW TITLE`、区切り線、ステータス表示の順に置く
- 右側はジョブ導線、ジョブキュー起動、手動更新の順に置く
- 高さを増やさない
- ページ説明文や大型見出しはヘッダーに持ち込まない

### 3.4 画面ごとの構成

- Overview:
  4枚のサマリーカード + 3カラム領域
- Applications:
  フィルタバー + グリッド / リスト切替
- Events:
  シンプルなテーブル一覧
- Detail:
  戻るトップバー + `lg:grid-cols-3` の詳細レイアウト
  左 2 列に主操作、右 1 列に補助情報

## 4. 面の作り方

### 4.1 カード

- 基本カードは `rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm`
- 補助カードは `bg-slate-50` か `bg-slate-50/60`
- カード内の見出しは小さめで、本文より先に情報の種類を伝える

### 4.2 内部ブロック

- 情報の小区画は `rounded-xl`
- 枠線は `border-slate-100` または `border-slate-200`
- ステータスや補助メタ情報は小さなラベルとして切り出す

### 4.3 角丸

- 大カードは `rounded-2xl`
- 中サイズは `rounded-xl`
- チップやピルは `rounded-full` または小さな `rounded-md`

## 5. タイポグラフィ

- 基本フォントは `Inter` + `Noto Sans JP`
- セクション見出しは `text-sm font-bold text-slate-700`
- 小見出しやラベルは `text-xs font-bold uppercase tracking-wider text-slate-400`
- 本文は `text-sm text-slate-600` を基準にする
- 数値の強調は `text-3xl font-bold`
- IP、ドメイン、ログ時刻などの機械情報は `font-mono` を使う

## 6. 色の使い分け

- 通常テキスト:
  `text-slate-800`, `text-slate-700`, `text-slate-600`, `text-slate-400`
- アクセント操作:
  `violet-600` / `violet-700`
- 正常:
  `emerald-50`, `emerald-500`, `emerald-600`
- 注意:
  `amber-50`, `amber-500`, `amber-600`, `amber-700`
- 異常:
  `rose-50`, `rose-500`, `rose-600`, `rose-700`

ルール:
- ステータス色は意味に対応させる
- 単なる装飾で状態色を使わない

## 7. コンポーネントルール

### 7.1 ボタン

- 主ボタン:
  `bg-violet-600 hover:bg-violet-700 text-white`
- 標準ボタン:
  `border border-slate-200 hover:bg-slate-50 text-slate-700`
- 警告操作:
  `bg-amber-*` 系
- 破壊操作:
  `border-red-200 bg-red-50 text-red-700`

ルール:
- 角丸は `rounded-lg` か `rounded-xl`
- 高さは詰めすぎず、`py-2` 前後を基準にする
- クリック可能要素は必ず hover 差分を持たせる

### 7.2 入力欄

- 白か薄い `slate` 背景を使う
- ボーダーは `border-slate-200`
- フォーカスは `violet` 系で統一する
- 角丸は `rounded-lg` か `rounded-xl`

### 7.3 バッジ・チップ

- 状態表示は小さく、本文より強くしすぎない
- 通常は `bg-slate-50`、状態付きは各状態色の淡色背景を使う
- テーブル内やカード内の補助情報として使う

### 7.4 テーブル

- ヘッダーは `bg-slate-50/70`
- 行区切りは `divide-slate-100`
- 文字サイズは `text-sm`
- 操作列は右寄せにする

### 7.5 ログビューア

- 背景は `bg-slate-900`
- フォントは `font-mono`
- 角丸は `rounded-xl`
- 周囲の操作バーは白背景カード内に置く

## 8. アイコンルール

- 基本は `react-icons/fa6` の塗りつぶし系アイコンを使う
- 同一画面で線アイコンと塗りアイコンを混在させない
- アイコン色は意味があるときだけ状態色を使う
- 単なるナビゲーションや補助アイコンは `text-slate-400` 系を基準にする

## 9. 余白ルール

- 画面全体パディングは `p-6`
- カード内パディングは `p-5`
- セクション間は `space-y-6`
- 小ブロック間は `gap-3` か `gap-4`

避けること:
- 同一画面内で `p-3`, `p-8`, `p-12` を無秩序に混在させること
- 狭い密度のテーブルと、極端に広いカードを同居させること

## 10. 新規UI追加時の判断基準

新しいコンポーネントを追加するときは、次の順で決める:

1. 既存のどの画面に属する情報か
2. カードで表現するか、テーブルで表現するか
3. 状態色が必要か、単なる情報色でよいか
4. 主操作か補助操作か
5. 右カラム向きか、左メインカラム向きか

## 11. 実装前チェック

- サイドバーとヘッダーの骨格を壊していないか
- 色が `slate` / `violet` / `emerald` / `amber` / `rose` の範囲に収まっているか
- 大カードの見た目が既存カードと揃っているか
- ボタンの種類が主 / 標準 / 破壊で整理されているか
- アイコンセットが `fa6` 系で揃っているか
- Detailed な新 UI が必要でも、ヘッダーへ情報を積みすぎていないか

## 12. 参照先

- ルートガイド:
  `AGENTS.md`
- ダッシュボード概要:
  `core/dashboard/README.md`
- 現在の主要実装:
  `core/dashboard/src/components/DashboardShell.tsx`
  `core/dashboard/src/views/HomeView.tsx`
  `core/dashboard/src/views/ApplicationsView.tsx`
  `core/dashboard/src/views/EventsView.tsx`
  `core/dashboard/src/views/ApplicationDetailView.tsx`
