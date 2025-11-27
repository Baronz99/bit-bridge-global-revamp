import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { nairaFormat } from '../../../utils/nairaFormat'

import './styles.scss'

import { getTransaction, updateTransaction } from '../../../redux/actions/transaction'
import { FaArrowLeft } from 'react-icons/fa'
import ClassicBtn from '../../../components/button/ClassicButton'
import { SET_LOADING } from '../../../redux/app'
import { toast } from 'react-toastify'
import dateFormater from '../../../utils/dateFormat'

const ViewTransaction = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { transaction } = useSelector((state) => state.transaction)

  useEffect(() => {
    dispatch(getTransaction(id))
  }, [])

  return (
    <>
      <div>
        <span
          className="mb-5 bg-gray-50 shadow w-max p-3 rounded block"
          onClick={() => navigate(-1)}
        >
          <FaArrowLeft />
        </span>

        <div className="bg-white p-4 rounded-lg shadow ">
          <div className="flex max-w-7xl flex-col md:flex-row gap-5 bg-red-4 justify-between">
            <div>
              <p className="text-gray-500 font-semibold my-3 flex justify-center">
                {' '}
                <span className="text-gray-800 font-semibold">Account Number</span> :{' '}
                {transaction?.address}{' '}
              </p>
              <p className="flex justify-between my-3">
                <span className="text-gray-800 font-semibold ">Amount :</span>{' '}
                <span> {nairaFormat(transaction?.amount, 'ngn')}</span>{' '}
              </p>
              <p className="flex justify-between my-3">
                <span className="text-gray-800 font-semibold capitalize">Status :</span>{' '}
                <span className="capitalize">{transaction?.status} </span>
              </p>
              <p className="flex justify-between my-3">
                <span className="text-gray-800 font-semibold capitalize">Bank :</span>{' '}
                <span className="capitalize">{transaction?.bank} </span>
              </p>
              <p className="flex justify-between my-3">
                <span className="text-gray-800 font-semibold capitalize">Request :</span>{' '}
                <span className="capitalize">{dateFormater(transaction?.created_at)} </span>
              </p>
            </div>

            <div className=" pl-1">
              <p className="text-gray-600 font-semibold justify-between flex  my-3">
                {' '}
                <span>Transaction ID </span>: {id}{' '}
              </p>
              <p className="justify-between flex my-3">
                <span className="text-gray-800 font-semibold capitalize"> Type:</span>{' '}
                <span className=" text-gray-800 font-semibold capitalize  ">
                  {' '}
                  {transaction?.order_type}
                </span>
              </p>
              <p className="justify-between flex my-3">
                <span className="text-gray-800 font-semibold capitalize">Email: </span>{' '}
                <span className=""> {transaction?.email}</span>{' '}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3">
            {/* {transaction?.order_items?.map(item => (
                    <div  key={item.id} className='shadow border p-4 rounded my-6'>
                        <div>

                            <div className='flex justify-between bg-red-200'>
                            <p className='text-gray-600 font-bold uppercase '>{item?.product?.category}</p>
                            <p className='text-gray-600 font-bold uppercase '>{item?.provision?.name}</p>

                            </div>
                            <p className='my-1 font-semibold text-xl'> {nairaFormat(item.amount, item?.currency)}</p>
                            <p className='my-1 font-semibold text-xl'>Code: {item?.card_token ?  (item?.card_token?.token) : "N/A"}</p>
                            </div>
                        <div className='flex  justify-end'>
                        <ClassicBtn className={"my-1"} onclick={() =>{
                            setSelectedId(item?.id)
                            setOpen(true)
                        
                        }

                            }>
                            send Token
                        </ClassicBtn>
                        </div>
                     
           
                    </div>
            
                ))} */}
            <p></p>

            <div className="flex  gap-4">
              <ClassicBtn
                disabled={transaction?.status === 'declined'}
                className={'my-1'}
                onclick={() => {
                  dispatch(SET_LOADING(true))
                  dispatch(updateTransaction({ id, data: { status: 'approved' } })).then(
                    (result) => {
                      if (updateTransaction.fulfilled.match(result)) {
                        dispatch(SET_LOADING(false))
                        dispatch(getTransaction(id))
                      } else {
                        dispatch(SET_LOADING(false))

                        toast(result.payload.message, { type: 'error' })
                      }
                    }
                  )
                }}
              >
                Approve Payment
              </ClassicBtn>

              <ClassicBtn
                className={'my-1 cancel'}
                onclick={() => {
                  dispatch(SET_LOADING(true))
                  dispatch(updateTransaction({ id, data: { status: 'declined' } })).then(
                    (result) => {
                      if (updateTransaction.fulfilled.match(result)) {
                        dispatch(SET_LOADING(false))
                        dispatch(getTransaction(id))
                      } else {
                        dispatch(SET_LOADING(false))

                        toast(result.payload.message, { type: 'error' })
                      }
                    }
                  )
                }}
              >
                Declined Payment
              </ClassicBtn>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default ViewTransaction
