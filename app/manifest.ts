import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ACLimb",
    short_name: "ACLimb",
    description: "A gentle companion for following your physiotherapy plan.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4eb",
    theme_color: "#315c4c",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
