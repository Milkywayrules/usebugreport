import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/spotlight/styles.css";
import { ColorSchemeScript } from "@mantine/core";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { MantineProviders } from "@/components/mantine-providers";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  description: "Bug reporting and session capture",
  title: "usebugreport",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={jetbrainsMono.variable} lang="en">
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body className={inter.className}>
        <MantineProviders>{children}</MantineProviders>
      </body>
    </html>
  );
}
