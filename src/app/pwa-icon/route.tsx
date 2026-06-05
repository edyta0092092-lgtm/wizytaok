import {
  createPwaIconImage,
  normalizePwaIconSize,
} from "@/lib/brand/create-pwa-icon-image"

export const runtime = "edge"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const size = normalizePwaIconSize(searchParams.get("size"))
  return createPwaIconImage(size)
}
