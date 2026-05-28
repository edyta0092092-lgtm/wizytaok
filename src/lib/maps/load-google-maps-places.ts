export function isGoogleMapsPlacesConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim())
}

let loadPromise: Promise<void> | null = null

/**
 * Ładuje skrypt Google Maps z biblioteką Places (jednorazowo w przeglądarce).
 */
export function loadGoogleMapsPlaces(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("browser_only"))
  }
  if (window.google?.maps?.places) {
    return Promise.resolve()
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!apiKey) {
    return Promise.reject(new Error("missing_api_key"))
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-pw-google-maps="1"]',
      )
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true })
        existing.addEventListener("error", () => reject(new Error("script_load_failed")), {
          once: true,
        })
        return
      }

      const script = document.createElement("script")
      script.dataset.pwGoogleMaps = "1"
      script.async = true
      script.defer = true
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=pl`
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("script_load_failed"))
      document.head.appendChild(script)
    })
  }

  return loadPromise
}
