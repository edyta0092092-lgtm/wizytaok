import { redirect } from "next/navigation"

type TemplatesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const q = await searchParams
  const p = new URLSearchParams()
  for (const [key, value] of Object.entries(q)) {
    if (typeof value === "string") {
      p.set(key, value)
    } else if (Array.isArray(value) && typeof value[0] === "string") {
      p.set(key, value[0])
    }
  }
  const tail = p.toString() ? `?${p.toString()}` : ""
  redirect(`/messages${tail}`)
}
