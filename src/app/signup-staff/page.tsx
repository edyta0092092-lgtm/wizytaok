import { Suspense } from "react"

import { SignupStaffForm } from "@/app/signup-staff/signup-staff-form"

export default function SignupStaffPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Suspense
        fallback={<div className="h-48 w-full max-w-md animate-pulse rounded-2xl border border-border bg-muted/40" />}
      >
        <SignupStaffForm />
      </Suspense>
    </div>
  )
}
