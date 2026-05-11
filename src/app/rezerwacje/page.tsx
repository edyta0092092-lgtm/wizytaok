import Link from "next/link"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

/**
 * Strona pomocnicza dla URL `/rezerwacje` w sytuacjach, w których middleware
 * nie był w stanie przepisać żądania na `/rezerwacje/[businessSlug]`:
 * - użytkownik nie jest zalogowany,
 * - brak parametru `?firma=` z poprawnym slugiem.
 *
 * Owner zalogowany do panelu trafia automatycznie na własną stronę rezerwacji
 * (rewrite w middleware). Klient, który dostał link bez parametru, zobaczy tu
 * jasny komunikat zamiast 404.
 */
export default function RezerwacjeFallbackPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/80 bg-card/80 px-4 py-3 sm:px-5">
        <Logo />
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-5">
        <Card className="w-full max-w-md rounded-2xl border border-border/80 bg-card shadow-sm shadow-slate-900/5">
          <CardHeader className="space-y-1 text-left">
            <CardTitle className="text-xl font-semibold tracking-tight">
              Strona rezerwacji
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Aby otworzyć stronę rezerwacji, użyj linku otrzymanego od firmy
              (np. „Twoja firma → Otwórz stronę rezerwacji" w panelu właściciela).
              Link powinien zawierać parametr identyfikujący firmę.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Jeśli prowadzisz firmę i to Twoja strona rezerwacji — zaloguj się
              do panelu, aby zobaczyć podgląd.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button className="h-10 rounded-xl" asChild>
                <Link href="/login?next=%2Frezerwacje">Zaloguj się</Link>
              </Button>
              <Button variant="outline" className="h-10 rounded-xl" asChild>
                <Link href="/">Strona główna</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
