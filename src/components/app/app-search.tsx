import { SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Busca da barra superior: procura na lista de pacientes/clientes. */
export function AppSearch({ placeholder, className }: { placeholder: string; className?: string }) {
  return (
    <form
      action="/app/contacts"
      role="search"
      className={cn(
        "flex h-[39px] w-[min(420px,42vw)] items-center gap-2.5 rounded-[9px] border bg-muted px-3 text-muted-foreground focus-within:border-ring focus-within:bg-card",
        className,
      )}
    >
      <SearchIcon className="size-4 shrink-0" />
      <input
        name="q"
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
      />
    </form>
  )
}
