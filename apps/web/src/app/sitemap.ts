import type { MetadataRoute } from "next";

const BASE = "https://ecom.noraapp.es";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/como-funciona", "/consultores", "/solicitar"].map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.8,
  }));
}
