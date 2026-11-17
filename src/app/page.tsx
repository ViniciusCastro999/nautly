import Link from "next/link"
import {
  ArrowRightIcon,
  BellRingIcon,
  BuildingIcon,
  CalendarCheck2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  GlobeIcon,
  LinkIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
  UsersIcon,
  VideoIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { getSession } from "@/lib/session"

export default async function Home() {
  const session = await getSession()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-transparent bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo withTagline />
          <nav className="hidden items-center gap-8 text-[15px] font-semibold md:flex">
            <a href="#como-funciona" className="hover:text-primary">
              Como funciona
            </a>
            <a href="#recursos" className="hover:text-primary">
              Recursos
            </a>
            <a href="#consultorios" className="hover:text-primary">
              Consultórios
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {session ? (
              <Button asChild className="h-10 px-5">
                <Link href="/app">Ir para o painel</Link>
              </Button>
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className="hidden h-10 rounded-full px-4 font-semibold sm:inline-flex"
                >
                  <Link href="/login">Entrar</Link>
                </Button>
                <Button asChild className="h-10 px-5 font-semibold">
                  <Link href="/signup">Comece grátis</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-40 -right-40 size-[600px] rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute top-60 -left-40 size-[400px] rounded-full bg-brand-foam/20 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                Sua agenda em ordem, <span className="text-primary">mais tempo para cuidar</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg text-muted-foreground">
                Seus pacientes escolhem o horário que funciona para eles, a qualquer hora, e você chega a cada
                consulta com a ficha, o histórico e os documentos à mão. Feito para profissionais autônomos e
                consultórios.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-12 px-7 text-base font-semibold">
                  <Link href="/signup">
                    Criar conta grátis <ArrowRightIcon />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full px-7 text-base font-semibold"
                >
                  <Link href="/ana-souza">Ver página de exemplo</Link>
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Sem cartão de crédito. Pronto em 1 minuto.</p>
            </div>

            <HeroMockup />
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="border-y bg-surface py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Como funciona</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
              Três passos e você nunca mais pergunta &quot;qual horário fica bom pra você?&quot;.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: ClockIcon,
                  title: "Defina sua disponibilidade",
                  text: "Horários por dia da semana, intervalos entre atendimentos e dias bloqueados.",
                },
                {
                  icon: LinkIcon,
                  title: "Compartilhe seu link",
                  text: "Envie por WhatsApp, coloque no Instagram ou no site. Cada serviço tem seu próprio link.",
                },
                {
                  icon: CalendarCheck2Icon,
                  title: "Receba agendamentos",
                  text: "O cliente escolhe um horário livre no fuso dele e tudo aparece no seu painel.",
                },
              ].map(({ icon: Icon, title, text }, i) => (
                <div key={title} className="rounded-[16px] border bg-card p-7">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-[13px] bg-accent text-primary">
                      <Icon className="size-5" />
                    </span>
                    <span className="text-sm font-bold text-muted-foreground">PASSO {i + 1}</span>
                  </div>
                  <h3 className="text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Recursos */}
        <section id="recursos" className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Tudo o que você precisa para agendar
            </h2>
            <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: GlobeIcon,
                  title: "Fusos horários automáticos",
                  text: "Cada pessoa vê os horários no próprio fuso, inclusive com horário de verão.",
                },
                {
                  icon: ShieldCheckIcon,
                  title: "Sem agendamento duplo",
                  text: "Reservas simultâneas são serializadas no banco; o mesmo horário nunca é vendido duas vezes.",
                },
                {
                  icon: VideoIcon,
                  title: "Presencial, vídeo ou telefone",
                  text: "Cada tipo de evento tem seu local, duração, cor e regras.",
                },
                {
                  icon: BellRingIcon,
                  title: "Antecedência e intervalos",
                  text: "Exija antecedência mínima e reserve minutos de folga entre atendimentos.",
                },
                {
                  icon: UsersIcon,
                  title: "Contatos automáticos",
                  text: "Cada pessoa que agenda vira um contato com histórico de agendamentos.",
                },
                {
                  icon: CalendarCheck2Icon,
                  title: "Google Agenda e .ics",
                  text: "O convidado adiciona o compromisso à agenda dele com um clique.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title}>
                  <Icon className="mb-3 size-6 text-primary" />
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-1.5 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Consultórios */}
        <section id="consultorios" className="px-4 pb-20 sm:px-6">
          <div className="mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-3xl bg-[#162a4f] p-8 text-white sm:p-12 lg:grid-cols-[1.2fr_1fr] dark:bg-[#0e2433]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
                <StethoscopeIcon className="size-4" /> Em breve
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Nautly para consultórios
              </h2>
              <p className="mt-4 max-w-lg text-white/75">
                Toda a equipe no mesmo lugar: cada profissional com a própria agenda, a recepção cuidando dos
                horários e o histórico de cada paciente disponível para quem atende.
              </p>
            </div>
            <ul className="grid gap-3">
              {[
                { icon: BuildingIcon, text: "Uma conta para a clínica inteira" },
                { icon: UsersIcon, text: "Vários profissionais e recepção" },
                { icon: CalendarCheck2Icon, text: "Visão unificada da agenda" },
                { icon: BellRingIcon, text: "Lembretes automáticos" },
              ].map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex items-center gap-3 rounded-[13px] bg-white/5 px-4 py-3 font-medium"
                >
                  <Icon className="size-5 text-brand-foam" /> {text}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Logo className="scale-90" />
          <p>Agenda e gestão para consultórios.</p>
        </div>
      </footer>
    </div>
  )
}

function HeroMockup() {
  const available = new Set([3, 4, 5, 6, 10, 11, 12, 13, 17, 18, 19, 20, 24, 25, 26])
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="grid overflow-hidden rounded-[16px] border bg-card shadow-2xl shadow-primary/10 sm:grid-cols-[180px_1fr]">
        <div className="border-b p-5 sm:border-r sm:border-b-0">
          <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            AS
          </span>
          <p className="text-xs font-medium text-muted-foreground">Dra. Ana Souza</p>
          <p className="mt-1 leading-tight font-bold">Consulta inicial</p>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ClockIcon className="size-3.5" /> 50 min
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <VideoIcon className="size-3.5" /> Videochamada
          </p>
        </div>
        <div className="p-5">
          <p className="mb-3 text-sm font-bold">Selecione data e horário</p>
          <div className="mb-2 flex items-center justify-between text-xs font-medium">
            <ChevronLeftIcon className="size-4 text-muted-foreground" />
            Novembro 2026
            <ChevronRightIcon className="size-4 text-primary" />
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <span key={i} className="pb-1 text-muted-foreground">
                {d}
              </span>
            ))}
            {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
              <span
                key={d}
                className={
                  d === 18
                    ? "flex aspect-square items-center justify-center rounded-full bg-primary font-bold text-primary-foreground"
                    : available.has(d)
                      ? "flex aspect-square items-center justify-center rounded-full bg-accent font-bold text-primary"
                      : "flex aspect-square items-center justify-center text-muted-foreground/60"
                }
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute -bottom-6 -left-4 hidden w-44 rounded-[13px] border bg-card p-3 shadow-xl sm:block">
        <p className="mb-2 text-xs font-semibold">quarta, 18 de novembro</p>
        <div className="grid gap-1.5">
          <span className="rounded-md border border-primary/50 py-1.5 text-center text-xs font-bold text-primary">
            09:00
          </span>
          <div className="grid grid-cols-2 gap-1">
            <span className="rounded-md bg-muted-foreground/80 py-1.5 text-center text-xs font-bold text-background">
              10:00
            </span>
            <span className="rounded-md bg-primary py-1.5 text-center text-xs font-bold text-primary-foreground">
              Próximo
            </span>
          </div>
          <span className="rounded-md border border-primary/50 py-1.5 text-center text-xs font-bold text-primary">
            11:00
          </span>
        </div>
      </div>
    </div>
  )
}
