import type { LucideIcon } from "lucide-react"

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-2xl border bg-card/70 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-[11px] font-semibold tracking-[0.14em] uppercase">
          {label}
        </span>
      </div>
      <p className="mt-2 font-heading text-2xl font-black tracking-tight tabular-nums md:text-3xl">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
