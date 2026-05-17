"use client"

import Link from "next/link"
import { CreditCard, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getBrowserClient } from "@/lib/supabase/client"

export default function SubscriptionRequiredPage() {
  const logout = async () => {
    const client = getBrowserClient()
    if (client) await client.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
            <CreditCard className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">Dostęp do panelu wymaga aktywnej subskrypcji</CardTitle>
            <CardDescription>
              Twoja firma nie ma aktywnego okresu próbnego ani opłaconej subskrypcji. Tylko właściciel lub
              administrator firmy może aktywować dostęp i opłacić abonament.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/login">Wróć do logowania</Link>
          </Button>
          <Button type="button" variant="ghost" onClick={() => void logout()}>
            <LogOut className="mr-2 size-4" aria-hidden />
            Wyloguj się
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
