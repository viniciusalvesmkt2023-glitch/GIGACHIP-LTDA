// Copia os arquivos do leitor de texto (OCR) para public/ocr, para o site não depender de CDN externo.
// Roda sozinho antes do "dev" e do "build" (scripts predev/prebuild). Pasta ignorada pelo git.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = (p) => join(root, "node_modules", p);
const out = (p) => join(root, "public", "ocr", p);

const files = [
  [nm("tesseract.js/dist/worker.min.js"), out("worker.min.js")],
  // Variantes LSTM do motor (o navegador escolhe a mais rápida que suportar)
  [nm("tesseract.js-core/tesseract-core-lstm.wasm.js"), out("core/tesseract-core-lstm.wasm.js")],
  [nm("tesseract.js-core/tesseract-core-simd-lstm.wasm.js"), out("core/tesseract-core-simd-lstm.wasm.js")],
  [nm("tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js"), out("core/tesseract-core-relaxedsimd-lstm.wasm.js")],
  // Idioma: modelo LSTM compacto (números e letras latinas bastam para o *#06#)
  [nm("@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz"), out("lang/eng.traineddata.gz")],
];

for (const [from, to] of files) {
  if (!existsSync(from)) throw new Error(`arquivo do OCR não encontrado: ${from}`);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
}
console.log(`OCR: ${files.length} arquivos copiados para public/ocr`);
