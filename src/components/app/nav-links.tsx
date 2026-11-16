"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarCheck2Icon,
  Clock3Icon,
  HeartPulseIcon,
  LinkIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

const ICONS = {
  link: LinkIcon,
  calendar: CalendarCheck2Icon,
  clock: Clock3Icon,
  users: UsersIcon,
  patients: HeartPulseIcon,
  settings: SettingsIcon,
} satisfies Record<string, LucideIcon>

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS }

export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="grid gap-1">
      {items.map(({ href, label, icon }) => {
        const Icon = ICONS[icon]
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-muted hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-[18px]" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
