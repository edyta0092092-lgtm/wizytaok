import type { AvailabilityDay } from "@/types/domain"

import { getDefaultAvailabilityDays } from "@/data/default-availability-week"

/** Domyślna dostępność (demo / fallback); zgodna z getDefaultAvailabilityDays. */
export const initialAvailability: AvailabilityDay[] = getDefaultAvailabilityDays()
