const STORAGE_KEY = 'bitbridge:signup_intent'

const safeParse = (value) => {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export const loadSignupIntentSession = () => {
  try {
    return safeParse(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

export const saveSignupIntentSession = (value) => {
  try {
    if (!value) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // no-op
  }
}

export const clearSignupIntentSession = () => saveSignupIntentSession(null)

