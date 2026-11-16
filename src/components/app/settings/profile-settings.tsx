"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { VerticalIcon } from "@/components/vertical-icon"
import { VERTICAL_GROUPS, VERTICALS, type VerticalId } from "@/lib/verticals"
import { updateProfile } from "@/server/settings"

export function ProfileSettings(props: {
  vertical: VerticalId
  organizationName: string
  isClinic: boolean
  professionalRegistry: string
  taxId: string
  address: string
}) {
  const [vertical, setVertical] = useState(props.vertical)
  const [organizationName, setOrganizationName] = useState(props.organizationName)
  const [registry, setRegistry] = useState(props.professionalRegistry)
  const [taxId, setTaxId] = useState(props.taxId)
  const [address, setAddress] = useState(props.address)
  const [pending, startTransition] = useTransition()
  const v = VERTICALS[vertical]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Área de atuação</CardTitle>
        <CardDescription>Define o vocabulário do painel e os recursos sugeridos.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Área</Label>
          <Select value={vertical} onValueChange={(value) => setVertical(value as VerticalId)}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VERTICAL_GROUPS.map((g) => (
                <SelectGroup key={g.id}>
                  <SelectLabel>{g.label}</SelectLabel>
                  {g.verticals.map((id) => (
                    <SelectItem key={id} value={id}>
                      <VerticalIcon vertical={id} /> {VERTICALS[id].label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          {vertical !== props.vertical && (
            <p className="text-xs text-muted-foreground">
              Os recursos padrão de {v.label} serão ativados. Seus dados não são alterados.
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="registry">Registro profissional {v.registryLabel && `(${v.registryLabel})`}</Label>
          <Input
            id="registry"
            value={registry}
            onChange={(e) => setRegistry(e.target.value)}
            placeholder={v.registryLabel ? `${v.registryLabel} 00/000000` : "Opcional"}
            className="h-10"
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="orgName">{props.isClinic ? "Nome do estabelecimento" : "Nome de exibição"}</Label>
          <Input
            id="orgName"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="taxId">CPF ou CNPJ</Label>
          <Input
            id="taxId"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="Impresso nos recibos"
            className="h-10"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="address">Endereço do consultório</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Rua, número, cidade/UF"
            className="h-10"
          />
        </div>
        <div className="sm:col-span-2">
          <Button
            className="rounded-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await updateProfile({
                  vertical,
                  organizationName,
                  professionalRegistry: registry,
                  taxId,
                  address,
                })
                if (res.ok) toast.success("Configurações salvas")
                else toast.error(res.error)
              })
            }
          >
            {pending && <Loader2Icon className="animate-spin" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
