import localFont from "next/font/local";

export const jakarta = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
      weight: "200 800",
    },
    {
      path: "../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-ext-wght-normal.woff2",
      weight: "200 800",
    },
  ],
  display: "swap",
  variable: "--font-jakarta",
});

export const inter = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
      weight: "100 900",
    },
    {
      path: "../../node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2",
      weight: "100 900",
    },
  ],
  display: "swap",
  variable: "--font-inter",
});
