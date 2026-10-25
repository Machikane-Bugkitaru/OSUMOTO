# アプリケーションの層構成

機能の追加・変更は、入口、入力・出力の変換、処理の組み立て、ルール、外部通信を分ける。必要な責務がある層だけを作り、空のディレクトリや呼び出しを中継するだけのサービスは作らない。

## 責務と依存方向

| 配置                | 責務                                                                                  | 依存先                                                                         |
| ------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/entrypoints`   | HTTP サーバー、LINE webhook の受付、署名検証、HTTP 応答、イベントの重複排除           | adapters、bootstrap                                                            |
| `src/adapters/line` | LINE イベントから入力への変換、処理結果や失敗から LINE 返信への変換                   | usecases の呼び出し契約、SDK 非依存のエラー。LINE SDK 型はこの境界内で使用する |
| `src/usecases`      | reply-to-message、remember-image、generate-image などの手順、予算、処理順序の組み立て | services、clients の契約                                                       |
| `src/services`      | 履歴管理や画像選択など、SDK に依存しないルール                                        | SDK 非依存の値・型                                                             |
| `src/clients`       | OpenAI、LINE、Google Drive の通信。SDK の要求・応答・例外を変換する                   | 外部 SDK、SDK 非依存の契約・設定値                                             |
| `src/config`        | 設定の読み込み、既定値、検証                                                          | 設定ライブラリ                                                                 |
| `src/bootstrap.ts`  | 設定を読み込み、具体的な clients と usecases を組み立てる                             | config、clients、usecases                                                      |

外部 SDK の要求・応答型を usecases や services に渡さない。クライアント契約は文字列、数値、アプリケーションの型で表し、SDK 例外は安全なアプリケーションのエラーに変換する。本文や認証情報をログに出さない。usecases から具体的なクライアント実装や bootstrap を import しない。

設定と依存は起動時に組み立て、関数の引数で注入する。usecases 内で環境変数の読み込みや SDK の生成を行わない。時間依存の処理には時計も注入できるようにする。DI コンテナは使わない。usecases は client 契約を直接利用してよく、サービスを必ず挟む必要はない。現在 DB はなく、Repository 層や Redis は導入しない。

## 現在の実装範囲: 画像生成

- `src/usecases/generate-image.ts`: プロンプト準備、残り予算の計算、画像生成、保存を順に実行する。
- `src/clients/image-generation.ts`: プロンプト準備・生成・保存の SDK 非依存の契約。
- `src/clients/openai-image.ts`: 任意の web search を使うプロンプト準備と PNG 生成。SDK の応答を文字列へ、例外を `ImageClientError` へ変換する。
- `src/clients/image-storage.ts`: 既存の `src/google.ts` による Drive 通信を再利用し、失敗を `ImageStorageError` へ変換する。
- `src/config/image-generation.ts` と `src/bootstrap.ts`: 画像生成に必要な設定の検証と依存の組み立て。
- `src/adapters/line/image-reply.ts`: 画像 URL と失敗を LINE 返信へ変換し、空の入力には案内を返す。
- `src/image-error.ts`: SDK に依存しない画像処理のエラーと、安全な診断情報。

プロンプト準備と画像生成は 40 秒の予算を共有し、画像生成には残り時間を渡す。OpenAI の再試行は行わない。Drive 保存リクエストは別に 10 秒、再試行なし（OAuth 認証時間を含まない）。モデル、画像形式・サイズ・品質、保存名、失敗時の返信を維持する。

HTTP 受付は `src/index.ts`、LINE イベントの振り分けは `src/line.ts` にある。`src/image.ts` は `generateArt` の公開窓口とローカル確認用のサンプル保存を持つ。`src/gpt.ts`、`src/conversation.ts`、`src/line-image.ts`、`src/google.ts`、共有の返信文言変換 `src/generation-error.ts` は既存の配置を使用している。entrypoints と services への移動、チャット処理の分離は今回の実装範囲に含めない。

## 機能追加時の配置例

- 画像生成の出力条件や SDK パラメーターを変える: `clients/openai-image.ts`。段取りや共有予算を変える: `usecases/generate-image.ts`。LINE の返信表示を変える: `adapters/line/image-reply.ts`。
- 会話への返信を分離する: `usecases/reply-to-message.ts` に処理順序、`services` に履歴の保持・画像選択ルール、`clients` に OpenAI と LINE の通信を置く。LINE イベントや SDK 応答は usecase の外で変換する。
- 受信画像を記憶する機能を分離する: `usecases/remember-image.ts` に取得と記録の順序、`clients` に LINE 画像取得、`services` に保持期限や容量のルールを置く。

## テスト

`test/usecases` は偽の client と時計で順序・予算・失敗時の停止を検証し、ネットワークを使わない。`test/adapters/line` は入力案内や返信形式、失敗時の文言を検証する。`test/config` は既定値と必須設定の検証を扱う。新しい clients、services、entrypoints のテストも対応する `test/` 配下へ置く。clients は SDK をスタブ化して通信条件と境界変換を検証する。

`test/image.test.cjs` は生成から LINE 返信までの既存の回帰テスト、`test/google.test.cjs` は Drive 保存の認証・タイムアウト・再試行の回帰テストを担う。他の既存テストは現在の配置を使用する。`yarn test` は下位ディレクトリも含めて実行する。実 API、Drive への保存、デプロイを検証の前提にしない。Node のバージョンは `.node-version`、Yarn は `packageManager` に合わせ、PR 前に `yarn verify`（lint、format、test、型検査、build）を実行する。
