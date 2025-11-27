import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import BreadCrunbs from '../../../components/Breadcrumbs/BreadCrunbs'
import { getTransactions, updateTransaction } from '../../../redux/actions/transaction'
import AppModal from '../../../components/modal/Modal'
import ClickButton from '../../../components/button/Button'
import { toast } from 'react-toastify'
import dateFormater from '../../../utils/dateFormat'
import statusStyle from '../../../utils/statusStyle'
import { nairaFormat } from '../../../utils/nairaFormat'
// import OptionDropDown from '../../../compnents/optionDropDown/OPtionDropDown'

const AdminWithdrawalTransactions = () => {
  const { withdrawals } = useSelector((state) => state.transaction)
  const dispatch = useDispatch()
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    dispatch(getTransactions())
  }, [])

  const handleTransactionUpdate = (task) => {
    dispatch(
      updateTransaction({
        id: selectedId,
        data: { status: task },
      })
    ).then((result) => {
      if (updateTransaction.fulfilled.match(result)) {
        toast(result?.payload?.message || `transaction ${task}`, { type: 'success' })
        dispatch(getTransactions())
      } else {
        toast(result?.payload?.message, { type: 'error' })
      }
    })
  }

  return (
    <div>
      <h3 className="font-semibold text-xl my-5 text-gray-900">Users</h3>

      <div className="px-4 sm:px-6 lg:px-8  hover:border-gray-900">
        <div className="mt-4 flow-root overflow-x-auto">
          <div className="lg:mx-8">
            <div className="inline-block min-w-full py-2 align-middle">
              <table className="min-w-full bg-gray-300 border border-gray-200 rounded-md border-separate border-spacing-0 table-auto">
                <thead className="bg-gray-900 text-alt">
                  <tr>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold  backdrop-blur backdrop-filter"
                    >
                      Amount
                    </th>

                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-200/50  bg-opacity-75 py-3.5 pl-4 pr-3 text-left text-xs font-semibold backdrop-blur backdrop-filter sm:pl-6 lg:pl-5"
                    >
                      {' '}
                      Type
                    </th>
                    {/* <th scope="col" className="sticky top-0  z-10 border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 pr-3 text-left text-xs font-semibold text-gray-900  backdrop-blur backdrop-filter">Type</th> */}
                    <th
                      scope="col"
                      className="sticky top-0 z-10 hidden border-b border-gray-200/50  bg-opacity-75 px-6 py-3.5  text-left text-xs font-semibold  backdrop-blur backdrop-filter sm:table-cell"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 hidden border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold  backdrop-blur backdrop-filter lg:table-cell"
                    >
                      Bank{' '}
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 hidden border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold  backdrop-blur backdrop-filter lg:table-cell"
                    >
                      Account{' '}
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 hidden border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold  backdrop-blur backdrop-filter lg:table-cell"
                    >
                      Time{' '}
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-center text-xs font-semibold  backdrop-blur backdrop-filter lg:table-cell"
                    >
                      {' '}
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-center text-xs font-semibold  backdrop-blur backdrop-filter lg:table-cell"
                    ></th>
                  </tr>
                </thead>

                <tbody>
                  {/* make conditional statement  here  */}
                  {/* <td colspan="5" rowspan="10" class="font-semibold text-gray-900 backdrop-blur backdrop-filter text-center">  </td> */}
                  {withdrawals?.map(
                    ({ id, status, bank, transaction_type, address, created_at, amount }) => (
                      <tr key={id}>
                        <td className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-sm text-gray-600/90  font-semibold ">
                          <p className="font-bold">{nairaFormat(amount)}</p>
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-sm text-gray-600/90  font-semibold ">
                          <p className="font-bold">{transaction_type}</p>
                        </td>
                        <td className="relative whitespace-nowrap border-b  border-gray-200 py-3 pr-4 pl-3 text-gray-900  text-sm sm:pr-8 lg:pr-8">
                          <span
                            className={`${statusStyle(status)} py-1 w-full max-w-[200px] block  text-center px-3 border rounded-3xl`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="relative whitespace-nowrap border-b border-gray-200 py-3 pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                          {bank ?? 'Not Available'}
                        </td>{' '}
                        <td className="relative whitespace-nowrap border-b border-gray-200 py-3 pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                          {address ?? 'Not Available'}
                        </td>
                        <td className="relative whitespace-nowrap border-b text-left border-gray-200 py-3 pr-4 pl-3 text-gray-900  text-sm sm:pr-8 lg:pr-8">
                          {dateFormater(created_at)}
                        </td>
                        <td className="relative whitespace-nowrap border-b text-center border-gray-200 py-3 pr-4 pl-3 text-gray-900  text-sm sm:pr-8 lg:pr-8">
                          <BreadCrunbs
                            id={id}
                            setSelectedId={setSelectedId}
                            setOpen={setOpen}
                            link={`/admin/transactions/${id}`}
                            open={open}
                          />
                          {/* <OptionDropDown id={id} handleDel={()=> {
                                                                                setOpen(true)
                                                                                setSelectedId(id)
                                                                            }}/> */}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <AppModal handleCancel={() => setOpen(false)} isModalOpen={open} title={'Approve Deposit'}>
        <div className="flex my-6 justify-between">
          <ClickButton onClick={() => handleTransactionUpdate('declined')} btnType="decline">
            Decline
          </ClickButton>
          <ClickButton onClick={() => handleTransactionUpdate('approved')}>Approve</ClickButton>
        </div>
      </AppModal>
    </div>
  )
}

export default AdminWithdrawalTransactions
