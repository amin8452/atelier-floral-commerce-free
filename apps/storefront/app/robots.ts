import type { MetadataRoute } from "next";
import { appConfig } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin/", "/backend/"] },
    ],
    sitemap: appConfig.appUrl + "/sitemap.xml",
    host: appConfig.appUrl,
  };
}
