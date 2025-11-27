const statusStyle = (style) => {
  const props = {
    declined: ' border-red-500 text-red-700 bg-red-100/30',
    approved: ' border-green-500 text-green-700 bg-green-100/30',
    pending: 'border-orange-500 text-orange-700 bg-orange-100/30',
  }

  return props[style]
}
export default statusStyle
