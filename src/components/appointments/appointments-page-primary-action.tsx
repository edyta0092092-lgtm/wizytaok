"use client"

import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

type AppointmentsPagePrimaryActionProps = {
  label: string
  onClick: () => void
}

export function AppointmentsPagePrimaryAction({
  label,
  onClick,
}: AppointmentsPagePrimaryActionProps) {
  return (
    <Button
      type="button"
      size="sm"
      className="h-9 gap-1 text-sm"
      data-tour="appointments-add"
      onClick={onClick}
    >
      <Plus className="size-3.5" />
      {label}
    </Button>
  )
}
