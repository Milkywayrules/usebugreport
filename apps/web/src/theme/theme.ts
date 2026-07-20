import { createTheme, type MantineColorsTuple } from "@mantine/core";

/** DESIGN.md accent #7C5CFC — brand violet scale for Mantine primaryColor. */
const brand: MantineColorsTuple = [
  "#f3f0ff",
  "#e5dbff",
  "#d0bfff",
  "#b197fc",
  "#9775fa",
  "#9178FF",
  "#7C5CFC",
  "#6b4ce0",
  "#5a3ec4",
  "#4a33a8",
];

/** Dark surfaces from DESIGN.md — surface-base through overlay. */
const darkSurfaces: MantineColorsTuple = [
  "#C1C2C5",
  "#A6A7AB",
  "#8B8B96",
  "#5C5C66",
  "#1A1A1F",
  "#141417",
  "#0C0C0E",
  "#08080A",
  "#060608",
  "#030304",
];

export const theme = createTheme({
  colors: {
    brand,
    dark: darkSurfaces,
  },
  defaultRadius: "sm",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
  fontFamilyMonospace:
    "JetBrains Mono, ui-monospace, SFMono-Regular, monospace",
  headings: {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    fontWeight: "600",
  },
  other: {
    appShellHeaderHeight: 48,
    densityRowHeight: 36,
    sidebarCollapsedWidth: 52,
    sidebarWidth: 240,
  },
  primaryColor: "brand",
});
