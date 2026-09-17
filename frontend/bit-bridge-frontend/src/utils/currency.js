export const nairaToCents = (value) => {
  const normalized = String(value ?? '').replace(/,/g, '').trim()
  if (!normalized || !/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const cents = Math.round(Number(normalized) * 100)
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}
