# OSUMOTO

LINE グループ用の bot です。  
以下の機能があります。

## 機能

### チャット AI

ChatGPT を使用した会話機能。直近の会話履歴を保持してコンテキストを維持します。
文頭に「`CHANNEL_BOT_NAME`」をつけてグループで話すと返答します。

### 画像生成 AI

Stable Diffusion で画像生成し、Google Drive にアップロードして返します。
文頭に「`CHANNEL_BOT_NAME`画伯」をつけて、続けてプロンプトを入力します。

## セットアップ

### 1. 依存関係のインストール

```bash
yarn install
```

### 2. 環境変数の設定

`.env`ファイルをプロジェクトルートに作成し、以下の情報を設定してください:

```sh
# LINE Bot設定
CHANNEL_ACCESS_TOKEN=<LINE Messaging APIのチャネルアクセストークン>
CHANNEL_SECRET=<LINE Messaging APIのチャネルシークレット>
CHANNEL_BOT_NAME=<任意のボット名>

# OpenAI設定
OPENAI_API_KEY=<OpenAI APIキー>
OPENAI_MODEL=<使用するモデル名（例: gpt-5-nano）>
MESSAGE_HISTORY_LIMIT=<会話履歴の保持件数（デフォルト: 10）>
SYSTEM_SETTINGS=<ChatGPTのシステムプロンプト（任意）>

# Stability AI設定
STABILITY_API_KEY=<Stability AI APIキー>

# サーバー設定
PORT=<ポート番号（デフォルト: 3000）>
```

### 3. Google Drive 認証情報の設定

画像生成機能を使用する場合、Google Drive API の認証情報が必要です。
`credentials.json.example`を参考に、`credentials.json`を作成してください。

## 開発

### ローカル開発サーバーの起動

```bash
yarn dev
```

nodemon によるホットリロード付きで開発サーバーが起動します。

### 型チェック

```bash
yarn ts-check
```

TypeScript の型チェックのみを実行します（pre-commit フックでも自動実行されます）。

## ビルド

```bash
yarn build
```

`dist/`ディレクトリに TypeScript をコンパイルした結果が出力されます。

## リリース方法

### Vercel へのデプロイ

このプロジェクトでは Vercel に手動でデプロイします。

#### 本番環境へのデプロイ

```bash
yarn run deploy:prod
```

このコマンドは以下を実行します:

1. `dist/`ディレクトリをクリーンアップ
2. TypeScript をコンパイル
3. Vercel の本番環境にデプロイ

#### デプロイ前の確認事項

1. すべての変更をコミット
2. `yarn ts-check`が成功すること（pre-commit フックで自動実行）
3. `.env`の環境変数が設定されていること
4. `credentials.json`の内容が設定されていること（必要に応じて）

## ライセンス

MIT
