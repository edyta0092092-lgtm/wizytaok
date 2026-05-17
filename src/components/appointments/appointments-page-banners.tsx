"use client"

type AppointmentsPageBannersProps = {
  actionNotice: string
}

export function AppointmentsPageBanners({ actionNotice }: AppointmentsPageBannersProps) {
  return actionNotice ? (
    <div className="mb-4 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
      {actionNotice}
    </div>
  ) : null
}
