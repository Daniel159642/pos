import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { TransitionProvider } from "./TransitionContext";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "Swftly | Advanced POS Hub",
  description: "The all-in-one software suite that automates your retail or restaurant business with AI-driven insights.",
  openGraph: {
    title: "Swftly | Advanced POS Hub",
    description: "The all-in-one software suite that automates your retail or restaurant business with AI-driven insights.",
    url: "https://swftly.com",
    siteName: "Swftly",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Swftly | Advanced POS Hub",
    description: "The all-in-one software suite that automates your retail or restaurant business with AI-driven insights.",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
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
