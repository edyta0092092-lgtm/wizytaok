import Link from "next/link"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LEGAL_BETA_OPERATOR_PUBLIC_NOTICE } from "@/content/legal/beta-notice"
import {
  TERMS_DRAFT_BADGE,
  TERMS_DRAFT_VERSION,
  TERMS_INTRO,
  TERMS_SECTIONS,
} from "@/content/legal/terms"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <main className="mx-auto w-full max-w-3xl space-y-8">
        <div>
          <Logo href="/" />
        </div>

        <header className="space-y-2">
          <Badge
            variant="outline"
            className="rounded-full border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200"
          >
            {TERMS_DRAFT_BADGE}
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Regulamin serwisu WizytaOK</h1>
          <p className="text-sm text-muted-foreground">{TERMS_DRAFT_VERSION}</p>
        </header>

        <div
          role="status"
          className="rounded-2xl border border-amber-500/35 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-50"
        >
          {LEGAL_BETA_OPERATOR_PUBLIC_NOTICE} Niniejszy dokument ma charakter roboczy — przed uruchomieniem
          komercyjnym zostanie poddana weryfikacji prawnej.
        </div>

        <div className="space-y-3 rounded-2xl border border-border/80 bg-card/80 p-5 text-sm text-muted-foreground shadow-sm">
          {TERMS_INTRO.map((line) => (
            <p key={line} className="leading-relaxed">
              {line}
            </p>
          ))}
        </div>

        <div className="space-y-6">
          {TERMS_SECTIONS.map((section) => (
            <section key={section.title} className="space-y-2 rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm">
              <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <footer className="space-y-4 border-t border-border/80 pt-8">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/">Strona główna</Link>
            </Button>
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/dashboard">Przejdź do panelu</Link>
            </Button>
            <Button asChild variant="ghost" className="h-10 rounded-xl">
              <Link href="/privacy">Polityka prywatności</Link>
            </Button>
            <Button asChild variant="ghost" className="h-10 rounded-xl">
              <Link href="/developer-contact">Kontakt techniczny</Link>
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{LEGAL_BETA_OPERATOR_PUBLIC_NOTICE}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link href="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
              Polityka prywatności
            </Link>
          </div>
        </footer>
      </main>
    </div>
  )
}
