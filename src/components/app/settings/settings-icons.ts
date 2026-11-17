import {
  CalendarClockIcon,
  LayoutGridIcon,
  ListChecksIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import type { SettingsIcon } from "@/lib/settings-sections"

export const SETTINGS_ICONS: Record<SettingsIcon, LucideIcon> = {
  profile: UserRoundIcon,
  availability: CalendarClockIcon,
  features: LayoutGridIcon,
  procedures: ListChecksIcon,
  team: UsersIcon,
}
