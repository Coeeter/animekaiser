import { Result } from "@effect-atom/atom-react"
import { useEffect, useRef } from "react"

// Changing a query argument builds a different atom, which starts Initial with
// no previous value, so the page would otherwise collapse to a skeleton on every
// keystroke. Holding the last success keeps the current view mounted while the
// next one loads.
export function useLastSuccess<A, E>(result: Result.Result<A, E>) {
  const value = Result.isSuccess(result) ? result.value : null
  const lastRef = useRef<A | null>(null)

  useEffect(() => {
    if (value !== null) lastRef.current = value
  }, [value])

  return value ?? lastRef.current
}

export const isStaleResult = <A, E>(
  result: Result.Result<A, E>,
  value: A | null
) => value !== null && !Result.isSuccess(result)
