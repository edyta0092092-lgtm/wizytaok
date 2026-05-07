"use client"

import Link from "next/link"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function DeveloperContactPage() {
  const { t } = useTranslations()

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <main className="mx-auto w-full max-w-xl space-y-8">
        <div>
          <Logo href="/" />
        </div>

        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("developerPage.title")}
          </h1>
          <p className="text-muted-foreground">{t("developerPage.lead")}</p>
        </header>

        <p className="text-sm leading-relaxed text-muted-foreground">{t("developerPage.techNote")}</p>

        <dl className="space-y-5 rounded-2xl border border-border/80 bg-card/80 p-5 text-sm shadow-sm">
          <div>
            <dt className="font-medium text-foreground">{t("developerPage.nameLabel")}</dt>
            <dd className="mt-1 font-mono text-xs text-muted-foreground">
              {t("developerPage.namePlaceholder")}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">{t("developerPage.emailLabel")}</dt>
            <dd className="mt-1 font-mono text-xs text-muted-foreground">
              {t("developerPage.emailPlaceholder")}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">{t("developerPage.websiteLabel")}</dt>
            <dd className="mt-1 font-mono text-xs text-muted-foreground">
              {t("developerPage.websitePlaceholder")}
            </dd>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <dt className="font-medium text-foreground">{t("developerPage.supportChatTitle")}</dt>
            <dd className="mt-1 text-xs text-muted-foreground">{t("developerPage.supportChatHint")}</dd>
            <Button asChild className="mt-3 h-10 w-full rounded-xl sm:w-auto">
              <Link href="/help">{t("developerPage.supportChatCta")}</Link>
            </Button>
          </div>
        </dl>

        <footer className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border/80 pt-6 text-sm">
          <Link href="/terms" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("footer.terms")}
          </Link>
          <Link href="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("footer.privacy")}
          </Link>
          <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("developerPage.backHome")}
          </Link>
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("auth.logIn")}
          </Link>
        </footer>
      </main>
    </div>
  )
}
