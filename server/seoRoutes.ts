import type { Express, Request, Response } from "express";
import { listCountries } from "../shared/countryData";

function siteBase(req: Request) {
  const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol ?? "https";
  const host = (req.headers["x-forwarded-host"] as string) ?? req.headers.host ?? "localhost";
  return `${proto.split(",")[0]}://${host.split(",")[0]}`;
}

export function registerSeoRoutes(app: Express) {
  app.get("/robots.txt", (req: Request, res: Response) => {
    const base = siteBase(req);
    res.type("text/plain").send(
      ["User-agent: *", "Allow: /", "Disallow: /api/", "", `Sitemap: ${base}/sitemap.xml`, ""].join("\n"),
    );
  });

  app.get("/sitemap.xml", (req: Request, res: Response) => {
    const base = siteBase(req);
    const now = new Date().toISOString().slice(0, 10);
    const pages: Array<[string, string, string]> = [
      ["/", "daily", "1.0"],
      ["/methodology", "monthly", "0.7"],
      ["/data-policy", "monthly", "0.6"],
      ["/corrections", "monthly", "0.6"],
      ...listCountries().map((item): [string, string, string] => [`/country/${item.slug}`, "weekly", "0.8"]),
    ];
    const body = pages
      .map(
        ([path, freq, priority]) =>
          `  <url><loc>${base}${path}</loc><lastmod>${now}</lastmod><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`,
      )
      .join("\n");
    res
      .type("application/xml")
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  });
}
