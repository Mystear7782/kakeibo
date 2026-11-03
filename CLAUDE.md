# 家計簿アプリ

実装の前に `docs/claude-code-plan.md` を読み、Step順に進める。

- 画面の見本: `docs/mock/Main.dc.html`
- DBの定義: `supabase/migrations/`
- 利用者は本人のみ。主な環境はiPhoneのSafari、開発環境はWindows
- アプリの責務は月ごとの収支管理。資産残高はマネーフォワード MEで管理する
- DBの金額は円の正の整数で持つ
- 日付の境界はAsia/Tokyoで判定する
- カード番号、口座番号、シークレットをコードやDBに保存しない
- Workout TrackerのSupabaseプロジェクトとコネクタを共有しない
- MCPのデータ操作はユーザーのトークンで行い、RLSを通す
- 要件を変える必要が出たら、実装前に確認する
- コミットとプッシュは指示があるときに行う
