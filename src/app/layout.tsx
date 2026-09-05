import type { Metadata } from "next";
import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import SidebarNav from "@/components/SidebarNav";
import TopBar from "@/components/TopBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RecoverAI — Revenue Intelligence",
  description: "Enterprise revenue recovery platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        {/* Animated background mesh — sits behind everything */}
        <div className="app-bg-mesh" />

        <div className="app-shell">
          {/* Fixed left sidebar */}
          <SidebarNav />

          {/* Right: topbar + scrollable page content */}
          <div className="main-area">
            <TopBar />
            <div className="page-content">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
