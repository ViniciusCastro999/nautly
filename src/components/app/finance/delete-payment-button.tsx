"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2Icon, Trash2Icon } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { deletePayment } from "@/server/payments"

export function DeletePaymentButton({ id, label }: { id: string; label: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Excluir pagamento" className="text-muted-foreground">
          {pending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir pagamento?</AlertDialogTitle>
          <AlertDialogDescription>
            {label}. Se estiver ligado a um atendimento, ele volta para “a receber”.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                const res = await deletePayment(id)
                if (!res.ok) toast.error(res.error)
                else {
                  toast.success("Pagamento excluído")
                  router.refresh()
                }
              })
            }
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
