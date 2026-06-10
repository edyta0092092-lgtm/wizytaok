"use client"

import { SheetFooter } from "@/components/ui/sheet"
import { useMobileKeyboardInset } from "@/lib/mobile/use-mobile-keyboard-inset"
import { cn } from "@/lib/utils"

type MobileSheetFooterProps = React.ComponentProps<typeof SheetFooter>

/** Stopka sheeta — sticky, safe area + unikanie klawiatury. */
export function MobileSheetFooter({ className, style, ...props }: MobileSheetFooterProps) {
  const keyboardInset = useMobileKeyboardInset()

  return (
    <SheetFooter
      className={cn(
        "shrink-0 border-t border-border/70 bg-background px-6 py-4",
        className,
      )}
      style={{
        paddingBottom: `calc(1rem + env(safe-area-inset-bottom, 0px) + ${keyboardInset}px)`,
        ...style,
      }}
      {...props}
    />
  )
}
