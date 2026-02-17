import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import AppModal from '../../components/modal/Modal'
import AccountCreationWizard from '../../components/accountCreationWizard/AccountCreationWizard'
import AccountNumbers from '../../components/accountComponents/AccountComponents'
import { getAccounts, getUserAccount } from '../../redux/actions/account'
import { needsTier2Access, withTier2MissingDetails } from '../../utils/kycGate'

const VirtualAccounts = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const { user } = useSelector((state) => state.auth)
  const { accounts } = useSelector((state) => state.account)

  const [isAnchorModal, setIsAnchorModal] = useState(false)
  const [current, setCurrent] = useState(0)
  const [formData, setFormData] = useState({})
  const [visibleAccounts, setVisibleAccounts] = useState({})

  useEffect(() => {
    dispatch(getUserAccount())
    dispatch(getAccounts())
  }, [dispatch])

  const handleGenerate = (vendor, data = {}) => {
    if (vendor === 'monnify' || vendor === 'moniepoint') {
      toast.info('New Monnify/Moniepoint account creation is currently disabled.', {
        position: 'top-right',
        autoClose: 4000,
        pauseOnHover: true,
      })
      return
    }
    if (vendor !== 'anchor') {
      toast.info('Only Anchor account creation is currently enabled.', {
        position: 'top-right',
        autoClose: 4000,
        pauseOnHover: true,
      })
      return
    }

    if (needsTier2Access(user)) {
      toast.info(withTier2MissingDetails(user, 'Complete Tier 2 verification to generate an Anchor account.'), {
        position: 'top-right',
        autoClose: 4000,
        pauseOnHover: true,
      })
      navigate('/dashboard/kyc')
      return
    }

    const hasAnchorRecord = String(data?.vendor || '').toLowerCase() === 'anchor'
    const anchorStatus = String(data?.status || '').toLowerCase()
    const isAnchorKycVerified = ['verified', 'completed'].includes(anchorStatus)
    const requiresProvisionOnly = hasAnchorRecord && isAnchorKycVerified && !data?.account_number
    setFormData(data)
    setCurrent(data?.account_number ? 3 : requiresProvisionOnly ? 0 : hasAnchorRecord ? 1 : 0)
    setIsAnchorModal(true)
  }

  const maskAccountNumber = (num) => {
    if (!num) return ''
    return num.replace(/\d(?=\d{4})/g, '*')
  }

  const toggleAccountVisibility = (id) => {
    setVisibleAccounts((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const copyToClipboard = async (value) => {
    if (!value) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = value
        textarea.setAttribute('readonly', 'true')
        textarea.style.position = 'absolute'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      toast.success('Account number copied')
    } catch {
      toast.error('Unable to copy account number')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-5xl mx-auto relative">
        <div className="absolute -top-24 -right-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />

        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-8 shadow-[0_30px_60px_rgba(15,23,42,0.45)]">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-500/15 blur-2xl" />
          <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-200/80 mb-2">
            Virtual accounts
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold">
            Bank accounts for transfers
          </h2>
          <p className="mt-2 text-sm text-slate-300 max-w-2xl">
            Generate Anchor virtual accounts to receive NGN transfers directly into your BitBridge wallet.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-slate-500">Accounts live</p>
              <p className="text-lg font-semibold text-emerald-300">{accounts?.length || 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-slate-500">Primary wallet</p>
              <p className="text-lg font-semibold text-slate-100">NGN</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-slate-500">Copy-friendly</p>
              <p className="text-lg font-semibold text-slate-100">Instant</p>
            </div>
          </div>
        </section>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 lg:p-6">
          <AccountNumbers accounts={accounts} generate={handleGenerate} showView={false} />
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Your virtual accounts</h3>
              <p className="text-xs text-slate-400">Tap to reveal or copy account numbers.</p>
            </div>
          </div>

          {accounts?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map((account) => {
                const isVisible = Boolean(visibleAccounts[account.id])
                const accountNumber = account?.account_number
                return (
                  <div
                    key={account.id}
                    className="group rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.3)]"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          {account?.bank_name || account?.vendor || 'Bank'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {account?.account_name || 'Account holder'}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                        {account?.vendor || 'bank'}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-base font-semibold text-slate-100">
                        {isVisible ? accountNumber : maskAccountNumber(accountNumber)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleAccountVisibility(account.id)}
                          className="text-xs text-slate-300 hover:text-white"
                        >
                          {isVisible ? 'Hide' : 'Show'}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(accountNumber)}
                          className="text-xs text-slate-300 hover:text-white"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No virtual accounts yet.</p>
          )}
        </div>
      </div>

      <AppModal
        title={'Generate Account'}
        isModalOpen={isAnchorModal}
        handleCancel={() => setIsAnchorModal((prev) => !prev)}
      >
        <AccountCreationWizard
          setFormData={setFormData}
          formData={formData}
          current={current}
          setCurrent={setCurrent}
          setIsAncorModal={setIsAnchorModal}
          user={user}
        />
      </AppModal>
    </div>
  )
}

export default VirtualAccounts

