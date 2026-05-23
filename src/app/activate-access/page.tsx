"use client"

import { Suspense } from "react"

import { BillingAccessPaywall } from "@/components/billing/billing-access-paywall"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function ActivateAccessFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Ładowanie…</CardTitle>
          <CardDescription>Sprawdzamy status subskrypcji.</CardDescription>
        </CardHeader>
      </Card>
    </main>
  )
}

export default function ActivateAccessPage() {
  return (
    <Suspense fallback={<ActivateAccessFallback />}>
      <BillingAccessPaywall variant="owner" />
    </Suspense>
  )
}
