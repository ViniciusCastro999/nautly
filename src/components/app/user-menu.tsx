"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDownIcon, ExternalLinkIcon, LogOutIcon, SettingsIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Perfil no canto da barra superior: avatar, nome, papel e menu da conta. */
export function UserMenu({
  name,
  email,
  username,
  subtitle,
  compact = false,
}: {
  name: string
  email: string
  username: string
  subtitle?: string
  /** Só o avatar (barra superior no celular). */
  compact?: boolean
}) {
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2.5 rounded-[10px] text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          !compact && "py-1 pr-1 pl-1 hover:bg-muted",
        )}
        aria-label="Abrir menu da conta"
      >
        <UserAvatar name={name} />
        {!compact && (
          <>
            <div className="hidden min-w-[106px] sm:grid">
              <strong className="truncate text-xs font-semibold">{name}</strong>
              <span className="truncate text-[13px] text-muted-foreground">{subtitle ?? email}</span>
            </div>
            <ChevronDownIcon className="hidden size-4 text-muted-foreground sm:block" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid">
          <span className="truncate">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${username}`} target="_blank">
            <ExternalLinkIcon /> Minha página pública
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/settings">
            <SettingsIcon /> Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await authClient.signOut()
            router.push("/login")
            router.refresh()
          }}
        >
          <LogOutIcon /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar className={cn("size-[41px]", className)}>
      <AvatarFallback className="bg-foam/60 text-xs font-semibold text-primary dark:bg-sea-50 dark:text-foam">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
