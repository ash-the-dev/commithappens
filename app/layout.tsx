import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/app/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Canonical origin for metadata / OG URLs: env first, then Vercel, then local. */
function metadataBaseUrl(): URL {
  const explicit = process.env.NEXTAUTH_URL?.trim();
  if (explicit) {
    return new URL(explicit.endsWith("/") ? explicit.slice(0, -1) : explicit);
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return new URL(`https://${host}`);
  }
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
  title: {
    default: "CommitHappens.com",
    template: "%s · commithappens.com",
  },
  description:
    "You shipped code. We tell you what happened after, in plain English.",
  openGraph: {
    siteName: "commithappens.com",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
