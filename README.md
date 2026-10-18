# OSUMOTO

LINE グループ用の bot です。  
以下の機能があります。

## 機能

### チャット AI

ChatGPT を使用した会話機能。直近の会話履歴を保持してコンテキストを維持します。
文頭に「`CHANNEL_BOT_NAME`」をつけてグループで話すと返答します。
会話履歴はグループごとに分離し、同じグループのチャット API 呼び出しは、履歴の更新が競合しないよう直列に処理します。
`MESSAGE_HISTORY_LIMIT` はユーザー・AI の発言を合計した保持上限です（デフォルト10件）。
会話のペアで保持するため、奇数は切り下げ、0または1では過去の会話を保持しません。
失敗した要求と空の回答は履歴に残しません。
OpenAI API は Fast モード（`service_tier: "priority"`）を指定します。通常料金の2倍です。

### 画像生成 AI

OpenAI の `gpt-image-2.5-flare` で画像生成し、Google Drive にアップロードして返します。
画質は `low`、サイズは 1024×1024、形式は PNG、1回につき1枚です。
画像生成は通常処理を使用し、チャット用の Fast モード指定は適用しません。
文頭に「`CHANNEL_BOT_NAME`画伯」をつけて、続けてプロンプトを入力します。

## セットアップ

### 1. 依存関係のインストール

Node.js 24（`.node-version`）と Yarn 1.22.22 を使用します。

```bash
corepack enable
yarn install --frozen-lockfile
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
OPENAI_MODEL=gpt-6-luna
OPENAI_IMAGE_MODEL=gpt-image-2.5-flare # 省略時もこのモデルを使用
MESSAGE_HISTORY_LIMIT=<会話履歴の保持件数（デフォルト: 10）>
SYSTEM_SETTINGS=<ChatGPTのシステムプロンプト（任意）>

# サーバー設定
PORT=<ポート番号（デフォルト: 3000）>
```

画像生成にも既存の `OPENAI_API_KEY` を使用します。`STABILITY_API_KEY` は不要です。
Vercel でも既存の OpenAI API キーが利用でき、`OPENAI_IMAGE_MODEL` の追加設定は任意です。
GPT Image の利用には、OpenAI 側で組織の確認が必要な場合があります。

LINE の返信期限を考慮し、画像生成は40秒、Google Drive のアップロード要求は10秒でタイムアウトします（事前の認証時間は含みません）。
自動再試行は行わず、生成や保存に失敗した場合は LINE に案内を返します。

### 3. Google Drive 認証情報の設定

画像生成機能を使用する場合、Google Drive API の認証情報が必要です。
`credentials.json.example`を参考に、`credentials.json`を作成してください。

Vercel では `GOOGLE_CREDENTIALS_JSON` にサービスアカウントの JSON 全体を登録し、種類を Secret、対象を Production にして再デプロイします。
この環境変数を優先し、未設定の場合だけローカルの `credentials.json` を使用します。
設定した JSON が不正な場合はファイルに切り替えず、設定エラーとして扱います。
認証情報を Git に追加する必要はありません。

## 開発

### ローカル開発サーバーの起動

```bash
yarn dev
```

nodemon によるホットリロード付きで開発サーバーが起動します。

### テスト

```bash
yarn test
```

画像 API と LINE の接続部分を外部通信なしで確認します。

### 型チェック

```bash
yarn ts-check
```

ファイルを出力せず、TypeScript の型チェックのみを実行します。

### コード検査と整形

```bash
yarn lint          # ESLint で TypeScript・テスト・設定の問題を検出
yarn format        # Prettier で整形
yarn format:check  # 整形済みか検査
yarn verify        # lint・整形検査・テスト・型チェック・ビルド
```

ESLint はコード検査、Prettier は整形を担当し、`eslint-config-prettier` で規則の衝突を避けます。
pre-commit フックは lint・整形検査・型チェックを実行します。
GitHub Actions は PR と main への push で `yarn verify` を実行します。
テストは外部 API を呼ばず、LINE・OpenAI・Google の秘密情報なしで実行できます。

### 会話履歴と重複防止の保持範囲

会話履歴と Webhook の重複防止は、同一プロセスのメモリ内だけで有効です。
Vercel の再起動・再デプロイ・別インスタンスをまたいで共有・復元されません。
会話履歴は最後の処理完了から30分で失効し、次の受信時に回収します。
最大1,000グループを保持し、上限では処理中でない最古の履歴を解放します。

Webhook は署名検証後、`webhookEventId` が同じイベントの処理結果を共有します。
処理中は同じ処理の完了を待ち、完了後1時間は再実行しません。
返信失敗の前に有料の生成処理が完了している可能性があるため、失敗したイベントも1時間保持し、
再配信には同じ失敗（HTTP 500）を返します。再度試す場合はLINEで新しいメッセージを送ってください。
ID のないイベントは重複判定せず処理します。
最大10,000イベントを保持し、上限では既存IDを追い出さず、新規イベントに500を返します。
この範囲を超えた重複防止には、別途共有ストアが必要です。

## ビルド

```bash
yarn build
```

`dist/`ディレクトリに TypeScript をコンパイルした結果が出力されます。

## デプロイ

このプロジェクトは Vercel と GitHub を連携して自動デプロイされます。

- **本番デプロイ**: `main`ブランチへのプッシュまたはマージで自動デプロイ
- **プレビューデプロイ**: プルリクエスト作成時に自動でプレビュー環境を作成

## ライセンス

MIT
