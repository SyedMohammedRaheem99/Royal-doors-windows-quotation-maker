import type { Metadata, Viewport } from "next";
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
  title: "Royal Doors and Windows — Quotation Maker",
  description: "Quotations and GST tax invoices for uPVC, aluminium and WPC doors and windows.",
};

/**
 * Without this the shared quotation link rendered its 210mm document into a
 * 794px layout viewport on a 390px phone: the Rate, Amount and Grand Total
 * columns sat off-screen entirely, so a customer opening a WhatsApp link saw
 * the descriptions and none of the prices.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
