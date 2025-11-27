import { useEffect, useState } from 'react'
import NavButton from '../../../components/button/NavButton'
import { converter } from '../../../api/currencyConverter'
import { useDispatch } from 'react-redux'
import { createTransaction } from '../../../redux/actions/transaction'
import AppModal from '../../../components/modal/Modal'
import AddFund from '../../../components/addFund/AddFund'

const Dogecoin = () => {
  const [currencyConversion, setCurrencyConversion] = useState()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const coinType = 'dogecoin'
  const address = 'sdasffdfddggfh'

  const dispatch = useDispatch()
  useEffect(() => {
    ;(async () => {
      const conversion = await converter({ toCurr: 'ngn' })
      setCurrencyConversion(conversion)
    })()
  }, [])

  const handleSubmit = (values) => {
    dispatch(
      createTransaction({
        ...values,
        transaction_type: 'deposit',
      })
    ).then((result) => {
      if (createTransaction.fulfilled.match(result)) {
        setIsModalOpen(false)
      }
    })
  }

  return (
    <>
      <div className="p-4 text-white min-h-96 sm:p-6 lg:p-10">
        <h2 className="text- font-medium text-2xl text-center">Sell Dogecoin</h2>
        <div>
          <p className="text-gray-400 my-8">Transfer your BITCOIN to the address below to sell.</p>
          <div className="flex justify-between my-6 max-w-xl m-auto">
            <div>
              <p className="text-gray-400 text-sm">NGN/USD</p>
              <p className="text-lg font-semibold">{currencyConversion?.calc}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">NGN/USD</p>
              <p className="text-lg font-semibold">{currencyConversion?.calc}</p>
            </div>

            <div>
              <p className="text-gray-400 text-sm">NGN/USD</p>
              <p className="text-lg font-semibold">{currencyConversion?.calc}</p>
            </div>
          </div>
          <div className="text-center">
            <p className="my-8">Payment Address</p>
            <p className="my-8"> Address</p>

            <NavButton onClick={() => setIsModalOpen((prev) => !prev)}>
              Send Proof Payment{' '}
            </NavButton>
          </div>
        </div>
      </div>
      <AppModal
        isModalOpen={isModalOpen}
        handleCancel={() => {
          setIsModalOpen(false)
        }}
      >
        <AddFund coin_type={coinType} handleSubmit={handleSubmit} address={address} />
      </AppModal>
    </>
  )
}

export default Dogecoin
