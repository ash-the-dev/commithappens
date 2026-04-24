import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/app/providers";
import { SiteJsonLd } from "@/components/seo/SiteJsonLd";
import { getSitemapBaseUrl } from "@/lib/app-url";
import { DEFAULT_DESCRIPTION, SITE_NAME_DISPLAY, defaultKeywords } from "@/lib/seo/site-metadata";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function metadataBaseUrl(): URL {
  return new URL(getSitemapBaseUrl());
}

const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
  title: {
    default: `${SITE_NAME_DISPLAY} — website & deploy health`,
    template: `%s · ${SITE_NAME_DISPLAY}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: defaultKeywords,
  applicationName: SITE_NAME_DISPLAY,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    siteName: SITE_NAME_DISPLAY,
    type: "website",
    locale: "en_US",
    title: `${SITE_NAME_DISPLAY} — website & deploy health`,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: "/brand/commit-happens.png",
        width: 1200,
        height: 630,
        alt: "Commit Happens",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME_DISPLAY} — website & deploy health`,
    description: DEFAULT_DESCRIPTION,
    images: ["/brand/commit-happens.png"],
  },
  ...(googleVerification
    ? { verification: { google: googleVerification } }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SiteJsonLd />
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
