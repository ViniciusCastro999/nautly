/** Cabeçalho de página: rótulo em caixa alta, título grande e subtítulo (layout de referência). */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string
  description?: string
  /** Texto pequeno acima do título. Por padrão, o próprio título. */
  eyebrow?: string | null
  actions?: React.ReactNode
}) {
  const label = eyebrow === undefined ? title : eyebrow
  return (
    <div className="mb-[26px] flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        {label && <p className="eyebrow mb-[9px]">{label}</p>}
        <h1 className="text-[clamp(27px,3vw,34px)] leading-[1.15] font-medium tracking-[-0.02em] text-primary dark:text-foreground">
          {title}
        </h1>
        {description && <p className="mt-[7px] text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
