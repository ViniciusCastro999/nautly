import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { APP_NAME, APP_TAGLINE } from "@/lib/constants"
import mark from "../../public/nautly-mark.png"

export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src={mark}
      alt=""
      aria-hidden
      width={32}
      height={32}
      className={cn("size-8", className)}
      priority
    />
  )
}

export function Logo({
  href = "/",
  className,
  withTagline = false,
}: {
  href?: string
  className?: string
  /** Mostra "Agendamentos" ao lado do nome. */
  withTagline?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2", className)}
      aria-label={`${APP_NAME} ${APP_TAGLINE}`}
    >
      <LogoMark />
      <span className="font-brand text-2xl leading-none font-medium tracking-tight text-foreground">
        {APP_NAME.toLowerCase()}
      </span>
      {withTagline && (
        <span className="mt-1 hidden border-l pl-2 text-sm font-medium text-muted-foreground sm:inline">
          {APP_TAGLINE}
        </span>
      )}
    </Link>
  )
}
