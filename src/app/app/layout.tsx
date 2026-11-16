import Link from "next/link"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { NavLinks, type NavItem } from "@/components/app/nav-links"
import { MobileNav } from "@/components/app/mobile-nav"
import { UserMenu } from "@/components/app/user-menu"
import { requireWorkspace } from "@/lib/session"

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const { user, org, vertical, vocab, can } = await requireWorkspace()

  const items: NavItem[] = [
    { href: "/app/event-types", label: "Tipos de evento", icon: "link" },
    { href: "/app/bookings", label: "Agendamentos", icon: "calendar" },
    { href: "/app/availability", label: "Disponibilidade", icon: "clock" },
    { href: "/app/contacts", label: vocab.clients, icon: vertical.group === "health" ? "patients" : "users" },
    ...(can("settings:manage")
      ? [{ href: "/app/settings", label: "Configurações", icon: "settings" } as const]
      : []),
  ]

  return (
    <div className="flex min-h-svh bg-surface">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r bg-sidebar p-4 lg:flex">
        <Logo href="/app" className="px-2 pt-1" />
        <p className="mt-1 mb-6 truncate px-2 text-xs font-medium text-muted-foreground">
          {org.kind === "clinic" ? org.name : vertical.label}
        </p>
        <Button
          asChild
          variant="outline"
          className="mb-6 h-10 rounded-full border-primary/40 font-semibold text-primary hover:bg-accent hover:text-primary"
        >
          <Link href="/app/event-types/new">
            <PlusIcon /> Criar
          </Link>
        </Button>
        <NavLinks items={items} />
        <div className="mt-auto grid gap-2">
          <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
            Tema <ThemeToggle />
          </div>
          <UserMenu name={user.name} email={user.email} username={user.username ?? ""} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-1">
            <MobileNav items={items} />
            <Logo href="/app" />
          </div>
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  )
}
