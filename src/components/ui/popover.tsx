"use client"

import * as React from "react"
import { Popover as RadixPopover } from "radix-ui"

import { cn } from "@/lib/utils"

function Popover({ ...props }: React.ComponentProps<typeof RadixPopover.Root>) {
  return <RadixPopover.Root data-slot="popover" {...props} />
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof RadixPopover.Anchor>) {
  return <RadixPopover.Anchor data-slot="popover-anchor" {...props} />
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof RadixPopover.Trigger>) {
  return <RadixPopover.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "start",
  side = "bottom",
  sideOffset = 8,
  collisionPadding = 12,
  ...props
}: React.ComponentProps<typeof RadixPopover.Content>) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        data-slot="popover-content"
        align={align}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "z-[100] w-auto max-w-[min(calc(100vw-2rem),22rem)] origin-(--radix-popover-content-transform-origin) rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-lg shadow-black/10 ring-1 ring-foreground/10 outline-none",
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[state=closed]:overflow-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2",
          "dark:shadow-black/40 dark:ring-foreground/15",
          className,
        )}
        {...props}
      />
    </RadixPopover.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
