"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"
import { USERNAME_REGEX } from "@/lib/constants"

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
}

export function SignupForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [username, setUsername] = useState("")
  const [touchedUsername, setTouchedUsername] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    if (!USERNAME_REGEX.test(username)) {
      setError("Use apenas letras minúsculas, números e hífens no seu link.")
      return
    }
    setPending(true)
    setError(null)
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      username,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    if (error) {
      setError(
        error.code === "USERNAME_IS_ALREADY_TAKEN" ||
          error.code === "USERNAME_IS_ALREADY_TAKEN_PLEASE_TRY_ANOTHER"
          ? "Esse link já está em uso. Tente outro."
          : error.code === "INVALID_USERNAME"
            ? "Esse link não está disponível. Tente outro."
            : error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
              ? "Já existe uma conta com esse e-mail."
              : (error.message ?? "Não foi possível criar a conta."),
      )
      setPending(false)
      return
    }
    router.push("/onboarding")
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Crie sua conta grátis</CardTitle>
        <CardDescription>Em menos de um minuto você terá seu link de agendamento.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              name="name"
              required
              className="h-10"
              onChange={(e) => {
                if (!touchedUsername) setUsername(slugify(e.target.value))
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username">Seu link</Label>
            <div className="flex h-10 items-center overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <span className="border-r bg-muted px-3 py-2 text-sm text-muted-foreground">nautly.app/</span>
              <input
                id="username"
                value={username}
                onChange={(e) => {
                  setTouchedUsername(true)
                  setUsername(slugify(e.target.value))
                }}
                required
                minLength={3}
                className="h-full flex-1 bg-transparent px-3 text-sm outline-none"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="h-10 rounded-full" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Criar conta
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
