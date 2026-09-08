import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Splash, Toaster } from "@/components/ui";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });

export const metadata: Metadata = {
  title: { default: "LYNKZ — Connect. Share. Discover.", template: "%s · LYNKZ" },
  description:
    "Share your world, discover new people, join conversations and create connections that actually matter.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "LYNKZ", statusBarStyle: "black-translucent" },
  icons: {
    icon: "/icons/icon-512.png",
    apple: "/icons/icon-512.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#07070e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${space.variable} antialiased`}>
        <Splash />
        {children}
        <Toaster />
        <Script id="sw-reg" strategy="afterInteractive">
          {`if ("serviceWorker" in navigator) { window.addEventListener("load", function(){ navigator.serviceWorker.register("/sw.js").catch(function(){}); }); }`}
        </Script>
      </body>
    </html>
  );
}
