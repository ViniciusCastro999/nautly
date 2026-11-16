import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { requireUser } from "@/lib/session"

export const metadata: Metadata = { title: "Configure sua conta" }

export default async function OnboardingPage() {
  const { user, org } = await requireUser()
  if (org.vertical) redirect("/app")

  return (
    <div className="flex min-h-svh flex-col bg-surface">
      <header className="flex items-center justify-between px-6 py-5">
        <Logo href="/" />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 justify-center px-4 pt-4 pb-16">
        <OnboardingWizard firstName={user.name.split(" ")[0]} />
      </main>
    </div>
  )
}
