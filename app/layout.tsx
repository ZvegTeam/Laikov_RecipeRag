import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@mantine/core/styles.css";
import { ColorSchemeScript, MantineProvider, createTheme } from "@mantine/core";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Mantine theme customization
const theme = createTheme({
  /** Primary color scheme */
  primaryColor: "blue",
  /** Default font family */
  fontFamily: inter.style.fontFamily,
  /** Default font size */
  defaultRadius: "md",
  /** Breakpoints for mobile-first responsive design */
  breakpoints: {
    xs: "320px", // Extra small devices (small phones)
    sm: "375px", // Small devices (phones)
    md: "414px", // Medium devices (large phones)
    lg: "768px", // Large devices (tablets)
    xl: "1024px", // Extra large devices (desktops)
    "2xl": "1280px", // 2X Extra large devices (large desktops)
  },
  /** Headings configuration with responsive sizes */
  headings: {
    fontFamily: inter.style.fontFamily,
    sizes: {
      h1: { fontSize: "2.5rem", lineHeight: "1.2", fontWeight: "700" },
      h2: { fontSize: "2rem", lineHeight: "1.3", fontWeight: "600" },
      h3: { fontSize: "1.5rem", lineHeight: "1.4", fontWeight: "600" },
    },
  },
  /** Color scheme configuration */
  colors: {
    blue: [
      "#e7f5ff",
      "#d0ebff",
      "#a5d8ff",
      "#74c0fc",
      "#4dabf7",
      "#339af0",
      "#228be6",
      "#1c7ed6",
      "#1971c2",
      "#1864ab",
    ],
  },
  /** Spacing scale */
  spacing: {
    xs: "0.5rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },
});

export const metadata: Metadata = {
  title: "Recipe Search - RAG AI",
  description: "Find recipes based on ingredients using AI-powered search",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body className={inter.className}>
        <MantineProvider theme={theme} defaultColorScheme="dark">
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
