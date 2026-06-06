import Link from "next/link"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { LEGAL_OPERATOR, LEGAL_VERSION_LABEL } from "@/content/legal/operator"
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from "@/content/legal/privacy"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <main className="mx-auto w-full max-w-3xl space-y-8">
        <div>
          <Logo href="/" />
        </div>

        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Polityka prywatności WizytaOK
          </h1>
          <p className="text-sm text-muted-foreground">{LEGAL_VERSION_LABEL}</p>
        </header>

        <div className="space-y-3 rounded-2xl border border-border/80 bg-card/80 p-5 text-sm text-muted-foreground shadow-sm">
          {PRIVACY_INTRO.map((line) => (
            <p key={line} className="leading-relaxed">
              {line}
            </p>
          ))}
        </div>

        <div className="space-y-6">
          {PRIVACY_SECTIONS.map((section) => (
            <section
              key={section.title}
              className="space-y-2 rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm"
            >
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
          <p className="text-xs leading-relaxed text-muted-foreground">
            Operator: {LEGAL_OPERATOR.operatorName} · {LEGAL_OPERATOR.privacyEmail} ·{" "}
            {LEGAL_OPERATOR.serviceUrl}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/">Strona główna</Link>
            </Button>
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/dashboard">Przejdź do panelu</Link>
            </Button>
            <Button asChild variant="ghost" className="h-10 rounded-xl">
              <Link href="/terms">Regulamin</Link>
            </Button>
            <Button asChild variant="ghost" className="h-10 rounded-xl">
              <Link href="/developer-contact">Kontakt</Link>
            </Button>
          </div>
        </footer>
      </main>
    </div>
  )
}
