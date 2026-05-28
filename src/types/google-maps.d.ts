/** Minimalne typy dla Google Maps Places (autouzupełnianie adresu). */
declare namespace google.maps.places {
  interface PlaceResult {
    formatted_address?: string
    place_id?: string
    name?: string
  }

  interface AutocompleteOptions {
    types?: string[]
    fields?: string[]
    componentRestrictions?: { country: string | string[] }
  }

  class Autocomplete {
    constructor(input: HTMLInputElement, opts?: AutocompleteOptions)
    addListener(eventName: "place_changed", handler: () => void): void
    getPlace(): PlaceResult
  }
}

declare namespace google.maps {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  class Maps {}
}

interface Window {
  google?: {
    maps?: {
      places?: typeof google.maps.places
    }
  }
}
