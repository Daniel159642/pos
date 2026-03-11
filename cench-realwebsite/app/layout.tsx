import type { Metadata } from "next";
import { Geist, Geist_Mono, EB_Garamond } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

import { TransitionProvider } from "./TransitionContext";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  metadataBase: new URL("https://swftly.com"),
  title: "Swftly | The Agentic POS",
  description: "The all-in-one software suite that automates your retail or restaurant business with AI-driven insights.",
  openGraph: {
    title: "Swftly | The Agentic POS",
    description: "The all-in-one software suite that automates your retail or restaurant business with AI-driven insights.",
    url: "https://swftly.com",
    siteName: "Swftly",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Swftly | The Agentic POS",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Swftly | The Agentic POS",
    description: "The all-in-one software suite that automates your retail or restaurant business with AI-driven insights.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=2", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico?v=2",
    apple: [
      { url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg?v=2",
        color: "#2c19fc",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,600,700&f[]=tanker@400&f[]=satoshi@400,500,700&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${ebGaramond.variable} antialiased`}
        suppressHydrationWarning
      >
        <TransitionProvider>
          {children}
        </TransitionProvider>
        <Analytics />
      </body>
    </html>
  );
}
