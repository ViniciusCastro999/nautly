"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MenuIcon } from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"
import { NAV_ICONS, NavLinks, isNavActive, type NavItem } from "./nav-links"

/**
 * Navegação no celular: barra inferior fixa com os atalhos principais
 * e "Mais" abrindo o menu completo (mesmo visual da sidebar).
 */
export function MobileNav({ primary, all }: { primary: NavItem[]; all: NavItem[] }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const moreActive = !primary.some((i) => isNavActive(pathname, i))

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),6px)] lg:hidden"
    >
      <ul className="grid grid-cols-4 gap-1">
        {primary.map((item) => {
          const Icon = NAV_ICONS[item.icon]
          const active = isNavActive(pathname, item)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 rounded-[10px] text-[13px] transition-colors",
                  active ? "bg-sidebar-accent text-white" : "text-sidebar-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={1.8} />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            </li>
          )
        })}
        <li>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className={cn(
                "flex h-14 w-full flex-col items-center justify-center gap-1 rounded-[10px] text-[13px]",
                moreActive ? "bg-sidebar-accent text-white" : "text-sidebar-muted",
              )}
            >
              <MenuIcon className="size-5" strokeWidth={1.8} />
              Mais
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-4 text-white">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Logo href="/app" tone="light" className="mb-7 px-2 pt-2" />
              <NavLinks items={all} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  )
}
