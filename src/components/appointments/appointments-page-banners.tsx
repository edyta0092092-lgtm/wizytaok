"use client"

type AppointmentsPageBannersProps = {
  showAdded: boolean
  appointmentAddedLabel: string
  actionNotice: string
}

export function AppointmentsPageBanners({
  showAdded,
  appointmentAddedLabel,
  actionNotice,
}: AppointmentsPageBannersProps) {
  return (
    <>
      {showAdded ? (
        <div className="mb-4 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success-foreground">
          {appointmentAddedLabel}
        </div>
      ) : null}
      {actionNotice ? (
        <div className="mb-4 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
          {actionNotice}
        </div>
      ) : null}
    </>
  )
}
