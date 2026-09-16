import { useCallback } from 'react'

const AccountNumbers = ({ accounts, anchorAccount, generate, onView, showView = true }) => {
  const getAccountName = useCallback((account) => {
    if (account === 'anchor') return 'Anchor'
    return 'Anchor'
  }, [])

  const resolvedAnchorAccount =
    anchorAccount || (accounts || []).find((entry) => String(entry?.vendor || '').toLowerCase() === 'anchor') || null
  const hasAnchorRecord = Boolean(resolvedAnchorAccount)
  const hasAccountNumber = Boolean(resolvedAnchorAccount?.account_number)

  return (
    <div className="flex justify-between w-full my-4 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg p-6">
      <div className="w-full">
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-6">
          <div className="border border-slate-800 bg-slate-950/70 text-center rounded-xl py-3 shadow-sm hover:shadow-md transition-all">
            <h3 className="text-slate-100 font-medium text-lg mb-2">
              {getAccountName('anchor')}
            </h3>

            {hasAnchorRecord && hasAccountNumber ? (
              <>
                <p className="text-xs font-bold text-alt tracking-wider">
                  {resolvedAnchorAccount.account_name}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Bank: {resolvedAnchorAccount?.bank_name || 'Anchor'}
                </p>

                {showView && onView ? (
                  <button
                    onClick={() => onView(0, resolvedAnchorAccount)}
                    className="text-sm text-slate-100 mt-1 hover:text-alt"
                  >
                    View
                  </button>
                ) : null}
              </>
            ) : hasAnchorRecord ? (
              <button
                onClick={() => generate('anchor', resolvedAnchorAccount)}
                className="text-slate-400 text-base font-normal hover:text-alt italic"
              >
                Continue setup
              </button>
            ) : (
              <button
                onClick={() => generate('anchor')}
                className="text-slate-400 text-base font-normal hover:text-alt italic"
              >
                Create account
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccountNumbers
