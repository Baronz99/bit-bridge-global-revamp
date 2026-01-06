export const pickLogo = (provider = '') => {
  const key = provider.toString().toLowerCase().replace(/[\s-_]/g, '')

  if (key.includes('mtn')) return '/images/providers/mtn-nigeria.webp'
  if (key.includes('glo')) return '/images/providers/glo-mobile-bundles-nigeria.webp'
  if (key.includes('airtel')) return '/images/providers/airtel-data-nigeria.webp'
  if (key.includes('ntel')) return '/images/providers/ntel-nigeria.webp'
  if (key.includes('9mobile') || key.includes('9mobil') || key.includes('etisalat'))
    return '/images/providers/9mobile-etisalat-data-nigeria.webp'

  if (key.includes('dstv')) return '/images/providers/dstv.webp'
  if (key.includes('gotv')) return '/images/providers/gotv.webp'
  if (key.includes('startimes')) return '/images/providers/startimes.webp'

  return '/images/providers/mobile.png'
}
