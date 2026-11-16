import { ShieldCheckIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { initials } from "@/lib/format"

export function TeamSettings({
  isClinic,
  members,
}: {
  isClinic: boolean
  members: { id: string; name: string; email: string; role: string }[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipe e acesso</CardTitle>
        <CardDescription>
          {isClinic
            ? "Profissionais acessam o prontuário. Recepção e administradores gerenciam agenda e cadastro, sem ver dados clínicos."
            : "Você é o único usuário desta conta."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initials(m.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{m.name}</p>
              <p className="truncate text-sm text-muted-foreground">{m.email}</p>
            </div>
            <Badge variant="secondary">{m.role}</Badge>
          </div>
        ))}
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" />
          Convites para profissionais e recepção chegam em breve. As permissões por papel já estão aplicadas.
        </div>
      </CardContent>
    </Card>
  )
}
