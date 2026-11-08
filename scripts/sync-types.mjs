// supabase gen types で更新した src/types/database.ts を、Edge Function 用にコピーする。
// Edge Function のデプロイには supabase/functions/mcp の外のファイルを含められないため。
import { copyFileSync } from 'node:fs'

copyFileSync('src/types/database.ts', 'supabase/functions/mcp/database.types.ts')
console.log('copied src/types/database.ts -> supabase/functions/mcp/database.types.ts')
