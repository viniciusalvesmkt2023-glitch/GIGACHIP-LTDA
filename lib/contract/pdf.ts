/**
 * Gera o PDF do contrato (A4) a partir dos blocos do modelo. Só JavaScript (pdf-lib), sem
 * arquivos de fonte externos — funciona igual no computador e na Vercel.
 */
import { createHash } from "node:crypto";
import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { Block } from "./template";

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = { x: 56, top: 64, bottom: 64 };
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.39, 0.45, 0.55);
const BRAND = rgb(0.05, 0.45, 0.56);

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

  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN.top;
  const maxWidth = A4.w - MARGIN.x * 2;

  const ensure = (needed: number) => {
    if (y - needed < MARGIN.bottom) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - MARGIN.top;
    }
  };

  const drawParagraph = (text: string, size: number, lineGap: number, color = INK, forceBold = false) => {
    const runs = parseRuns(text).map((r) => ({ ...r, bold: r.bold || forceBold }));
    const words = toWords(runs, fonts, size);
    const space = fonts.regular.widthOfTextAtSize(" ", size);
    const lineHeight = size + lineGap;
    for (const line of wrap(words, maxWidth, space)) {
      ensure(lineHeight);
      let x = MARGIN.x;
      for (const w of line) {
        page.drawText(w.text, { x, y: y - size, size, font: w.bold ? fonts.bold : fonts.regular, color });
        x += w.width + (w.spaceAfter ? space : 0);
      }
      y -= lineHeight;
    }
  };

  for (const b of blocks) {
    switch (b.type) {
      case "title":
        ensure(40);
        drawParagraph(b.text, 15, 6, BRAND, true);
        y -= 4;
        break;
      case "meta":
        drawParagraph(b.text, 9.5, 4, MUTED);
        y -= 10;
        break;
      case "heading":
        ensure(40); // não deixa título sozinho no fim da página
        y -= 8;
        drawParagraph(b.text, 11, 4, INK, true);
        y -= 2;
        break;
      case "para":
        drawParagraph(b.text, 9.8, 4.2);
        y -= 5;
        break;
    }
  }

  // Rodapé, número de páginas e aviso de teste em todas as páginas
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const footer = `Gigachip Ltda. · Pedido ${opts.orderCode} · página ${i + 1} de ${pages.length}`;
    p.drawText(footer, { x: MARGIN.x, y: 34, size: 8, font: fonts.regular, color: MUTED });
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
