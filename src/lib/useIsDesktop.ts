import { useSyncExternalStore } from 'react'

/** この幅以上ならPC版、未満ならモバイル版。端末の種類(UA)では判定しない */
export const DESKTOP_QUERY = '(min-width: 1024px)'

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(DESKTOP_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

const getSnapshot = (): boolean => window.matchMedia(DESKTOP_QUERY).matches

export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot)
}
