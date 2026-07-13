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

export const metadata: Metadata = {
  metadataBase: new URL("https://global-pv-fire-watch.pezzi.chatgpt.site"),
  title: {
    default: "Global PV Fire Watch",
    template: "%s · Global PV Fire Watch",
  },
  description: "Source-backed global intelligence on rooftop and utility-scale photovoltaic fire incidents.",
  applicationName: "Global PV Fire Watch",
  creator: "Global PV Fire Watch",
  publisher: "Global PV Fire Watch",
  keywords: ["photovoltaic fire", "solar panel fire", "solar farm fire", "PV fire incidents", "fire safety data"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Global PV Fire Watch",
    title: "Global PV Fire Watch",
    description: "A transparent public-source reporting index for rooftop and solar-farm fire incidents worldwide.",
  },
  twitter: {
    card: "summary",
    title: "Global PV Fire Watch",
    description: "Public-source reporting coverage for rooftop and solar-farm fire incidents worldwide.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
