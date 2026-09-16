import powerDistributions from '../data/powerDistributions.json'

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const staticEntries = powerDistributions.map((entry) => ({
  ...entry,
  aliases: [
    entry.serviceID,
    entry.name,
    entry.description,
    entry.biller,
  ].map(normalize).filter(Boolean),
}))

const fallbackImageFor = (provider) => {
  const slug = String(provider || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')

  return slug ? `/images/providers/${slug}.webp` : ''
}

export const findPowerDistributionMeta = (provider) => {
  const key = normalize(provider)
  if (!key) return null

  return (
    staticEntries.find((entry) =>
      entry.aliases.some((alias) => alias === key || alias.includes(key) || key.includes(alias))
    ) || null
  )
}

export const enrichPowerCatalogItem = (item) => {
  const provider = item?.product?.provider || item?.name || item?.description
  const meta = findPowerDistributionMeta(provider)

  return {
    ...item,
    name: meta?.name || item?.product?.provider || item?.name || 'Electricity',
    description:
      meta?.description || item?.product?.description || item?.description || 'Electricity payment',
    image: meta?.image || fallbackImageFor(provider),
    biller: meta?.biller || provider,
    serviceID: meta?.serviceID || provider,
  }
}
