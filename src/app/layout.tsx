import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShell } from '@/components/layout/AppShell';
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Stock & Mutual Fund Analyzer - Free Trading Analysis",
    description: "Professional stock and mutual fund analysis with technical indicators, candlestick patterns, and AI-powered recommendations. 100% free, no API keys required.",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className={inter.className}>
                <AppShell>{children}</AppShell>
            </body>
        </html>
    );
}
