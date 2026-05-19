import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, FileText, Image as ImageIcon, FileSpreadsheet, FileType2, Camera, ClipboardPaste } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.xml,.csv,.xlsx,.xls";

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
}

function iconFor(file: File) {
  const t = file.type;
  if (t.startsWith("image/")) return ImageIcon;
  if (t.includes("pdf")) return FileType2;
  if (t.includes("sheet") || file.name.endsWith(".csv") || file.name.endsWith(".xlsx")) return FileSpreadsheet;
  return FileText;
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadDropzone({ files, onChange }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const acceptFiles = useCallback(
    (list: FileList | File[]) => {
      const arr = Array.from(list);
      const tooBig = arr.find((f) => f.size > MAX_SIZE);
      if (tooBig) {
        toast.error(`"${tooBig.name}" excede 10MB`);
        return;
      }
      const next = [...files, ...arr].slice(0, MAX_FILES);
      onChange(next);
      if (arr.length + files.length > MAX_FILES) {
        toast.warning(`Apenas ${MAX_FILES} arquivos por demanda.`);
      }
    },
    [files, onChange],
  );

  // Paste from clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      const imgs = items
        .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter((f): f is File => !!f);
      if (imgs.length) {
        acceptFiles(imgs);
        toast.success(`${imgs.length} imagem(ns) coladas`);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [acceptFiles]);

  // Build previews for image files
  useEffect(() => {
    const urls: Record<string, string> = {};
    files.forEach((f, i) => {
      if (f.type.startsWith("image/")) {
        urls[`${i}-${f.name}`] = URL.createObjectURL(f);
      }
    });
    setPreviews(urls);
    return () => Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const remove = (idx: number) => onChange(files.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files) acceptFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200",
          "bg-gradient-to-br from-white/70 to-white/30 backdrop-blur-xl",
          dragging
            ? "border-primary/60 bg-primary/[0.04] scale-[1.01] shadow-[0_10px_30px_-10px_rgba(59,130,246,0.35)]"
            : "border-black/[0.12] hover:border-primary/40 hover:bg-white/80",
        )}
      >
        <div className="relative mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center mb-3 shadow-[0_8px_20px_-4px_rgba(59,130,246,0.45),inset_0_1px_0_rgba(255,255,255,0.45)]">
          <Upload className="w-6 h-6" />
        </div>
        <div className="text-sm font-semibold">Arraste arquivos ou clique para selecionar</div>
        <div className="text-[11.5px] text-muted-foreground mt-1">
          PDF, imagens, XML, planilhas — até 10MB cada, máx {MAX_FILES} arquivos
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ClipboardPaste className="w-3 h-3" /> Ctrl+V para colar print</span>
          <span className="hidden md:inline">·</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); cameraRef.current?.click(); }}
            className="inline-flex items-center gap-1 md:hidden text-primary"
          >
            <Camera className="w-3 h-3" /> Foto
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => e.target.files && acceptFiles(e.target.files)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files && acceptFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {files.map((f, i) => {
            const Icon = iconFor(f);
            const previewUrl = previews[`${i}-${f.name}`];
            return (
              <li
                key={`${i}-${f.name}`}
                className="group relative flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white/70 backdrop-blur-md px-3 py-2.5 shadow-[0_2px_6px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.6)]"
              >
                {previewUrl ? (
                  <img src={previewUrl} alt={f.name} className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{f.name}</div>
                  <div className="text-[11px] text-muted-foreground">{fmtSize(f.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="opacity-50 hover:opacity-100 hover:text-destructive transition-opacity"
                  aria-label={`Remover ${f.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
