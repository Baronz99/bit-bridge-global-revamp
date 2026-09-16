const truthy = (value) => String(value || '').trim().toLowerCase() === 'true'
export const isInvestorSandbox = truthy(import.meta.env.VITE_INVESTOR_SANDBOX)
export const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || '').trim()
export const assertSandboxApiConfiguration = () => {
  if (isInvestorSandbox && (!configuredApiBase || !/^https:\/\//i.test(configuredApiBase))) {
    throw new Error('Investor sandbox requires a valid HTTPS VITE_API_BASE_URL.')
  }
}
