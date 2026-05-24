/** Dropdown menu portaled outside dialog content — ignore as outside dismiss target. */
export function isScheduleDropdownMenuTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('[data-slot="dropdown-menu-content"]'))
}
