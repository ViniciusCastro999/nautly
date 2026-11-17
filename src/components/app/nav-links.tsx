"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDaysIcon,
  Clock3Icon,
  HeartPulseIcon,
  HouseIcon,
  LayersIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

export const NAV_ICONS = {
  home: HouseIcon,
  services: LayersIcon,
  calendar: CalendarDaysIcon,
  clock: Clock3Icon,
  users: UsersIcon,
  patients: HeartPulseIcon,
  settings: SettingsIcon,
} satisfies Record<string, LucideIcon>

export type NavItem = {
  href: string
  label: string
  icon: keyof typeof NAV_ICONS
  /** Marca ativo só com o caminho exato (ex.: Início). */
  exact?: boolean
  /** Número pequeno ao lado do rótulo. */
  badge?: number
}

export function isNavActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href)
}

/** Itens do menu lateral escuro (layout de referência: fundo marinho, item ativo com filete claro). */
export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="grid gap-[5px]">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.icon]
        const active = isNavActive(pathname, item)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[43px] items-center gap-3 rounded-[9px] px-3 text-sm transition-all duration-200",
              active
                ? "bg-sidebar-accent text-white shadow-[inset_3px_0_var(--sidebar-primary)]"
                : "text-sidebar-muted hover:bg-white/[0.07] hover:text-white",
            )}
          >
            <Icon className="size-[18px]" strokeWidth={1.8} />
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <small className="grid h-5 min-w-5 place-items-center rounded-full bg-warm px-1.5 text-xs font-semibold text-white">
                {item.badge}
              </small>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
