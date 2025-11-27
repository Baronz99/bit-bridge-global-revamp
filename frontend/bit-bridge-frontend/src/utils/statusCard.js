const statusStyleCard = (style) => {
  const props = {
    declined: ' border-red-900 text-red-700 bg-red-100/10',
    completed: ' border-green-900 text-green-700 bg-green-100/10',
    approved: ' border-green-900 text-green-700 bg-green-100/10',
    initialized: 'border-orange-900 text-orange-700 bg-orange-100/10',
    pending: 'border-orange-900 text-orange-700 bg-orange-100/10',
  }

  return props[style]
}
export default statusStyleCard
