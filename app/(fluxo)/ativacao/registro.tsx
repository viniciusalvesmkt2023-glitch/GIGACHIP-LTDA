"use client";

/* eslint-disable @next/next/no-img-element -- prévias locais das imagens escolhidas */
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { ArrowRight, Check, Clock, Copy, ImageUp, LoaderCircle, ScanLine } from "lucide-react";
import { extractDeviceNumbers } from "@/lib/domain/ocr-extract";
import { submitActivationDevice, type ActivationDeviceState } from "./actions";
import { CelularGuia, detectarSistema, type Sistema } from "./esim-guia";

/*
 * Etapa 1 da ativação (desenho do Lovable, ligado ao sistema):
 *   eSIM → passo a passo animado do *#06# (iPhone/Android) e envio do print do registro do eSIM;
 *   chip físico → foto do verso da embalagem lacrada e o número do chip (ICCID).
 * Os números são lidos da imagem no próprio celular (nada sai do aparelho para isso) e o cliente
 * confere antes de enviar. O servidor valida tudo de novo.
 */

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

/** Lê o texto da imagem no próprio navegador (arquivos do OCR servidos pelo site, sem CDN). */
async function readNumbers(file: File) {
  const { createWorker } = await import("tesseract.js");
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

type Leitura = "idle" | "lendo" | "ok" | "nada";
type Found = Awaited<ReturnType<typeof readNumbers>>;

/** Área de envio da imagem, com prévia e leitura automática dos números. */
function EnviarImagem({ rotulo, erro, onArquivo }: { rotulo: string; erro?: string; onArquivo: (f: File, found: Found | null) => void }) {
  const [arquivo, setArquivo] = useState<{ nome: string; url: string } | null>(null);
  const [leitura, setLeitura] = useState<Leitura>("idle");
  useEffect(
    () => () => {
      if (arquivo) URL.revokeObjectURL(arquivo.url);
    },
    [arquivo],
  );
  return (
    <label className={`ac-upload ${arquivo ? "has-file" : ""} ${erro ? "has-error" : ""}`}>
      {arquivo ? (
        <>
          <img src={arquivo.url} alt="" className="ac-upload-preview" />
          <span className="ac-upload-body">
            <strong>{arquivo.nome}</strong>
            {leitura === "lendo" ? (
              <span className="ac-reading">
                <ScanLine size={14} /> Lendo os números da imagem…
              </span>
            ) : leitura === "ok" ? (
              <span className="ac-read-ok">
                <Check size={14} /> Números lidos — confira abaixo
              </span>
            ) : (
              <span className="ac-reading">Não conseguimos ler sozinhos — digite abaixo olhando a imagem</span>
            )}
            <span className="ac-upload-change">Trocar imagem</span>
          </span>
        </>
      ) : (
        <>
          <span className="ac-upload-icon">
            <ImageUp size={26} />
          </span>
          <strong>{rotulo}</strong>
          <span>Toque para escolher da galeria ou tirar uma foto · PNG, JPG ou WEBP</span>
        </>
      )}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setArquivo({ nome: f.name, url: URL.createObjectURL(f) });
          setLeitura("lendo");
          let found: Found | null = null;
          try {
            found = await readNumbers(f);
          } catch {
            found = null;
          }
          setLeitura(found && (found.imeis.length || found.eid || found.iccid) ? "ok" : "nada");
          onArquivo(f, found);
        }}
      />
      {erro && <span className="ck-error">{erro}</span>}
    </label>
  );
}

function Numero({ label, value, onChange, erro, dica, max }: {
  label: string; value: string; onChange: (v: string) => void; erro?: string; dica?: string; max: number;
}) {
  return (
    <label className={`ck-field mt-4 ${erro ? "has-error" : ""}`}>
      <span className="ck-label">
        {label} <span className="ck-req">*</span>
      </span>
      <input
        className="ck-input font-mono"
        inputMode="numeric"
        value={value}
        maxLength={max}
        onChange={(e) => onChange(e.target.value.replace(/[^\d ]/g, ""))}
      />
      {erro ? <span className="ck-error">{erro}</span> : dica ? <span className="ck-hint">{dica}</span> : null}
    </label>
  );
}

/** Envio comum aos dois tipos de chip. */
function useEnvio() {
  const router = useRouter();
  const [state, setState] = useState<ActivationDeviceState>({ errors: {} });
  const [pending, startTransition] = useTransition();
  const enviar = (campos: Record<string, string>, arquivo: File | null, nome: string) =>
    startTransition(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(campos)) if (v) fd.set(k, v);
      if (arquivo) {
        try {
          fd.set("print", await shrink(arquivo), nome);
        } catch {
          setState({ errors: { print: "Não conseguimos processar a imagem. Tente outra." } });
          return;
        }
      }
      const r = await submitActivationDevice(fd);
      setState(r);
      if (r.ok) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        router.refresh();
      }
    });
  return { state, pending, enviar };
}

function Confirmar({ state, checked, onChange }: { state: ActivationDeviceState; checked: boolean; onChange: (v: boolean) => void }) {
  if (!state.needsConfirmation) return null;
  return (
    <div className="ac-confirm">
      <p>{state.errors.confirmWarnings}</p>
      <label>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> Conferi e os números estão corretos.
      </label>
    </div>
  );
}

function Enviando({ pending, children }: { pending: boolean; children: ReactNode }) {
  return pending ? (
    <>
      <LoaderCircle size={18} className="animate-spin" /> Enviando...
    </>
  ) : (
    <>{children}</>
  );
}

/* ---------------- eSIM ---------------- */

const PASSOS_ESIM: { titulo: string; texto: (os: Sistema) => ReactNode }[] = [
  {
    titulo: "Abra o aplicativo de ligações",
    texto: () => (
      <>
        É o app com o desenho de um <b>telefone</b>, o mesmo que você usa para fazer ligações.
      </>
    ),
  },
  {
    titulo: "Digite o código *#06#",
    texto: () => (
      <>
        No teclado, digite <b>asterisco, jogo da velha, zero, seis, jogo da velha</b>. Não precisa apertar o botão de ligar.
      </>
    ),
  },
  {
    titulo: "A tela com os números vai abrir sozinha",
    texto: (os) => (
      <>
        Vão aparecer o <b>EID</b> e o <b>IMEI</b> do seu celular. {os === "ios" ? "(No iPhone, o título é “Informações do Aparelho”.)" : ""}
      </>
    ),
  },
  {
    titulo: "Tire um print dessa tela",
    texto: (os) =>
      os === "ios" ? (
        <>
          Aperte <b>ao mesmo tempo</b> o botão do <b>lado direito</b> e o botão de <b>aumentar o volume</b>, e solte. A tela pisca: o
          print foi salvo nas suas fotos.
        </>
      ) : (
        <>
          Aperte <b>ao mesmo tempo</b> o botão de <b>ligar/desligar</b> e o de <b>diminuir o volume</b>, e solte. A tela pisca: o print
          foi salvo na sua galeria.
        </>
      ),
  },
];

const semAssinatura = () => () => {};

export function RegistroEsim({ ajudaWhatsapp }: { ajudaWhatsapp: string | null }) {
  const detectado = useSyncExternalStore(semAssinatura, detectarSistema, () => "android" as Sistema);
  const [escolhido, setEscolhido] = useState<Sistema | null>(null);
  const os = escolhido ?? detectado;
  const [passo, setPasso] = useState(1);
  const [copiado, setCopiado] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [imei, setImei] = useState("");
  const [eid, setEid] = useState("");
  const [lido, setLido] = useState(false);
  const [conferi, setConferi] = useState(false);
  const { state, pending, enviar } = useEnvio();
  const e = state.errors;
  const total = PASSOS_ESIM.length;
  const atual = PASSOS_ESIM[passo - 1];
  const enviarPrint = passo > total;

  return (
    <div>
      <p className="ck-kicker">Pagamento confirmado ✓</p>
      <h1 className="ck-title">Envie o registro do eSIM do seu celular</h1>
      <p className="ck-sub ac-sub-big">A Vivo precisa dos números do seu aparelho para criar o eSIM. É rápido: siga os passos abaixo.</p>

      <div className="eg-os" role="radiogroup" aria-label="Qual é o seu celular?">
        <span>Seu celular:</span>
        {(["ios", "android"] as const).map((s) => (
          <button key={s} type="button" role="radio" aria-checked={os === s} className={os === s ? "is-on" : ""} onClick={() => setEscolhido(s)}>
            {s === "ios" ? "iPhone" : "Android"}
          </button>
        ))}
      </div>

      {!enviarPrint && atual ? (
        <div className="eg-box">
          <CelularGuia key={`${os}-${passo}`} passo={passo} os={os} />
          <div className="eg-text">
            <p className="eg-count">
              Passo {passo} de {total}
            </p>
            <div className="eg-dots" aria-hidden="true">
              {PASSOS_ESIM.map((_, i) => (
                <i key={i} className={i < passo ? "is-on" : ""} />
              ))}
            </div>
            <h2 className="eg-title">{atual.titulo}</h2>
            <p className="eg-desc">{atual.texto(os)}</p>
            {passo === 2 && (
              <div className="eg-code">
                <span>*#06#</span>
                <button
                  type="button"
                  className={copiado ? "is-copied" : ""}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText("*#06#");
                    } catch {
                      /* o código continua visível */
                    }
                    setCopiado(true);
                    window.setTimeout(() => setCopiado(false), 2500);
                  }}
                >
                  {copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? "Copiado!" : "Copiar código"}
                </button>
              </div>
            )}
            <div className="eg-nav">
              {passo > 1 && (
                <button type="button" className="ck-back eg-back" onClick={() => setPasso((p) => p - 1)}>
                  Voltar
                </button>
              )}
              <button type="button" className="ck-btn eg-next" onClick={() => setPasso((p) => p + 1)}>
                {passo === total ? "Já tirei o print" : "Próximo"} <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            enviar({ imei, eid, confirmWarnings: conferi ? "on" : "", fromOcr: lido ? "1" : "" }, arquivo, "registro-esim.jpg");
          }}
        >
          <h2 className="eg-title mt-6">Agora envie o print</h2>
          <p className="eg-desc">Escolha o print na sua galeria de fotos. Os números são lidos sozinhos.</p>
          <EnviarImagem
            rotulo="Escolher o print"
            erro={e.print}
            onArquivo={(f, found) => {
              setArquivo(f);
              if (found?.imeis[0]) setImei(found.imeis[0]);
              if (found?.eid) setEid(found.eid);
              setLido(Boolean(found?.imeis[0] || found?.eid));
            }}
          />
          {arquivo && (
            <div className="eg-read">
              <p>
                <b>Confira se os números estão iguais aos da tela do seu celular:</b>
              </p>
              <Numero label="IMEI" value={imei} onChange={(v) => { setImei(v); setLido(false); }} erro={e.imei} max={20} dica="15 números." />
              <Numero
                label="EID"
                value={eid}
                onChange={(v) => { setEid(v); setLido(false); }}
                erro={e.eid}
                max={40}
                dica="32 números, começa com 89. Se não aparecer EID, seu celular pode não aceitar eSIM — fale com a gente."
              />
            </div>
          )}
          <Confirmar state={state} checked={conferi} onChange={setConferi} />
          {e.form && <p className="ck-alert">{e.form}</p>}
          <div className="eg-nav">
            <button type="button" className="ck-back eg-back" onClick={() => setPasso(total)} disabled={pending}>
              Voltar
            </button>
            <button type="submit" className="ck-btn eg-next" disabled={!arquivo || pending}>
              <Enviando pending={pending}>
                Enviar <ArrowRight size={18} />
              </Enviando>
            </button>
          </div>
        </form>
      )}

      {ajudaWhatsapp && (
        <>
          <button type="button" className="ac-link" onClick={() => setAjuda(true)}>
            Não consegui, quero ajuda
          </button>
          {ajuda && (
            <p className="eg-helpbox">
              Sem problema!{" "}
              <a href={ajudaWhatsapp} target="_blank" rel="noopener noreferrer">
                Fale com a gente no WhatsApp
              </a>{" "}
              — a mensagem já vai com “Preciso de ajuda para enviar o registro do eSIM”.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- chip físico ---------------- */

function Passo({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="ac-how-item">
      <span className="ac-how-n">{n}</span>
      <span>{children}</span>
    </li>
  );
}

/** Ilustração do verso da embalagem do chip, com o número (ICCID) destacado. */
function VersoChip() {
  return (
    <svg viewBox="0 0 260 150" className="ac-chip-art" role="img" aria-label="Verso da embalagem do chip: código de barras e o número que começa com 8955">
      <rect x="1" y="1" width="258" height="148" rx="14" fill="#fff" stroke="#dfe5ec" strokeWidth="2" />
      <text x="18" y="30" fontSize="13" fontWeight="700" fill="#660099">
        vivo
      </text>
      <text x="18" y="48" fontSize="9" fill="#64748b">
        Chip 4G/5G · Triplo corte
      </text>
      {Array.from({ length: 46 }, (_, i) => (
        <rect key={i} x={18 + i * 4.8} y="62" width={i % 3 === 0 ? 2.6 : i % 2 ? 1.2 : 1.8} height="38" fill="#0f172a" />
      ))}
      <rect x="12" y="106" width="236" height="30" rx="8" fill="#e8f6fd" stroke="#01a3ec" strokeWidth="2" strokeDasharray="5 4" />
      <text x="130" y="126" textAnchor="middle" fontSize="14" fontWeight="700" letterSpacing="1" fill="#0a6fc2">
        8955 1093 0000 0000 000
      </text>
    </svg>
  );
}

export function RegistroFisico() {
  const [depois, setDepois] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [iccid, setIccid] = useState("");
  const [lido, setLido] = useState(false);
  const [conferi, setConferi] = useState(false);
  const { state, pending, enviar } = useEnvio();
  const e = state.errors;

  if (depois) {
    return (
      <div className="ac-later">
        <span className="ac-later-icon">
          <Clock size={22} />
        </span>
        <h2>Sem problema, guardamos seu pedido!</h2>
        <p>
          Quando estiver com o chip Vivo lacrado em mãos, abra de novo o <b>link do formulário de ativação</b> que mandamos para o seu
          e-mail e envie a foto do verso da embalagem. Leva menos de 1 minuto.
        </p>
        <button type="button" className="ck-back" onClick={() => setDepois(false)}>
          Já estou com o chip, enviar agora
        </button>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        enviar({ iccid, confirmWarnings: conferi ? "on" : "", fromOcr: lido ? "1" : "" }, arquivo, "embalagem-chip.jpg");
      }}
    >
      <p className="ck-kicker">Pagamento confirmado ✓</p>
      <h1 className="ck-title">Envie a foto do seu chip</h1>
      <p className="ck-sub">Para ativar sua linha, a Vivo precisa do número do chip. Ele está impresso no verso da embalagem.</p>

      <div className="ac-how">
        <div>
          <p className="ac-how-title">Como fazer</p>
          <ol>
            <Passo n={1}>
              Pegue o <b>chip Vivo novo</b>, ainda <b>lacrado</b> na embalagem.
            </Passo>
            <Passo n={2}>
              Vire a embalagem: no verso tem um <b>código de barras</b> e um número de 19 a 20 dígitos que começa com <b>8955</b>.
            </Passo>
            <Passo n={3}>Tire uma foto nítida do verso, com boa luz e sem reflexo, e envie aqui embaixo.</Passo>
          </ol>
        </div>
        <VersoChip />
      </div>

      <EnviarImagem
        rotulo="Enviar foto do verso da embalagem"
        erro={e.print}
        onArquivo={(f, found) => {
          setArquivo(f);
          if (found?.iccid) setIccid(found.iccid);
          setLido(Boolean(found?.iccid));
        }}
      />

      <Numero
        label="Número do chip (ICCID)"
        value={iccid}
        onChange={(v) => {
          setIccid(v.slice(0, 24));
          setLido(false);
        }}
        erro={e.iccid}
        max={24}
        dica={lido ? "Preenchido pela foto. Confira com o número da embalagem." : "Preenchemos sozinho pela foto, ou digite aqui."}
      />
      <Confirmar state={state} checked={conferi} onChange={setConferi} />
      {e.form && <p className="ck-alert">{e.form}</p>}

      <button type="submit" className="ck-btn" disabled={!arquivo || iccid.replace(/\D/g, "").length < 19 || pending}>
        <Enviando pending={pending}>
          Enviar dados do chip <ArrowRight size={18} />
        </Enviando>
      </button>
      <button type="button" className="ac-link" onClick={() => setDepois(true)}>
        Ainda não estou com o chip — envio depois
      </button>
    </form>
  );
}
