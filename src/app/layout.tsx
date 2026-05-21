import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "H.E.A.D.S. Core Notes",
  description: "Private executive board notes dashboard"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}
