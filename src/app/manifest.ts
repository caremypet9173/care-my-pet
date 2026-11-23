import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Care My Pet — Cyfrowa kartoteka zdrowia",
    short_name: "Care My Pet",
    description:
      "Twoja domowa kartoteka zdrowia psa i kota: badania, terminarz, leki i historia leczenia.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f6f1",
    theme_color: "#1d4a40",
    orientation: "portrait",
    categories: ["medical", "lifestyle", "utilities"],
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
