import type { Metadata } from "next";
import { JetBrains_Mono, Source_Sans_3, Zilla_Slab } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const zilla = Zilla_Slab({ variable: "--font-zilla-slab", subsets: ["latin"], weight: ["500", "700"] });
const sourceSans = Source_Sans_3({ variable: "--font-source-sans", subsets: ["latin"], weight: ["400", "600", "700"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["400", "600"] });

export const metadata: Metadata = {
  // Makes relative links in metadata (canonical, social card images) absolute.
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { type: "website", siteName: SITE_NAME, title: SITE_NAME, description: SITE_DESCRIPTION, url: "/", locale: "en_US" },
  twitter: { card: "summary", title: SITE_NAME, description: SITE_DESCRIPTION },
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
