import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: "https://global-pv-fire-watch.pezzi.chatgpt.site/sitemap.xml",
  };
}
