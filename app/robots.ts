import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/'], // Nu vrem ca Google sa caute în panoul de admin
    },
    // Schimbă cu domeniul tău
    sitemap: 'https://ghibaplus.ro/sitemap.xml', 
  }
}