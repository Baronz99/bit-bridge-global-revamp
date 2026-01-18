import { useCallback } from 'react'

const AccountNumbers = ({ accounts, generate, onView, showView = true }) => {
  //   const [accounts, setAccounts] = useState({
  //     savings: null,
  //     investment: null,
  //   })

  const getAccountName = useCallback((account) => {
    if (account === 'anchor') return 'Anchor'
    return 'Anchor'
  }, [])

  const accountVendors = ['anchor']
  //   const isVenorAnchor = accounts.some((acc) => acc.vendor === 'anchor')

  const filteredAccounts = (accounts || []).filter((e) => e.vendor === 'anchor')
  const accountNonexisting = accountVendors.filter((acc) => !filteredAccounts.some((e) => e.vendor == acc))
  const accountexisting = accountVendors.filter((acc) => filteredAccounts.some((e) => e.vendor == acc))

  return (
    <div className="flex justify-between w-full my-4 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg p-6">
      <div className="w-full">
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-6">
          {/* Savings Account */}
          {Array.from({ length: accountVendors.length }).map((_, i) => {
            const useraccountExists =
              filteredAccounts[i]?.vendor && accountVendors.some((acc) => acc == filteredAccounts[i]?.vendor)
            const accountIndex = accountVendors.indexOf(filteredAccounts[i]?.vendor ?? 'nil')
            const indexTogen = accountVendors.indexOf(
              accountNonexisting[i - accountexisting.length]
            )
            const canGenerate = accountNonexisting[i - accountexisting.length] === 'anchor'

            if (useraccountExists) {
              return (
                <div
                  key={i}
                  className="border border-slate-800 bg-slate-950/70 text-center rounded-xl py-3 shadow-sm hover:shadow-md transition-all"
                >
                  <h3 className="text-slate-100 font-medium text-lg mb-2">
                    {/* {i === 0 ? 'MoniePoint' : 'Anchor'} */}
                    {getAccountName(filteredAccounts[i]?.vendor)}
                  </h3>

                  {filteredAccounts[i]?.account_number ? (
                    <>
                      <p className="text-xs font-bold text-alt tracking-wider">
                        {filteredAccounts[i].account_name}
                      </p>
                      <p className="text-sm text-slate-400 mt-1">
                        Bank: {filteredAccounts[0]?.account_number}
                      </p>

                      {showView && onView ? (
                        <button
                          onClick={() => onView(i, filteredAccounts[i])}
                          className="text-sm text-slate-100 mt-1 hover:text-alt"
                        >
                          View
                        </button>
                      ) : null}
                    </>
                  ) : accountVendors[accountIndex] === 'anchor' ? (
                    <button
                      onClick={() => generate(accountIndex, accounts[i])}
                      className="text-slate-400 text-base font-normal hover:text-alt italic"
                    >
                      + Continue
                    </button>
                  ) : (
                    <span className="text-slate-500 text-sm italic">
                      Not available
                    </span>
                  )}
                </div>
              )
            } else {
              return (
                <div
                  key={i}
                  className="border border-slate-800 bg-slate-950/70 text-center rounded-xl p-5 shadow-sm hover:shadow-md transition-all"
                >
                  <h3 className="text-slate-300 font-medium text-lg mb-2">
                    {/* {i === 0 ? 'MoniePoint' : 'Anchor'} */}
                    {getAccountName(accountNonexisting[i - accountexisting.length])}
                  </h3>
                  {canGenerate ? (
                    <button
                      onClick={() => generate(indexTogen)}
                      className="text-slate-400 text-base font-normal hover:text-alt italic"
                    >
                      + generate
                    </button>
                  ) : (
                    <span className="text-slate-500 text-sm italic">
                      Not available
                    </span>
                  )}
                </div>
              )
            }
          })}
        </div>
      </div>
    </div>
  )
}

export default AccountNumbers
