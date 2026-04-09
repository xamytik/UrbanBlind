import type { Metadata, Viewport } from "next";
import { Inter, Roboto_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import ClientProtection from "./ClientProtection";

// Основной UI шрифт (безопасный аналог Geist)
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-sans", // Связываем с tailwind.config
});

// Моноширинный шрифт для данных/цифр (безопасный аналог Geist Mono)
const robotoMono = Roboto_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-mono",
});

// Заголовочный шрифт
const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  variable: "--font-playfair-display", // Связываем с tailwind.config
});

export const viewport: Viewport = {
  themeColor: "#10B981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Запрет зума важен для нативных PWA интерфейсов
};

export const metadata: Metadata = {
  title: "Urban-Blind: Доступная Казань",
  description: "Система навигации для людей с ограниченной мобильностью",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Urban-Blind",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${inter.variable} ${robotoMono.variable} ${playfair.variable} font-sans`}
      >
        <ClientProtection />
        {children}
      </body>
    </html>
  );
}
