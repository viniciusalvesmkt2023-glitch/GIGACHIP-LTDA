import type { Metadata } from "next";
import { Chakra_Petch, Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Fonte "tecnológica" parecida com a da logo, só para títulos curtos e números
const display = Chakra_Petch({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
});

// Títulos grandes, fortes e "apertados" (estilo dos sites de referência)
const heading = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Gigachip", template: "%s | Gigachip" },
  description: "Contrate sua linha móvel na rede Vivo com a Gigachip, de forma 100% online.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${heading.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
