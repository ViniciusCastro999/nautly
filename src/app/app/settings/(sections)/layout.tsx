import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import { SettingsNav } from "@/components/app/settings/settings-nav"
import { requireWorkspace } from "@/lib/session"
import { settingsSections } from "@/lib/settings-sections"

export default async function SettingsSectionLayout({ children }: { children: React.ReactNode }) {
  const sections = settingsSections(await requireWorkspace())
  return (
    <>
      <Link
        href="/app/settings"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" /> Configurações
      </Link>
      <div className="grid items-start gap-[17px] lg:grid-cols-[230px_minmax(0,1fr)]">
        <SettingsNav sections={sections} />
        <div className="min-w-0">{children}</div>
      </div>
    </>
  )
}
