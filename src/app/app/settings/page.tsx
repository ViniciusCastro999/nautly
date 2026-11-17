import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"
import { PageHeader } from "@/components/app/page-header"
import { SETTINGS_ICONS } from "@/components/app/settings/settings-icons"
import { requireWorkspace } from "@/lib/session"
import { settingsSections } from "@/lib/settings-sections"

export const metadata: Metadata = { title: "Configurações" }

export default async function SettingsPage() {
  const sections = settingsSections(await requireWorkspace())
  return (
    <>
      <PageHeader title="Configurações" description="Ajuste o Nautly para a sua forma de atender." />
      <div className="grid gap-[13px] sm:grid-cols-2 xl:grid-cols-3">
        {sections.map(({ href, label, description, icon }) => {
          const Icon = SETTINGS_ICONS[icon]
          return (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-4 rounded-[13px] border bg-card p-[18px] transition-colors hover:border-sea"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-sea-50 text-sea">
                <Icon className="size-5" strokeWidth={1.8} />
              </span>
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="font-semibold text-primary dark:text-foreground">{label}</span>
                <span className="text-[13px] text-muted-foreground">{description}</span>
              </span>
              <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          )
        })}
      </div>
    </>
  )
}
