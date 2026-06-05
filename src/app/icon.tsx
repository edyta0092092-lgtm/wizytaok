import { createPwaIconImage } from "@/lib/brand/create-pwa-icon-image"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return createPwaIconImage(32)
}
