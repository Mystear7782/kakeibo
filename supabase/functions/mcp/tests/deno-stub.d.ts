// Deno を入れていない環境で tsc(npm run build)が型を確認できるようにするための最小の宣言。
// Edge Function の実行時には使われない。
declare module '@supabase/functions-js/edge-runtime.d.ts' {}

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): unknown
}
