# MCPサーバー 公開と接続の手順

Step 4 で実装した MCP サーバー（`supabase/functions/mcp/`）を本番へ出し、Claude から使えるようにする手順。
構成は Workout Tracker（`../training_recorder`）と同じで、Supabase プロジェクト、コネクタ、シークレットは共有しない。

| 項目 | 値 |
|---|---|
| Supabase プロジェクト | `qdgcqzlmoelwgtuttvwp` |
| MCP の URL | `https://qdgcqzlmoelwgtuttvwp.supabase.co/functions/v1/mcp` |
| 同意画面 | `https://mystear7782.github.io/kakeibo/oauth-consent.html` |

## 仕組み

1. Claude が MCP の URL を開く → 401 と `WWW-Authenticate` が返り、Claude が Supabase Auth（OAuth 2.1 サーバー）を見つける。
2. Claude が DCR（動的クライアント登録）で自分を登録し、同意画面（`public/oauth-consent.html`）へユーザーを案内する。
3. ユーザーが許可すると、Claude に**ユーザー本人のアクセストークン**が渡る。
4. MCP は、そのトークンで DB に接続する。そのため RLS が効き、service role キーは使わない。

## 1. 事前準備（本人の作業・初回のみ）

Supabase ダッシュボード（プロジェクト `qdgcqzlmoelwgtuttvwp`）。画面の文言はバージョンにより多少異なる。

1. **JWT 署名鍵を非対称鍵にする**
   - Project Settings > JWT Keys（Signing Keys）で、ES256 の鍵を作成し、現在の署名鍵に切り替える。
   - MCP の認証（`@supabase/server`）は ES256 / RS256 のトークンしか受け付けない。
   - 切り替え後に、アプリへ今までどおりログインできることを確認する。
2. **OAuth Server を有効にする**
   - Authentication > OAuth Server を有効にする。
   - 「Dynamic client registration」を **ON** にする。
   - Authorization Path（同意画面のパス）を `/kakeibo/oauth-consent.html` にする。
3. **Site URL を確認する**
   - Authentication > URL Configuration の Site URL が `https://mystear7782.github.io`（末尾スラッシュなし）であること。
   - 同意画面の URL は「Site URL + Authorization Path」になる。アプリは `/kakeibo/` 配下で配信されるため、パスに `/kakeibo` を含める。
   - パスにサブディレクトリを指定できない場合は、そのメッセージを共有する（同意画面の置き場所を変える）。

## 2. 同意画面の公開

`public/oauth-consent.html` は、アプリと一緒に GitHub Pages へ配信される（`main` への push）。
公開後に `https://mystear7782.github.io/kakeibo/oauth-consent.html` を開くと「認可リクエストのID(authorization_id)がありません」と表示されれば正常。

## 3. Edge Function のデプロイ（本番の変更なので、実行前に確認する）

```bash
npx supabase functions deploy mcp --use-api
```

リンク済みのプロジェクト（`qdgcqzlmoelwgtuttvwp`）へ出る。`--use-api` は Docker なしで、サーバー側でバンドルする（この PC は Docker が動いていない）。
`supabase/config.toml` の `[functions.mcp] verify_jwt = false` が使われる。トークンの検証は関数側で行う。

## 4. Claude への接続（本人の作業）

1. Claude（Web またはスマホ）> 設定 > コネクタ > カスタムコネクタを追加する。
2. URL に `https://qdgcqzlmoelwgtuttvwp.supabase.co/functions/v1/mcp` を入力する。
3. 同意画面が開く。未ログインならログインし、要求元が Claude で、戻り先が `https://claude.ai/...` であることを確認して「許可する」。
4. コネクタが接続済みになり、12個のツールが一覧に出る。

Workout Tracker のコネクタとは別に追加する（URL もプロジェクトも別）。

## 5. 実機での確認項目

自動テストでは、ツールの入力検証と集計の計算、注釈（`readOnlyHint` / `destructiveHint`）を確認済み。
RLS、制約、トリガー、認証、実際の Claude 経由の動作は、次の手順で確認する。

| 依頼の例 | 期待結果 |
|---|---|
| 今日、昼食 1,200円をQRで食費に登録して | `log_transaction` が呼ばれ、アプリの「最近の明細」に1件増える。同じ依頼を2分以内にもう一度しても増えない |
| 今月の支出を費目別に教えて | `list_transactions` / `get_cashflow_summary` の結果から答える |
| 今月の支払い予定を教えて | `get_month_schedule`。アプリのカレンダーの「これから」と一致する |
| 動画配信（月1,590円、毎月10日）を固定費に登録して。サブスクとして | `save_fixed_cost`。アプリの固定費とサブスク画面に出る |
| サブスクはいくら使ってる？ | `get_subscription_summary`。サブスク画面の4つの金額と一致する |
| さっきの昼食の金額を 1,300円に直して | 更新前に変更内容の確認を求める。許可するとアプリに反映される |
| さっきの昼食を削除して | 削除前に確認を求める。許可するとアプリから消える |
| 費目「習い事」を支出に追加して | `save_category`。アプリの費目の編集に出る |
| 別のユーザーの明細を見せて | 見えない（RLS） |

接続後に、ダッシュボードの Authentication > OAuth Apps に Claude が登録されていることも確認する。

## 6. 注意

- `supabase config push` は使わない。既定値で本番の Auth 設定を上書きしてしまう。
- テーブルや関数を変えたら、`npm run types` で DB 型を更新する（`src/types/database.ts` と、Edge Function 用のコピーの両方を更新する）。そのあと `functions deploy` で再デプロイする。
- `import_transactions`（CSV 取り込み）は Step 5 で追加する。追加後に再デプロイが必要。
