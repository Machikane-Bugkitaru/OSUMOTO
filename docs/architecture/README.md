# アプリケーションの層構成

機能の追加・変更は、入口、入力・出力の変換、処理の組み立て、ルール、外部通信を分ける。必要な責務がある層だけを作り、空のディレクトリや呼び出しを中継するだけのサービスは作らない。

## 責務と依存方向

| 配置                | 責務                                                                | 依存先                                      |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| `src/entrypoints`   | HTTP / LINE webhook の受付、署名検証、HTTP 応答、イベントの重複排除 | adapters、起動時の依存組み立て              |
| `src/adapters/line` | LINE イベントから入力への変換、処理結果や失敗から返信への変換       | usecases の呼び出し契約、SDK 非依存のエラー |
| `src/usecases`      | 処理順序、時間予算など、機能ごとの手順の組み立て                    | services、clients の契約                    |
| `src/services`      | 履歴管理や画像選択など、SDK に依存しないルール                      | SDK 非依存の値・型                          |
| `src/clients`       | OpenAI / LINE / Google Drive の通信、SDK の要求・応答・例外の変換   | 外部 SDK、SDK 非依存の契約・設定値          |
| `src/config`        | 設定の読み込み、既定値、検証                                        | 設定ライブラリ                              |
| `src` の起動処理    | 設定を読み込み、具体的な clients と usecases を組み立てる           | config、clients、usecases                   |

外部 SDK の要求・応答型を usecases や services に渡さない。クライアント契約は文字列、数値、アプリケーションの型で表し、SDK 例外は安全なアプリケーションのエラーに変換する。LINE SDK 型は入口や変換の境界内で使用する。本文や認証情報をログに出さない。usecases は具体的なクライアント実装や起動処理に依存しない。

設定と依存は起動時に組み立て、関数の引数で注入する。usecases 内で環境変数の読み込みや SDK の生成を行わず、時間依存の処理には時計も注入できるようにする。DI コンテナは使わない。usecases は client 契約を直接利用してよい。現在 DB はなく、Repository 層や Redis は導入しない。

画像生成では usecases、clients、adapters/line、config の分離と起動時の依存組み立てを適用している。HTTP 受付やチャット処理には未移行のコードがあり、entrypoints と services はまだ設けていない。

## 機能追加時の配置方針

処理の順序や時間予算は usecases、履歴の保持や画像選択のルールは services、外部 API の通信条件は clients、LINE の入力解釈や返信形式は adapters/line に置く。新しい入口は entrypoints、設定の読み込みと検証は config に置き、起動処理で接続する。機能が増えても、この責務で配置を判断する。

## テスト方針

テストは責務に対応する `test/` 配下へ置く。usecases は偽の client と時計で処理順序・予算・失敗時の停止を検証し、services は SDK 非依存のルールを検証する。adapters は入力と返信への変換、clients は SDK をスタブ化した通信条件と境界変換、config は既定値と必須設定を検証する。入口では署名検証や HTTP 応答を検証し、生成から返信までの回帰テストも維持する。

`yarn test` は下位ディレクトリも含めて実行する。実 API、Drive への保存、デプロイを検証の前提にしない。プロジェクト指定の Node と Yarn を使い、PR 前に `yarn verify`（lint、format、test、型検査、build）を実行する。
