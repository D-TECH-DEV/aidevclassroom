import type { MetadataRoute } from "next";

import { recupereSiteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = recupereSiteUrl();
  const maintenant = new Date();
  return [
    {
      url: `${baseUrl}/`,
      lastModified: maintenant,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/llms.txt`,
      lastModified: maintenant,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];
}
