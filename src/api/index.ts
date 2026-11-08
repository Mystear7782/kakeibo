import { createFakeApi } from './fake'
import { createRealApi } from './real'
import type { Api } from './types'

// VITE_FAKE_API=1 のときだけ、メモリ上のAPIで画面を動かす(開発と画面確認用)
export const FAKE_API = import.meta.env.VITE_FAKE_API === '1'

export const api: Api = FAKE_API ? createFakeApi() : createRealApi()
