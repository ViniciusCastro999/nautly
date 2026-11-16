import { redirect } from "next/navigation"
import { Logo } from "@/components/logo"
import { getSession } from "@/lib/session"
import { ThemeToggle } from "@/components/theme-toggle"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Validação real da sessão (um cookie expirado não deve causar redirecionamento).
  if (await getSession()) redirect("/app")

  return (
    <div className="relative flex min-h-svh flex-col bg-surface">
      <header className="flex items-center justify-between px-6 py-5">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-12">{children}</main>
    </div>
  )
}
