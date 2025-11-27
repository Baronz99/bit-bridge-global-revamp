const generateRequestId = () => {
  const dt = new Date()

  const id = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, 0)}${String(dt.getDate()).padStart(2, 0)}${String(dt.getHours(2, 0)).padStart(2, 0)}${String(dt.getMinutes()).padStart(2, 0)}${dt.getMilliseconds()}bbg`
  return id
}

export default generateRequestId
