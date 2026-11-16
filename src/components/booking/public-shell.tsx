import Link from "next/link"
import { LogoMark } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-surface">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-start justify-center px-4 pb-10 sm:pt-6">{children}</main>
      <footer className="pb-6 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <LogoMark className="size-4" /> Agendamento feito com Nautly
        </Link>
      </footer>
    </div>
  )
}
