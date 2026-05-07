import { Suspense } from "react"

import { LoginForm } from "@/app/login/login-form"

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background" aria-busy="true" aria-label="Loading" />
      }
    >
      <LoginForm />
    </Suspense>
  )
}
