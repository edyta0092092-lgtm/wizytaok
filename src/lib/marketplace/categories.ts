/** Kategorie marketplace (fundament — docelowo pole w DB). */
export type MarketplaceCategoryId =
  | "beauty"
  | "health"
  | "medical"
  | "fitness"
  | "other"

export type MarketplaceCategory = {
  id: MarketplaceCategoryId
  labelKey: string
  keywords: string[]
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  {
    id: "beauty",
    labelKey: "categoryBeauty",
    keywords: ["fryz", "strzyż", "barber", "paznok", "manicure", "kosmety", "makijaż", "brwi", "rzęs"],
  },
  {
    id: "health",
    labelKey: "categoryHealth",
    keywords: ["masaż", "fizjoter", "osteopat", "refleksolog", "wellness", "spa"],
  },
  {
    id: "medical",
    labelKey: "categoryMedical",
    keywords: ["lekarz", "stomatolog", "dent", "medyc", "psycholog", "dietetyk", "weteryn"],
  },
  {
    id: "fitness",
    labelKey: "categoryFitness",
    keywords: ["fitness", "trening", "siłownia", "joga", "pilates", "crossfit"],
  },
  {
    id: "other",
    labelKey: "categoryOther",
    keywords: [],
  },
]

export function inferCategoryIdsFromText(text: string): MarketplaceCategoryId[] {
  const lower = text.toLowerCase()
  const matched: MarketplaceCategoryId[] = []
  for (const cat of MARKETPLACE_CATEGORIES) {
    if (cat.id === "other") continue
    if (cat.keywords.some((kw) => lower.includes(kw))) {
      matched.push(cat.id)
    }
  }
  return matched.length > 0 ? matched : ["other"]
}
