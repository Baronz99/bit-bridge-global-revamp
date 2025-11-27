import React, { useCallback, useState } from 'react'

const AccountNumbers = ({ accounts, generate, onView }) => {
  //   const [accounts, setAccounts] = useState({
  //     savings: null,
  //     investment: null,
  //   })

  const [loading, setLoading] = useState(false)

  const getAccountName = useCallback((account) => {
    switch (account) {
      case 'moniepoint':
        return 'Monie Point'
      case 'anchor':
        return 'Anchor'
      default:
        'Anchor'
    }
  }, [])

  const accountVendors = ['moniepoint', 'anchor']
  //   const isVenorAnchor = accounts.some((acc) => acc.vendor === 'anchor')

  const accountNonexisting = accountVendors.filter((acc) => !accounts.some((e) => e.vendor == acc))
  const accountexisting = accountVendors.filter((acc) => accounts.some((e) => e.vendor == acc))

  console.log(accounts)

  return (
    <div className="max-w-2x flex justify-between w-full bg-black my-4 rounded-2xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-6 mb-8">
          {/* Savings Account */}
          {Array.from({ length: accountVendors.length }).map((_, i) => {
            const useraccountExists =
              accounts[i]?.vendor && accountVendors.some((acc) => acc == accounts[i]?.vendor)
            const notFound = accountVendors.filter((vendor) => vendor !== accounts[i]?.vendor)
            const accountIndex = accountVendors.indexOf(accounts[i]?.vendor ?? 'nil')
            const accountExists = accountIndex !== 1

            console.log(accountExists, accountIndex)

            const indexTogen = accountVendors.indexOf(
              accountNonexisting[i - accountexisting.length]
            )

            if (useraccountExists) {
              return (
                <div
                  key={i}
                  className="border border-gray-200 bg-gradient-to-b from-gray-900 to-transparent text-center rounded-xl py-2 shadow-sm hover:shadow-md transition-all"
                >
                  <h3 className="text-gray-300   font-medium text-lg mb-2">
                    {/* {i === 0 ? 'MoniePoint' : 'Anchor'} */}
                    {getAccountName(accounts[i]?.vendor)}
                  </h3>

                  {accounts[i]?.account_number ? (
                    <>
                      <p className="text-xs font-bold text-alt tracking-wider">
                        {accounts[i].account_name}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Bank: {accounts[0]?.account_number}
                      </p>

                      <button
                        onClick={() => onView(i, accounts[i])}
                        className="text-sm text-gray-100 mt-1  hover:text-alt"
                      >
                        View
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => generate(accountIndex, accounts[i])}
                      className="text-gray-400 text-base font-normal hover:text-alt italic"
                    >
                      + Continue
                    </button>
                  )}
                </div>
              )
            } else {
              return (
                <div
                  key={i}
                  className="border border-gray-200 bg-gradient-to-b from-gray-900 to-transparent text-center rounded-xl p-5 shadow-sm hover:shadow-md transition-all"
                >
                  <h3 className="text-gray-500 font-medium text-lg mb-2">
                    {/* {i === 0 ? 'MoniePoint' : 'Anchor'} */}
                    {getAccountName(accountNonexisting[i - accountexisting.length])}
                  </h3>
                  <button
                    onClick={() => generate(indexTogen)}
                    className="text-gray-400 text-base font-normal hover:text-alt italic"
                  >
                    + generate
                  </button>
                </div>
              )
            }
          })}
        </div>
      </h2>
    </div>
  )
}

export default AccountNumbers
