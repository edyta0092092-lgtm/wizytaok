/** Typy współdzielone — treść centrum pomocy w `help-center-sections.ts`. */

export type GuideReferenceBlock =
  | { type: "lead"; key: string }
  | { type: "body"; key: string }
  | { type: "bullets"; key: string }
  | { type: "steps"; key: string }
  | { type: "tip"; key: string }

export type GuideReferenceSection = {
  id: string
  titleKey: string
  href?: string
  ctaKey?: string
  searchTags: string[]
  blocks: GuideReferenceBlock[]
  /** Widoczne tylko dla roli administrator (właściciel firmy = administrator). */
  adminOnly?: boolean
}

export {
  HELP_CENTER_CATEGORIES,
  HELP_CENTER_FAQ_KEYS,
  HELP_CENTER_SECTIONS_TYPED as HELP_CENTER_SECTIONS,
  type HelpCenterCategory,
  type HelpCenterCategoryId,
  type HelpCenterSection,
} from "@/lib/guide/help-center-sections"
