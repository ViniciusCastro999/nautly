import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { LockIcon } from "lucide-react"
import { PublicShell } from "@/components/booking/public-shell"
import { PublicAnamnesis } from "@/components/anamnesis/public-anamnesis"
import { db, schema } from "@/db"
import { getTemplate } from "@/lib/anamnesis"

export const metadata: Metadata = { title: "Anamnese", robots: { index: false } }

export default async function PublicAnamnesisPage({ params }: PageProps<"/anamnese/[token]">) {
  const { token } = await params
  if (!/^[a-f0-9]{32}$/.test(token)) notFound()

  const row = await db.query.anamnesis.findFirst({
    where: eq(schema.anamnesis.token, token),
    with: { contact: { columns: { name: true } }, organization: { columns: { name: true } } },
  })
  if (!row) notFound()

  const template = getTemplate(row.templateId)
  const firstName = row.contact.name.split(" ")[0]

  return (
    <PublicShell>
      <div className="w-full max-w-2xl rounded-[16px] border bg-card p-6 shadow-[0_1px_8px_rgba(0,0,0,0.08)] sm:p-10 dark:shadow-none">
        <p className="text-sm font-semibold text-muted-foreground">{row.organization.name}</p>
        <h1 className="mt-1 text-2xl font-bold">{template.title}</h1>
        {row.status === "completed" ? (
          <p className="mt-4 text-muted-foreground">
            Esta anamnese já foi respondida. Obrigado, {firstName}! Se precisar corrigir algo, avise no
            atendimento.
          </p>
        ) : (
          <>
            <p className="mt-2 text-muted-foreground">
              Olá, {firstName}. {template.intro}
            </p>
            <p className="mt-4 mb-8 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <LockIcon className="size-4 shrink-0" /> Suas respostas são criptografadas e só a equipe que te
              atende tem acesso.
            </p>
            <PublicAnamnesis token={token} template={template} />
          </>
        )}
      </div>
    </PublicShell>
  )
}
