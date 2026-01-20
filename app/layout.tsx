import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ConfigScript } from "@/components/ConfigScript";
import IconStylesheet from "@/components/IconStylesheet";
import Script from "next/script";

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
        {/* External integration scripts (1:1 with Angular index.html) */}
        <Script
          id="dropboxjs"
          src="https://www.dropbox.com/static/api/2/dropins.js"
          data-app-key="x8f0l9urspe5wzi"
          strategy="afterInteractive"
        />
        <Script src="https://app.box.com/js/static/select.js" strategy="afterInteractive" />
        <Script src="https://apis.google.com/js/api.js" strategy="afterInteractive" />
        {/* Google Maps API for geocoding (location feature) - matches Angular index.php */}
        <Script 
          src="https://maps.googleapis.com/maps/api/js?key=AIzaSyC764tr6nZnnVR0no-hgsiqCHGQHmaNrQU&libraries=places"
          strategy="afterInteractive"
        />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
