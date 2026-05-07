import Link from "next/link"
import { CalendarCheck2 } from "lucide-react"

import { appConfig } from "@/config/app"
import { cn } from "@/lib/utils"

type LogoProps = {
  href?: string
  className?: string
  showWordmark?: boolean
}

export function Logo({
  href = "/",
  className,
  showWordmark = true,
}: LogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-xl outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
        <CalendarCheck2 className="size-[1.125rem]" aria-hidden strokeWidth={2} />
      </span>
      {showWordmark ? (
        <span className="text-[0.875rem] font-semibold leading-tight tracking-tight text-foreground">
          {appConfig.name}
        </span>
      ) : null}
    </Link>
  )
}
