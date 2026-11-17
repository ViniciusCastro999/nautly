import type { Metadata } from "next"
import { Nunito, Outfit } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
})
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["500", "600"] })

export const metadata: Metadata = {
  title: { default: "Nautly Agendamentos · Agenda online para consultórios", template: "%s · Nautly" },
  applicationName: "Nautly Agendamentos",
  description:
    "Agenda online e ficha do paciente no mesmo lugar. Seus pacientes marcam no horário que funciona para eles, e você ganha tempo para cuidar de cada um.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${nunito.variable} ${outfit.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}
