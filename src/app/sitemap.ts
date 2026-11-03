import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE = 'https://gocart.app'

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/sell`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/ride`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/refunds`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ]

  try {
    const supabase = createClient()
    const { data: areas } = await supabase
      .from('areas')
      .select('name, status')
      .eq('status', 'active')

    const areaPages: MetadataRoute.Sitemap = (areas ?? []).map(a => ({
      url: `${BASE}/delivery/${toSlug(a.name)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

    return [...staticPages, ...areaPages]
  } catch {
    return staticPages
  }
}
