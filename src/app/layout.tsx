import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import { AppShell } from '@/components/layout/AppShell';
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ['300', '400', '500', '600'],
  variable: '--font-dm-sans',
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
});

export const metadata: Metadata = {
  title: "Investor OS — Indian Stock Intelligence",
  description: "Professional stock market analysis for Indian equities. NSE, BSE, AMFI data with Zerodha integration and autonomous trading.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${dmMono.variable} ${dmSans.className}`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
