import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { AppSearch } from "@/components/app/app-search"
import { NavLinks, type NavItem } from "@/components/app/nav-links"
import { MobileNav } from "@/components/app/mobile-nav"
import { UserMenu } from "@/components/app/user-menu"
import { APP_DOMAIN } from "@/lib/constants"
import { requireWorkspace } from "@/lib/session"

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const { user, org, vertical, vocab } = await requireWorkspace()

  const home: NavItem = { href: "/app", label: "Início", icon: "home", exact: true }
  const agenda: NavItem = { href: "/app/bookings", label: "Agenda", icon: "calendar" }
  const clients: NavItem = {
    href: "/app/contacts",
    label: vocab.clients,
    icon: vertical.group === "health" ? "patients" : "users",
  }
  const main: NavItem[] = [
    home,
    agenda,
    clients,
    { href: "/app/event-types", label: "Serviços", icon: "services" },
  ]
  const bottom: NavItem[] = [{ href: "/app/settings", label: "Configurações", icon: "settings" }]
  const subtitle = org.kind === "clinic" ? org.name : vertical.label

  return (
    <div className="grid min-h-svh bg-surface lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-20 hidden h-svh flex-col bg-sidebar px-4 pt-7 pb-5 text-sidebar-foreground lg:flex">
        <Logo href="/app" tone="light" className="px-[9px] pb-[31px]" />
        <NavLinks items={main} />
        <div className="mt-auto grid gap-[5px]">
          <NavLinks items={bottom} />
          <div className="mt-3.5 border-t border-sidebar-border px-2.5 pt-4 text-[13px] text-sidebar-muted">
            <p className="truncate">{subtitle}</p>
            <p className="mt-0.5 truncate text-white/50">
              {APP_DOMAIN}/{user.username}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-card/85 px-4 backdrop-blur-md sm:px-6 lg:h-[72px] lg:px-[34px]">
          <Logo href="/app" className="lg:hidden" />
          <AppSearch placeholder={`Buscar ${vocab.clients.toLowerCase()}...`} className="hidden lg:flex" />
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle className="text-muted-foreground" />
            <div className="h-9 border-l" aria-hidden />
            <UserMenu
              name={user.name}
              email={user.email}
              username={user.username ?? ""}
              subtitle={subtitle}
            />
          </div>
        </header>
        <main className="page-in mx-auto w-full max-w-[1440px] flex-1 px-4 pt-7 pb-28 sm:px-8 lg:px-9 lg:pt-[34px] lg:pb-[50px]">
          {children}
        </main>
      </div>

      <MobileNav primary={[home, agenda, clients]} all={[...main, ...bottom]} />
    </div>
  )
}
