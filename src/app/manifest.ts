import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Buscador de ofertas",
    short_name: "Ofertas",
    description: "Encuentra ofertas de trabajo según tu CV. Tus datos se quedan en tu navegador.",
    lang: "es",
    start_url: "/",
    display: "standalone",
    background_color: "#12141d",
    theme_color: "#12141d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
