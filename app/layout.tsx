"use client";

import { useEffect } from "react";
import { JetBrains_Mono, Outfit } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { GoogleMapsProvider } from "@/components/providers/GoogleMapsProvider";
import { useAuthStore } from "@/store/authStore";
import "@/styles/globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body>
        <GoogleMapsProvider>
          <div className="site-root">
            <Navbar />
            <main>{children}</main>
            <Footer />
          </div>
        </GoogleMapsProvider>
      </body>
    </html>
  );
}
