import {
  CalendarClockIcon,
  CalendarSyncIcon,
  LayoutGridIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import type { SettingsIcon } from "@/lib/settings-sections"

export const SETTINGS_ICONS: Record<SettingsIcon, LucideIcon> = {
  profile: UserRoundIcon,
  availability: CalendarClockIcon,
  integrations: CalendarSyncIcon,
  features: LayoutGridIcon,
  team: UsersIcon,
}
