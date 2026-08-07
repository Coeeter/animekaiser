import { cn } from "@animekaiser/ui/lib/utils"
import type { ComponentPropsWithoutRef } from "react"
import { forwardRef } from "react"

export const PlayerShell = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div"> & {
    variant?: "full" | "mini"
    sidebarState?: "expanded" | "collapsed"
  }
>(
  (
    { className, variant = "full", sidebarState = "collapsed", ...props },
    ref
  ) => (
    <div
      ref={ref}
      data-sidebar-state={sidebarState}
      className={cn(
        "flex flex-col bg-black text-white",
        variant === "full" && [
          "w-full",
          "md:fixed md:inset-0 md:z-50 md:h-dvh md:w-auto md:left-[var(--sidebar-width-icon)]",
          "md:transition-[left] md:duration-150 md:ease-in-out md:data-[sidebar-state=expanded]:left-[var(--sidebar-width)]",
          "[&:fullscreen]:fixed [&:fullscreen]:inset-0 [&:fullscreen]:left-0 [&:fullscreen]:z-50 [&:fullscreen]:h-dvh [&:fullscreen]:w-dvw",
        ],
        className
      )}
      {...props}
    />
  )
)
PlayerShell.displayName = "PlayerShell"
