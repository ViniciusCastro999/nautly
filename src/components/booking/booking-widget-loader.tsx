"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * O widget depende do fuso horário do navegador, então é renderizado só no
 * cliente. Isso evita divergência de hidratação entre servidor e navegador.
 */
export const BookingWidget = dynamic(() => import("./booking-widget").then((m) => m.BookingWidget), {
  ssr: false,
  loading: () => <Skeleton className="h-[560px] w-full max-w-4xl rounded-2xl" />,
})
