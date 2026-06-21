import { useEffect, useState } from "react"
import { formatCountdown } from "./schedule"

export function NextEpisodeCountdown({ airingAt }: { airingAt: number }) {
  const [label, setLabel] = useState(() => formatCountdown(airingAt))
  useEffect(() => {
    const update = () => setLabel(formatCountdown(airingAt))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [airingAt])
  return label
}
