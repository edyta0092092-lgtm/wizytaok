import { SignupForm } from "@/app/signup/signup-form"

type SignupPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = (await searchParams) ?? {}
  const raw = params.startTrial
  const startTrial =
    (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase() === "true"

  return <SignupForm startTrial={startTrial} />
}
