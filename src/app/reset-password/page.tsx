import { Suspense } from "react"

import { ResetPasswordForm } from "@/app/reset-password/reset-password-form"

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background" aria-busy="true" aria-label="Loading" />
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
