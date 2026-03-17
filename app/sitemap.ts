import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  // Aici pui domeniul tău real
  const baseUrl = 'https://www.ghibaplus.vercel.app' 

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/dashboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ]
}