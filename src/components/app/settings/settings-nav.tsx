"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRightIcon } from "lucide-react"
import { SETTINGS_ICONS } from "@/components/app/settings/settings-icons"
import type { SettingsSection } from "@/lib/settings-sections"
import { cn } from "@/lib/utils"

/** Submenu lateral das configurações: cada item é uma tela própria. */
export function SettingsNav({ sections }: { sections: SettingsSection[] }) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Configurações"
      className="flex gap-1 overflow-x-auto rounded-[13px] border bg-card p-1.5 lg:sticky lg:top-24 lg:grid lg:gap-0.5 lg:p-2"
    >
      {sections.map(({ href, label, icon }) => {
        const Icon = SETTINGS_ICONS[icon]
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors",
              active
                ? "bg-sea-50 text-primary dark:text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" strokeWidth={1.8} />
            <span className="lg:flex-1">{label}</span>
            <ChevronRightIcon className={cn("hidden size-3.5 lg:block", !active && "opacity-0")} />
          </Link>
        )
      })}
    </nav>
  )
}
