import type { Metadata } from "next"
import { Inter, Outfit } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] })
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["500", "600"] })

export const metadata: Metadata = {
  title: { default: "Nautly Agendamentos · Agenda online para consultórios", template: "%s · Nautly" },
  applicationName: "Nautly Agendamentos",
  description:
    "Compartilhe seu link, deixe clientes escolherem um horário livre e pare de negociar agenda por mensagem.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${outfit.variable} h-full antialiased`}
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
