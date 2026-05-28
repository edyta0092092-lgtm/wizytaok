"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import {
  isGoogleMapsPlacesConfigured,
  loadGoogleMapsPlaces,
} from "@/lib/maps/load-google-maps-places"
import { cn } from "@/lib/utils"

export type BusinessAddressAutocompleteProps = {
  id: string
  value: string
  placeId: string
  onValueChange: (address: string) => void
  onPlaceIdChange: (placeId: string) => void
  onPlaceSelected?: () => void
  disabled?: boolean
  placeholder?: string
  className?: string
  /** Gdy true — użytkownik musi wybrać adres z listy Google (wymaga API key). */
  requirePlaceSelection?: boolean
  pickFromListHint?: string
  manualEntryHint?: string
  mapsLoadErrorHint?: string
}

export function BusinessAddressAutocomplete({
  id,
  value,
  placeId,
  onValueChange,
  onPlaceIdChange,
  onPlaceSelected,
  disabled,
  placeholder,
  className,
  requirePlaceSelection = true,
  pickFromListHint,
  manualEntryHint,
  mapsLoadErrorHint,
}: BusinessAddressAutocompleteProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null)
  const [mapsReady, setMapsReady] = React.useState(false)
  const [mapsError, setMapsError] = React.useState(false)
  const mapsConfigured = isGoogleMapsPlacesConfigured()

  React.useEffect(() => {
    if (!mapsConfigured || disabled) return
    let cancelled = false

    void loadGoogleMapsPlaces()
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places) return
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          fields: ["formatted_address", "place_id", "name"],
          componentRestrictions: { country: "pl" },
        })
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace()
          const formatted =
            place.formatted_address?.trim() ||
            place.name?.trim() ||
            inputRef.current?.value.trim() ||
            ""
          const pid = place.place_id?.trim() ?? ""
          if (formatted) onValueChange(formatted)
          onPlaceIdChange(pid)
          onPlaceSelected?.()
        })
        autocompleteRef.current = autocomplete
        setMapsReady(true)
      })
      .catch(() => {
        if (!cancelled) setMapsError(true)
      })

    return () => {
      cancelled = true
      autocompleteRef.current = null
    }
  }, [disabled, mapsConfigured, onPlaceIdChange, onPlaceSelected, onValueChange])

  const handleManualChange = (next: string) => {
    onValueChange(next)
    if (requirePlaceSelection && mapsConfigured && mapsReady) {
      onPlaceIdChange("")
    }
  }

  return (
    <div className="space-y-1">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="street-address"
        value={value}
        onChange={(e) => handleManualChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("h-11 rounded-xl", className)}
      />
      {mapsConfigured && mapsReady && requirePlaceSelection && !placeId && value.trim().length > 0 && pickFromListHint ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">{pickFromListHint}</p>
      ) : null}
      {!mapsConfigured && manualEntryHint ? (
        <p className="text-xs text-muted-foreground">{manualEntryHint}</p>
      ) : null}
      {mapsError && mapsLoadErrorHint ? (
        <p className="text-xs text-destructive">{mapsLoadErrorHint}</p>
      ) : null}
    </div>
  )
}

export function businessAddressRequiresPlaceId(): boolean {
  return isGoogleMapsPlacesConfigured()
}
