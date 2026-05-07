import { cn } from "@/lib/utils"

export type SemanticStatusTone =
  | "success"
  | "warning"
  | "info"
  | "danger"
  | "neutral"

/** Kontrastowy, stonowany zestaw dla jasnego i ciemnego motywu. */
const toneClass: Record<SemanticStatusTone, string> = {
  success:
    "border border-emerald-400/80 bg-emerald-50 text-emerald-950 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.5)] shadow-sm dark:border-emerald-500/40 dark:bg-emerald-950/60 dark:text-emerald-50 dark:shadow-none",
  warning:
    "border border-amber-400/85 bg-amber-50 text-amber-950 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.5)] shadow-sm dark:border-amber-500/40 dark:bg-amber-950/65 dark:text-amber-50 dark:shadow-none",
  info:
    "border border-sky-400/85 bg-sky-50 text-sky-950 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.5)] shadow-sm dark:border-sky-500/35 dark:bg-sky-950/60 dark:text-sky-50 dark:shadow-none",
  danger:
    "border border-red-400/85 bg-red-50 text-red-950 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.45)] shadow-sm dark:border-red-500/40 dark:bg-red-950/58 dark:text-red-50 dark:shadow-none",
  neutral:
    "border border-border/90 bg-muted/90 text-slate-900 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.45)] shadow-sm dark:border-muted-foreground/35 dark:bg-slate-900/72 dark:text-slate-50 dark:shadow-none",
}

export function semanticStatusBadgeClass(tone: SemanticStatusTone, className?: string) {
  return cn(
    "inline-flex min-h-[28px] w-fit max-w-full items-center rounded-lg px-3 py-1 text-[13px] font-semibold leading-snug tracking-tight",
    toneClass[tone],
    className
  )
}
