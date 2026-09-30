import type { Metadata } from "next";
import { JetBrains_Mono, Source_Sans_3, Zilla_Slab } from "next/font/google";
import "./globals.css";

const zilla = Zilla_Slab({ variable: "--font-zilla-slab", subsets: ["latin"], weight: ["500", "700"] });
const sourceSans = Source_Sans_3({ variable: "--font-source-sans", subsets: ["latin"], weight: ["400", "600", "700"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["400", "600"] });

export const metadata: Metadata = {
  title: { default: "Trailnotes", template: "%s · Trailnotes" },
  description: "Photo-by-photo hiking guides: every turn, viewpoint, water source and bail-out on the map.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${zilla.variable} ${sourceSans.variable} ${mono.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col bg-paper">
        {children}
      </body>
    </html>
  );
}
