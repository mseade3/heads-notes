import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Permanent_Marker } from "next/font/google";
import "./globals.css";

const headingFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700"]
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body"
});

const brandFont = Permanent_Marker({
  subsets: ["latin"],
  variable: "--font-brand",
  weight: "400"
});

export const metadata: Metadata = {
  title: "H.E.A.D.S. Core Notes",
  description: "Private executive board notes dashboard"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${headingFont.variable} ${bodyFont.variable} ${brandFont.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
