import type { Metadata } from "next";
import "./globals.css";
import GlobalProvider from "@/providers/GlobalProvider";

export const metadata: Metadata = {
  title: "Flesh and Spirit",
  description: "Flesh and Spirit Game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <GlobalProvider>{children}</GlobalProvider>
      </body>
    </html>
  );
}
