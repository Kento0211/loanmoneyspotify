# Loan Ledger

貸しているお金・利率・利子の更新日を登録し、更新回数から利子を計算する静的Webアプリです。
GitHub Pages + Supabaseで公開できます。

## Features

- 貸付相手の名前
- 貸付金額
- 月利 / 年利
- 貸した日
- 利子の更新日
- 更新日カレンダー
- 指定日までの累計利子計算
- 貸付一覧・合計サマリー
- ローカル保存
- Supabaseログイン後のクラウド保存
- スマートフォン対応
- ダークなGlass UI

## Calculation rule

このアプリは「更新日を1回迎えるごとに、元金 × 登録利率」のシンプルな方式です。

例：
- 元金 50,000円
- 月利 5%
- 更新日 10日
- 10日を3回迎えた

→ 利子 50,000 × 0.05 × 3 = 7,500円

年利を選んだ場合は、貸した日から1年ごとの記念日を1回の更新として計算します。

> 実際の金銭の貸し借りでは、契約内容や法令によって利息の計算方法が異なる場合があります。このサイトは管理・計算用の簡易ツールです。

## GitHub Pages + Supabase setup

### 1. Supabase project

Supabaseで新しいプロジェクトを作成します。

### 2. Database

Supabase Dashboard → SQL Editorを開き、`supabase.sql` を全文実行します。

RLS（Row Level Security）を有効にして、ログインユーザーが自分のデータだけ読めるポリシーを作成しています。

### 3. Authentication

Supabase Dashboard → Authentication → ProvidersでEmailを有効にします。

メール確認を有効にする場合は、確認メールの設定も確認してください。

### 4. config.js

`config.js` の以下2項目を自分のSupabaseプロジェクトの値に変更します。

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "YOUR-PUBLISHABLE-KEY"
};
```

ブラウザに置くのはPublishable keyだけにしてください。`service_role` / secret keyは絶対に入れないでください。

### 5. GitHub repository

このフォルダのファイルをGitHub repositoryのルートへアップロードします。

```text
index.html
style.css
app.js
config.js
supabase.sql
README.md
```

### 6. GitHub Pages

GitHub repository → Settings → Pages → Deploy from a branch → `main` / `/(root)` を選択して保存します。

公開URLが決まったら、SupabaseのAuthentication設定でSite URL / Redirect URLもそのURLに合わせてください。

## Security notes

- `config.js` にSupabaseのPublishable keyを置く構成です。
- データ保護はSupabaseのRLSに依存します。
- `service_role` keyはフロントエンドに置かないでください。
- ログインしていない場合、データはそのブラウザのlocalStorageだけに保存されます。
