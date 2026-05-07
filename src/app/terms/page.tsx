"use client"

import Link from "next/link"

import { Logo } from "@/components/brand/logo"
import { useTranslations } from "@/lib/i18n/use-translations"

const SECTION_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

export default function TermsPage() {
  const { t } = useTranslations()

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <main className="mx-auto w-full max-w-2xl space-y-8">
        <div>
          <Logo href="/" />
        </div>

        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("termsPage.title")}
          </h1>
          <p className="text-muted-foreground">{t("termsPage.lead")}</p>
        </header>

        <div
          role="status"
          className="rounded-2xl border border-amber-500/35 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-50"
        >
          {t("termsPage.draftNotice")}
        </div>

        <div className="space-y-8">
          {SECTION_INDICES.map((n) => (
            <section key={n} className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                {t(`termsPage.sec${n}Title`)}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`termsPage.sec${n}Body`)}
              </p>
            </section>
          ))}
        </div>

        <footer className="space-y-4 border-t border-border/80 pt-8 text-sm text-muted-foreground">
          <p>{t("termsPage.operatorLine")}</p>
          <p>{t("termsPage.contactLine")}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
            <Link href="/developer-contact" className="font-medium text-primary underline-offset-4 hover:underline">
              {t("footer.developer")}
            </Link>
            <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">
              {t("developerPage.backHome")}
            </Link>
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              {t("auth.logIn")}
            </Link>
          </div>
        </footer>
      </main>
    </div>
  )
}
