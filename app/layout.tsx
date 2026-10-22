import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Doto, Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/app/providers";
import { textSizeScript } from "@/components/a11y/text-size-toggle";
import "./globals.css";

// Type system: Bricolage for headings, Geist for UI text, Geist Mono for labels/data,
// Doto (a dot-matrix face) reserved for headline figures and the wordmark.
const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });
const dot = Doto({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-dot" });

export const metadata: Metadata = {
  title: { default: "Nexus", template: "%s · Nexus" },
  description: "Track projects, budgets and progress in one place.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f17" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // next-themes sets the class before hydration; suppress the expected mismatch.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: textSizeScript }} />
      </head>
      <body className={`${sans.variable} ${mono.variable} ${display.variable} ${dot.variable} min-h-dvh font-sans`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
