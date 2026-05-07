"use client"

import * as React from "react"

/** Utrzymuje ref zsynchronizowany z wartością (np. dla handlerów zamykających nad aktualnym stanem). */
export function useSyncedRef<T>(value: T): React.MutableRefObject<T> {
  const ref = React.useRef(value)
  React.useLayoutEffect(() => {
    ref.current = value
  }, [value])
  return ref
}
