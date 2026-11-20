/**
 * Gera o PDF do contrato (A4) a partir dos blocos do modelo. Só JavaScript (pdf-lib), sem
 * arquivos de fonte externos — funciona igual no computador e na Vercel.
 */
import { createHash } from "node:crypto";
import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { LOGO_PNG_BASE64 } from "./logo";
import type { Block } from "./template";

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = { x: 56, top: 64, bottom: 64 };
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.39, 0.45, 0.55);
// Cores da marca (amostradas da logo): ciano → verde-água → verde-limão, sobre preto
const HEX = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const BRAND_STOPS = ["#01BAFE", "#34FBA6", "#D8FD0D"].map(HEX);
const DARK = HEX("#000105"); // mesma cor do fundo da logo (sem "quadrado" aparente)
const ON_DARK_MUTED = HEX("#A9B4C2");

/** Cor do degradê da marca na posição t (0 a 1). */
function brandAt(t: number) {
  const seg = t < 0.5 ? 0 : 1;
  const local = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const a = BRAND_STOPS[seg];
  const b = BRAND_STOPS[seg + 1];
  return rgb(a.red + (b.red - a.red) * local, a.green + (b.green - a.green) * local, a.blue + (b.blue - a.blue) * local);
}

/** Barra horizontal em degradê (o PDF padrão não tem degradê; desenha faixas finas). */
function gradientBar(page: PDFPage, x: number, y: number, width: number, height: number) {
  const steps = 120;
  const w = width / steps;
  for (let i = 0; i < steps; i++) {
    page.drawRectangle({ x: x + i * w, y, width: w + 0.4, height, color: brandAt(i / (steps - 1)) });
  }
}

type Run = { text: string; bold: boolean };

/** "texto **negrito** texto" → trechos com/sem negrito. */
function parseRuns(text: string): Run[] {
  return text.split("**").map((t, i) => ({ text: t, bold: i % 2 === 1 })).filter((r) => r.text);
}

/** Troca caracteres que as fontes padrão do PDF não têm (o português é todo suportado). */
function sanitize(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  return [...text.replace(/ /g, " ")].map((ch) => (supported.has(ch.codePointAt(0)!) ? ch : "?")).join("");
}

type Word = { text: string; bold: boolean; width: number; spaceAfter: boolean };

/**
 * Largura SEM kerning, letra a letra: é assim que o drawText desenha. (O widthOfTextAtSize
 * aplica kerning e subestima palavras como "CONTRATADA", grudando-as na seguinte.)
 */
function measure(text: string, font: PDFFont, size: number): number {
  let w = 0;
  for (const ch of text) w += font.widthOfTextAtSize(ch, size);
  return w;
}

function toWords(runs: Run[], fonts: { regular: PDFFont; bold: PDFFont }, size: number): Word[] {
  const words: Word[] = [];
  for (const run of runs) {
    const font = run.bold ? fonts.bold : fonts.regular;
    const parts = sanitize(run.text, font).split(/(\s+)/);
    for (const p of parts) {
      if (!p) continue;
      if (/^\s+$/.test(p)) {
        if (words.length) words[words.length - 1].spaceAfter = true;
        continue;
      }
      words.push({ text: p, bold: run.bold, width: measure(p, font, size), spaceAfter: false });
    }
  }
  return words;
}

function wrap(words: Word[], maxWidth: number, spaceWidth: number): Word[][] {
  const lines: Word[][] = [];
  let line: Word[] = [];
  let width = 0;
  for (const w of words) {
    const prev = line[line.length - 1];
    const gap = prev?.spaceAfter ? spaceWidth : 0;
    if (line.length && prev.spaceAfter && width + gap + w.width > maxWidth) {
      lines.push(line);
      line = [];
      width = 0;
    }
    width += (line.length && line[line.length - 1].spaceAfter ? spaceWidth : 0) + w.width;
    line.push(w);
  }
  if (line.length) lines.push(line);
  return lines;
}

export async function renderContractPdf(
  blocks: Block[],
  opts: { orderCode: string; isTest: boolean; title?: string },
): Promise<{ bytes: Uint8Array; sha256: string; pages: number }> {
  const doc = await PDFDocument.create();
  doc.setTitle(opts.title ?? `Contrato ${opts.orderCode}`);
  doc.setAuthor("Gigachip Ltda.");
  doc.setCreator("Plataforma Gigachip");
  doc.setLanguage("pt-BR");
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const logo = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"));
  const maxWidth = A4.w - MARGIN.x * 2;

  const drawText = (
    target: PDFPage,
    text: string,
    o: { x: number; y: number; width: number; size: number; lineGap: number; color: ReturnType<typeof rgb>; bold?: boolean },
  ): number => {
    const runs = parseRuns(text).map((r) => ({ ...r, bold: r.bold || !!o.bold }));
    const words = toWords(runs, fonts, o.size);
    const space = fonts.regular.widthOfTextAtSize(" ", o.size);
    let y = o.y;
    for (const line of wrap(words, o.width, space)) {
      let x = o.x;
      for (const w of line) {
        target.drawText(w.text, { x, y: y - o.size, size: o.size, font: w.bold ? fonts.bold : fonts.regular, color: o.color });
        x += w.width + (w.spaceAfter ? space : 0);
      }
      y -= o.size + o.lineGap;
    }
    return o.y - y; // altura usada
  };

  const linesOf = (text: string, size: number, width: number) =>
    wrap(toWords(parseRuns(text), fonts, size), width, fonts.regular.widthOfTextAtSize(" ", size)).length;

  // ---- 1ª página: faixa escura com a logo, título e dados do pedido
  const title = blocks.find((b) => b.type === "title")?.text ?? "CONTRATO";
  const meta = blocks.find((b) => b.type === "meta")?.text ?? "";
  const BAND = 118;
  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  page.drawRectangle({ x: 0, y: A4.h - BAND, width: A4.w, height: BAND, color: DARK });
  const LOGO = 86;
  page.drawImage(logo, { x: MARGIN.x - 8, y: A4.h - BAND + (BAND - LOGO) / 2, width: LOGO, height: LOGO });
  const tx = MARGIN.x + LOGO + 8;
  const tw = A4.w - MARGIN.x - tx;
  const titleH = linesOf(title, 15, tw) * 20;
  const blockH = titleH + 6 + 12;
  let ty = A4.h - (BAND - blockH) / 2;
  ty -= drawText(page, title, { x: tx, y: ty, width: tw, size: 15, lineGap: 5, color: rgb(1, 1, 1), bold: true });
  drawText(page, meta, { x: tx, y: ty - 6, width: tw, size: 9, lineGap: 3, color: ON_DARK_MUTED });
  gradientBar(page, 0, A4.h - BAND - 4, A4.w, 4);
  let y = A4.h - BAND - 34;

  const newPage = () => {
    page = doc.addPage([A4.w, A4.h]);
    gradientBar(page, 0, A4.h - 4, A4.w, 4);
    page.drawImage(logo, { x: A4.w - MARGIN.x - 28, y: A4.h - 44, width: 28, height: 28 });
    y = A4.h - MARGIN.top;
  };
  const ensure = (needed: number) => {
    if (y - needed < MARGIN.bottom) newPage();
  };

  const flow = (text: string, size: number, lineGap: number, color = INK, bold = false) => {
    const words = toWords(parseRuns(text).map((r) => ({ ...r, bold: r.bold || bold })), fonts, size);
    const space = fonts.regular.widthOfTextAtSize(" ", size);
    for (const line of wrap(words, maxWidth, space)) {
      ensure(size + lineGap);
      let x = MARGIN.x;
      for (const w of line) {
        page.drawText(w.text, { x, y: y - size, size, font: w.bold ? fonts.bold : fonts.regular, color });
        x += w.width + (w.spaceAfter ? space : 0);
      }
      y -= size + lineGap;
    }
  };

  for (const b of blocks) {
    switch (b.type) {
      case "title":
      case "meta":
        break; // já estão na faixa do topo
      case "heading":
        ensure(44); // não deixa título sozinho no fim da página
        y -= 10;
        // Marcador: uma bolinha azul da marca
        page.drawCircle({ x: MARGIN.x + 4, y: y - 7, size: 4, color: brandAt(0) });
        page.drawText(sanitize(b.text, fonts.bold), { x: MARGIN.x + 14, y: y - 11, size: 11.5, font: fonts.bold, color: INK });
        y -= 19;
        break;
      case "para":
        flow(b.text, 9.8, 4.2);
        y -= 5;
        break;
    }
  }

  // Rodapé, número de páginas e aviso de teste em todas as páginas
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    gradientBar(p, MARGIN.x, 46, A4.w - MARGIN.x * 2, 1);
    const footer = `Gigachip Ltda. · CNPJ 51.968.628/0001-16 · Pedido ${opts.orderCode}`;
    p.drawText(footer, { x: MARGIN.x, y: 32, size: 8, font: fonts.regular, color: MUTED });
    const num = `página ${i + 1} de ${pages.length}`;
    p.drawText(num, { x: A4.w - MARGIN.x - measure(num, fonts.regular, 8), y: 32, size: 8, font: fonts.regular, color: MUTED });
    if (opts.isTest) {
      p.drawText("VERSÃO DE TESTE — SEM VALIDADE", {
        x: 90,
        y: 230,
        size: 30,
        font: fonts.bold,
        color: rgb(0.85, 0.2, 0.2),
        opacity: 0.12,
        rotate: degrees(35),
      });
    }
  });

  const bytes = await doc.save();
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex"), pages: pages.length };
}
