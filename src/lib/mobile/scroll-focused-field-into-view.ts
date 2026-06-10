/** Przewija aktywne pole formularza nad klawiaturę na mobile. */
export function scrollFocusedFieldIntoView(target: EventTarget | null) {
  if (typeof window === "undefined") return
  if (!window.matchMedia("(max-width: 1023px)").matches) return
  if (!(target instanceof HTMLElement)) return

  const tag = target.tagName
  if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return

  queueMicrotask(() => {
    target.scrollIntoView({ block: "center", behavior: "smooth" })
  })
}
