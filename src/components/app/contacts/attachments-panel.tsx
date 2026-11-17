"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  DownloadIcon,
  EyeIcon,
  FileIcon,
  FileImageIcon,
  FileTextIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type FileRow = {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  category: "exam" | "image" | "document" | "other"
  description: string | null
  uploadedBy: string
  createdAt: string
}

const CATEGORY_LABELS: Record<FileRow["category"], string> = {
  exam: "Exame",
  image: "Imagem",
  document: "Documento",
  other: "Outro",
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function AttachmentsPanel({
  contactId,
  canWrite,
  files,
}: {
  contactId: string
  canWrite: boolean
  files: FileRow[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState<FileRow["category"]>("exam")
  const [description, setDescription] = useState("")
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)

  async function upload() {
    if (!file) return
    setUploading(true)
    const body = new FormData()
    body.set("file", file)
    body.set("category", category)
    body.set("description", description)
    const res = await fetch(`/api/contacts/${contactId}/attachments`, { method: "POST", body })
    setUploading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "Não foi possível enviar o arquivo.")
      return
    }
    toast.success("Arquivo anexado")
    setFile(null)
    setDescription("")
    if (inputRef.current) inputRef.current.value = ""
    router.refresh()
  }

  return (
    <div className="grid gap-6">
      {canWrite && (
        <section className="rounded-[13px] border bg-card p-5">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files[0]
              if (f) setFile(f)
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors hover:border-primary/60 hover:bg-accent/40",
              dragging && "border-primary bg-accent/60",
            )}
          >
            <UploadIcon className="size-6 text-primary" />
            {file ? (
              <p className="text-sm font-medium">
                {file.name} <span className="text-muted-foreground">({formatSize(file.size)})</span>
              </p>
            ) : (
              <>
                <p className="text-sm font-medium">Arraste um arquivo ou clique para escolher</p>
                <p className="text-xs text-muted-foreground">
                  PDF ou imagem, até 4 MB. Guardado com criptografia.
                </p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,text/plain"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {file && (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as FileRow["category"])}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid min-w-48 flex-1 gap-1.5">
                <Label className="text-xs text-muted-foreground">Descrição (opcional)</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex.: Hemograma completo, março"
                />
              </div>
              <Button disabled={uploading} onClick={upload}>
                {uploading && <Loader2Icon className="animate-spin" />}
                Anexar
              </Button>
            </div>
          )}
        </section>
      )}

      {files.length === 0 ? (
        <div className="flex flex-col items-center rounded-[13px] border border-dashed bg-card p-10 text-center">
          <FileIcon className="mb-3 size-8 text-muted-foreground" />
          <p className="font-semibold">Nenhum anexo</p>
          <p className="mt-1 text-sm text-muted-foreground">Exames, laudos e imagens aparecem aqui.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {files.map((f) => {
            const Icon = f.mimeType.startsWith("image/")
              ? FileImageIcon
              : f.mimeType === "application/pdf"
                ? FileTextIcon
                : FileIcon
            return (
              <li key={f.id} className="flex flex-col rounded-[13px] border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold" title={f.fileName}>
                      {f.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(f.sizeBytes)} · {f.createdAt} · {f.uploadedBy}
                    </p>
                  </div>
                  <Badge variant="secondary">{CATEGORY_LABELS[f.category]}</Badge>
                </div>
                {f.description && <p className="mt-3 text-sm text-muted-foreground">{f.description}</p>}
                <div className="mt-auto flex gap-2 pt-4">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <a href={`/api/attachments/${f.id}?inline=1`} target="_blank" rel="noreferrer">
                      <EyeIcon /> Visualizar
                    </a>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <a href={`/api/attachments/${f.id}`} aria-label="Baixar">
                      <DownloadIcon />
                    </a>
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
