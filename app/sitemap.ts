import type { MetadataRoute } from "next";

const base = "https://global-pv-fire-watch.pezzi.chatgpt.site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/methodology`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/data-policy`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/corrections`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
