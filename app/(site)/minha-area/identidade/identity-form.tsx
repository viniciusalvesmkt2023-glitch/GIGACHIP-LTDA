"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonStyles } from "@/components/ui";
import type { IdentityKind } from "@/lib/domain/image-check";
import { uploadIdentity, type IdentityUploadState } from "./actions";

const FIELDS: { kind: IdentityKind; title: string; hint: string; capture: "user" | "environment" }[] = [
  { kind: "doc_front", title: "Documento — frente", hint: "RG ou CNH, a parte com a foto. Sem reflexo e com todos os cantos aparecendo.", capture: "environment" },
  { kind: "doc_back", title: "Documento — verso", hint: "O outro lado do mesmo documento.", capture: "environment" },
  { kind: "selfie", title: "Selfie", hint: "Seu rosto de frente, em lugar iluminado, sem óculos escuros ou boné.", capture: "user" },
];

/** Reduz a foto no próprio celular antes de enviar (envio mais rápido e dentro do limite). */
async function shrink(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new Error("não foi possível processar a imagem");
  if (blob.size > 1_400_000 && maxSide > 1000) return shrink(file, maxSide - 400, quality - 0.1);
  return blob;
}

export function IdentityForm({ redirectTo = "/minha-area" }: { redirectTo?: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<Partial<Record<IdentityKind, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<IdentityKind, string>>>({});
  const [state, setState] = useState<IdentityUploadState>({});
  const [pending, startTransition] = useTransition();

  function pick(kind: IdentityKind, file: File | undefined) {
    if (!file) return;
    setFiles((f) => ({ ...f, [kind]: file }));
    setPreviews((p) => {
      if (p[kind]) URL.revokeObjectURL(p[kind]!);
      return { ...p, [kind]: URL.createObjectURL(file) };
    });
  }

  function submit() {
    startTransition(async () => {
      const missing = FIELDS.find((f) => !files[f.kind]);
      if (missing) {
        setState({ message: "Envie as três fotos.", field: missing.kind });
        return;
      }
      try {
        const fd = new FormData();
        for (const f of FIELDS) fd.append(f.kind, await shrink(files[f.kind]!), `${f.kind}.jpg`);
        const r = await uploadIdentity(fd);
        setState(r);
        if (r.ok) {
          router.push(redirectTo);
          router.refresh();
        }
      } catch {
        setState({ message: "Não conseguimos processar as fotos. Tente tirar de novo." });
      }
    });
  }

  return (
    <div className="space-y-5">
      {state.message && <p role="alert" className="rounded-xl border border-danger bg-red-50 p-4 text-sm text-danger">{state.message}</p>}
      {FIELDS.map((f) => (
        <div key={f.kind} className={`rounded-2xl border p-4 ${state.field === f.kind ? "border-danger" : "border-border"}`}>
          <p className="font-semibold">{f.title}</p>
          <p className="text-sm text-muted">{f.hint}</p>
          <div className="mt-3 flex items-center gap-4">
            {previews[f.kind] ? (
              // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob)
              <img src={previews[f.kind]} alt="" className="h-20 w-20 rounded-lg object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-surface text-2xl text-muted">📷</div>
            )}
            <label className={`${buttonStyles.secondary} cursor-pointer py-2`}>
              {files[f.kind] ? "Trocar foto" : "Tirar / escolher foto"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture={f.capture}
                className="sr-only"
                onChange={(e) => pick(f.kind, e.target.files?.[0])}
              />
            </label>
          </div>
        </div>
      ))}
      <button type="button" onClick={submit} disabled={pending} className={`${buttonStyles.primary} w-full py-4 text-base`}>
        {pending ? "Enviando com segurança..." : "Enviar para análise"}
      </button>
    </div>
  );
}
