import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ConfigScript } from "@/components/ConfigScript";
import IconStylesheet from "@/components/IconStylesheet";

export const metadata: Metadata = {
  title: "Convo - Team Collaboration Platform",
  description: "Convo web application - migrated to Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <IconStylesheet />
        <ConfigScript />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
