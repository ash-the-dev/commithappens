import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/app/providers";
import { SiteJsonLd } from "@/components/seo/SiteJsonLd";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getPublicOrigin } from "@/lib/public-origin";
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
  return new URL(getPublicOrigin());
}

const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const googleAnalyticsId = "G-TFJWYTYBG6";
const brandAssetVersion = "20260425";
const ogImage = `/opengraph-image.png?v=${brandAssetVersion}`;
const twitterImage = `/twitter-image.png?v=${brandAssetVersion}`;

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
  title: {
    default: `${SITE_NAME_DISPLAY} — website & deploy health`,
    template: `%s · ${SITE_NAME_DISPLAY}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: defaultKeywords,
  applicationName: SITE_NAME_DISPLAY,
  icons: {
    icon: [
      { url: `/favicon.ico?v=${brandAssetVersion}`, sizes: "32x32" },
      { url: `/icon.png?v=${brandAssetVersion}`, type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: `/apple-icon.png?v=${brandAssetVersion}`, type: "image/png", sizes: "180x180" }],
  },
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
        url: ogImage,
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
    images: [twitterImage],
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
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
          strategy="beforeInteractive"
        />
        <Script id="google-analytics" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            window.gtag = function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${googleAnalyticsId}');
          `}
        </Script>
        <SiteJsonLd />
        <Providers>{children}</Providers>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
