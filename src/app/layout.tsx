import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { appConfig } from "@/config/app"
import { AppProviders } from "@/components/providers/app-providers"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  adjustFontFallback: true,
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  adjustFontFallback: true,
  preload: false,
})

export const metadata: Metadata = {
  title: {
    default: appConfig.name,
    template: `%s · ${appConfig.name}`,
  },
  description: appConfig.description,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pl"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
