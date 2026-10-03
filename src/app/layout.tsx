import type { Metadata } from "next";
import {
  Playfair_Display,
  DM_Sans,
  Newsreader,
  Cormorant_Garamond,
  Jost,
  Mrs_Saint_Delafield,
} from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Hero display serif + product-card title/price (reference card design);
// scoped per-block in globals.css via --font-newsreader.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Gallery-only serif + sans (reference design fidelity); scoped to
// .girah-gallery in globals.css via --font-cormorant / --font-jost.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

// Footer newsletter script heading (reference footer design); scoped to
// .girah-footer in globals.css via --font-mrs-saint.
const mrsSaint = Mrs_Saint_Delafield({
  variable: "--font-mrs-saint",
  subsets: ["latin"],
  weight: ["400"],
});

// Phase 17: one canonical origin for metadata (canonical URLs, sitemap,
// robots, OG links). NEXT_PUBLIC_* is baked into client bundles at build;
// server-side reads see the runtime env — both agree because the deploy
// build runs with the production .env.
const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Girah — Handmade Crochet",
    template: "%s · Girah",
  },
  description: "Handmade pieces, made to be cherished.",
  applicationName: "Girah",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Girah",
    locale: "en_PK",
    // Real brand asset from /public (portrait source crops acceptably in
    // link unfurlers); relative URL resolves via metadataBase.
    images: [{ url: "/florals/sunflower.png", width: 1031, height: 1318, alt: "Crochet sunflower bouquet" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/florals/sunflower.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} ${newsreader.variable} ${cormorant.variable} ${jost.variable} ${mrsSaint.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
