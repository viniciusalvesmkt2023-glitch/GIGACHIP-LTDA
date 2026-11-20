"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonStyles } from "@/components/ui";
import { extractDeviceNumbers } from "@/lib/domain/ocr-extract";
import { submitActivationDevice, type ActivationDeviceState } from "./actions";

/** Reduz a imagem no próprio celular antes de enviar. */
async function shrink(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new Error("falha ao processar imagem");
  return blob.size > 1_400_000 && maxSide > 1000 ? shrink(file, maxSide - 400, quality - 0.1) : blob;
}

/** Lê o texto do print no próprio navegador (nada é enviado para leitura em outro lugar). */
async function readNumbers(file: File) {
  const { createWorker } = await import("tesseract.js");
  // Arquivos servidos pelo próprio site (public/ocr), sem CDN externo
  const worker = await createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/core",
    langPath: "/ocr/lang",
    gzip: true,
    workerBlobURL: false,
  });
  try {
    const { data } = await worker.recognize(file);
    return extractDeviceNumbers(data.text);
  } finally {
    await worker.terminate();
  }
}

const field =
  "mt-1 w-full rounded-xl border px-4 py-3 font-mono text-base tracking-wider outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";

export function DeviceActivationForm({ simType }: { simType: "esim" | "physical" }) {
  const router = useRouter();
  const [print, setPrint] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imei, setImei] = useState("");
  const [imeiOptions, setImeiOptions] = useState<string[]>([]);
  const [eid, setEid] = useState("");
  const [iccid, setIccid] = useState("");
  const [reading, setReading] = useState<"idle" | "lendo" | "ok" | "nada">("idle");
  const [fromOcr, setFromOcr] = useState(false);
  const [confirmWarnings, setConfirmWarnings] = useState(false);
  const [state, setState] = useState<ActivationDeviceState>({ errors: {} });
  const [pending, startTransition] = useTransition();
  const e = state.errors;

  async function onPrint(file: File | undefined) {
    if (!file) return;
    setPrint(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setReading("lendo");
    try {
      const found = await readNumbers(file);
      let any = false;
      if (found.imeis.length) {
        setImei(found.imeis[0]);
        setImeiOptions(found.imeis);
        any = true;
      }
      if (simType === "esim" && found.eid) {
        setEid(found.eid);
        any = true;
      }
      if (simType === "physical" && found.iccid) {
        setIccid(found.iccid);
        any = true;
      }
      setFromOcr(any);
      setReading(any ? "ok" : "nada");
    } catch {
      setReading("nada");
    }
  }

  function submit() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("imei", imei);
      if (simType === "esim") fd.set("eid", eid);
      else fd.set("iccid", iccid);
      if (confirmWarnings) fd.set("confirmWarnings", "on");
      if (fromOcr) fd.set("fromOcr", "1");
      if (print) {
        try {
          fd.set("print", await shrink(print), "print-06.jpg");
        } catch {
          setState({ errors: { print: "Não conseguimos processar o print. Tente outra imagem." } });
          return;
        }
      }
      const r = await submitActivationDevice(fd);
      setState(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <ol className="space-y-3 text-sm">
        <li className="rounded-xl bg-surface p-4">
          <p className="font-semibold">1. Abra o app de ligação e digite <span className="font-mono">*#06#</span></p>
          <p className="mt-1 text-muted">
            Use o celular onde a linha vai funcionar. Os números aparecem <strong>sozinhos assim que você termina de
            digitar</strong> — <strong>não aperte o botão de ligar</strong>.
          </p>
          <a href="tel:" className={`${buttonStyles.secondary} mt-3 py-2`}>
            📞 Abrir o app de ligação
          </a>
          <p className="mt-2 text-xs text-muted">
            Se não abrir, saia do site, abra o app Telefone e digite *#06#. No iPhone também dá para ver em Ajustes → Geral → Sobre.
          </p>
        </li>
        <li className="rounded-xl bg-surface p-4">
          <p className="font-semibold">2. Tire um print da tela com os números</p>
          <p className="mt-1 text-muted">Aperte ao mesmo tempo o botão de desligar e o de abaixar o volume.</p>
        </li>
        <li className={`rounded-xl border p-4 ${e.print ? "border-danger" : "border-border"}`}>
          <p className="font-semibold">3. Envie o print aqui — nós lemos os números para você</p>
          <div className="mt-3 flex items-center gap-4">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- prévia local
              <img src={preview} alt="" className="h-24 w-16 rounded-lg object-cover" />
            ) : (
              <div className="flex h-24 w-16 items-center justify-center rounded-lg bg-surface text-2xl">📱</div>
            )}
            <label className={`${buttonStyles.primary} cursor-pointer py-2`}>
              {print ? "Trocar print" : "Escolher o print"}
              <input type="file" accept="image/*" className="sr-only" onChange={(ev) => onPrint(ev.target.files?.[0])} />
            </label>
          </div>
          {reading === "lendo" && <p className="mt-2 text-sm text-muted" role="status">Lendo os números do print…</p>}
          {reading === "ok" && <p className="mt-2 text-sm text-success">Encontramos os números! Confira abaixo se estão iguais aos do print.</p>}
          {reading === "nada" && <p className="mt-2 text-sm text-muted">Não conseguimos ler os números. Digite-os abaixo, olhando o print.</p>}
          {e.print && <p className="mt-2 text-sm text-danger">{e.print}</p>}
        </li>
      </ol>

      {e.form && <p role="alert" className="rounded-xl border border-danger bg-red-50 p-4 text-sm text-danger">{e.form}</p>}

      <div>
        <label htmlFor="imei" className="block text-sm font-medium">IMEI</label>
        <input id="imei" inputMode="numeric" value={imei} onChange={(ev) => { setImei(ev.target.value); setFromOcr(false); }}
          className={`${field} ${e.imei ? "border-danger" : "border-border"}`} maxLength={20} />
        {imeiOptions.length > 1 && (
          <p className="mt-1 text-xs text-muted">
            Seu celular tem {imeiOptions.length} IMEIs. Usamos o primeiro (IMEI 1), que é o certo na maioria dos casos.
          </p>
        )}
        {e.imei && <p className="mt-1 text-sm text-danger">{e.imei}</p>}
      </div>

      {simType === "esim" ? (
        <div>
          <label htmlFor="eid" className="block text-sm font-medium">EID</label>
          <input id="eid" inputMode="numeric" value={eid} onChange={(ev) => { setEid(ev.target.value); setFromOcr(false); }}
            className={`${field} ${e.eid ? "border-danger" : "border-border"}`} maxLength={40} />
          <p className={`mt-1 text-sm ${e.eid ? "text-danger" : "text-muted"}`}>
            {e.eid ?? "32 números, começa com 89. Se não aparecer EID, seu celular pode não aceitar eSIM — fale com a gente."}
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor="iccid" className="block text-sm font-medium">Número do chip (ICCID)</label>
          <input id="iccid" inputMode="numeric" value={iccid} onChange={(ev) => setIccid(ev.target.value)}
            className={`${field} ${e.iccid ? "border-danger" : "border-border"}`} maxLength={25} />
          <p className={`mt-1 text-sm ${e.iccid ? "text-danger" : "text-muted"}`}>
            {e.iccid ?? "Número longo impresso no cartão do chip Vivo lacrado (começa com 89)."}
          </p>
        </div>
      )}

      {state.needsConfirmation && (
        <div className="rounded-xl border border-accent bg-amber-50 p-4 text-sm">
          <p>{e.confirmWarnings}</p>
          <label className="mt-3 flex gap-2 font-medium">
            <input type="checkbox" checked={confirmWarnings} onChange={(ev) => setConfirmWarnings(ev.target.checked)} />
            Conferi e os números estão corretos.
          </label>
        </div>
      )}

      <button type="button" onClick={submit} disabled={pending || reading === "lendo"} className={`${buttonStyles.primary} w-full py-4 text-base`}>
        {pending ? "Enviando..." : "Enviar dados do aparelho"}
      </button>
    </div>
  );
}
