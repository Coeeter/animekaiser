import { useEffect, useState } from "react"

const colors = [
  "var(--color-primary)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "#fbbf24",
]

const pieces = Array.from({ length: 60 }, (_, index) => ({
  id: index,
  left: Math.random() * 100,
  delay: Math.random() * 0.6,
  duration: 2.4 + Math.random() * 1.6,
  size: 6 + Math.random() * 6,
  rotation: Math.random() * 360,
  color: colors[index % colors.length],
}))

export function Confetti() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (reduced.matches) {
      setVisible(false)
      return
    }

    const timeout = window.setTimeout(() => setVisible(false), 5000)
    return () => window.clearTimeout(timeout)
  }, [])

  if (!visible) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      <style>{`
        @keyframes kaiser-confetti-fall {
          0% { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(0, 110vh, 0) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-0 block rounded-[2px]"
          style={{
            left: `${piece.left}%`,
            width: `${piece.size}px`,
            height: `${piece.size * 1.6}px`,
            backgroundColor: piece.color,
            transform: `rotate(${piece.rotation}deg)`,
            animation: `kaiser-confetti-fall ${piece.duration}s linear ${piece.delay}s forwards`,
          }}
        />
      ))}
    </div>
  )
}
