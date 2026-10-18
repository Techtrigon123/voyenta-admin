import type { MetadataRoute } from "next";

/** Name and icon when the portal is installed or pinned to the taskbar / home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vouchlio Admin",
    short_name: "Vouchlio Admin",
    description: "The Vouchlio team portal — staff sign-in only.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#e63946",
    icons: [{ src: "/brand/vouchlio-mark.png", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
