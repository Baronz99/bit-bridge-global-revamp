import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { nairaFormat } from '../../../utils/nairaFormat'

import './styles.scss'

import { FaArrowLeft } from 'react-icons/fa'
import { getUser, userUpdate } from '../../../redux/actions/user'
import dateFormater from '../../../utils/dateFormat'
import statusStyle from '../../../utils/statusStyle'
import Loading from '../../../components/loader/Loading'
import { pickTextColor } from '../../../utils/slect-color'
import ClickButton from '../../../components/button/ClickButton'
import BreadCrunbs from '../../../components/Breadcrumbs/BreadCrunbs'
import AppModal from '../../../components/modal/Modal'
import { toast } from 'react-toastify'
import { getOrders, updateOrder } from '../../../redux/actions/order'
import { Button, Form } from 'antd'
import FormInput from '../../../components/formInput/FormInput'
import { createUserTransaction } from '../../../redux/actions/transaction'
import { SET_LOADING } from '../../../redux/app'

const ViewUser = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user, loading } = useSelector((state) => state.user)
  const [selectedId, setSelectedId] = useState(null)
  const [open, setOpen] = useState(false)
  const [openActivate, setOpenActivate] = useState(false)
  const [openAccountModal, setOpenAccountModal] = useState(false)
  const [transactionType, setTransactionType] = useState('deposit')
  const [formLayout] = useState('vertical')

  useEffect(() => {
    dispatch(getUser(id))
  }, [])

  const [form] = Form.useForm()

  const handleSubmit = (values) => {
    console.log(values)
    dispatch(SET_LOADING(true))
    dispatch(
      createUserTransaction({
        ...values,
        wallet_id: user.wallet.id,
        coin_type: 'bank',
        currency: 'ngn',
        address: 'N/A',
        status: 'approved',
        transaction_type: transactionType,
      })
    )
      .unwrap()
      .then((result) => {
        dispatch(SET_LOADING(false))

        toast(result.message ?? 'successful transaction', { type: 'success' })
        dispatch(getUser(id))

        setOpenAccountModal(false)
      })
      .catch((error) => {
        dispatch(SET_LOADING(false))

        toast(error.message ?? 'Transaction failed', { type: 'error' })
      })
  }

  const handleOrderUpdate = (task) => {
    dispatch(
      updateOrder({
        id: selectedId,
        data: { status: task },
      })
    ).then((result) => {
      if (updateOrder.fulfilled.match(result)) {
        toast(result.message, { type: 'success' })
        dispatch(getOrders())
      } else {
        toast(result.message, { type: 'error' })
      }
    })
  }
  const handleUserstatus = () => {
    console.log(user.active, user?.active ? false : true)
    dispatch(
      userUpdate({
        id,
        data: { active: user?.active ? false : true },
      })
    ).then((result) => {
      if (userUpdate.fulfilled.match(result)) {
        toast(result.message, { type: 'success' })
        dispatch(getUser(id))

        setOpenActivate(false)
      } else {
        toast(result.message, { type: 'error' })
      }
    })
  }

  const no_items = 10
  const pages = Math.ceil((user?.transactions?.length ?? 1) / no_items)
  const [activePage, setActivePage] = useState(0)
  const fromPos = activePage * no_items
  const toPos = no_items + fromPos

  return (
    <>
      <div className="pt-5">
        <span
          className="mb-5 bg-gray-50 shadow w-max p-3 rounded block"
          onClick={() => navigate(-1)}
        >
          <FaArrowLeft />
        </span>

        <div className="bg-white p-4 rounded-lg shadow ">
          <div className="flex flex-col md:flex-row justify-between">
            <div>
              <p className="text-gray-500 font-semibold my-6">
                {' '}
                <span className="text-gray-800 font-semibold">Email</span> : {user?.email}{' '}
              </p>
              <p>
                <span className="text-gray-800 font-semibold  my-6">Balance</span> :{' '}
                <span> {nairaFormat(user?.wallet?.balance)}</span>
              </p>
              <p className="my-6">
                <span className="text-gray-800 font-semibold capitalize">Status</span> :{' '}
                <span className="capitalize">{user?.status ?? 'Active'} </span>
              </p>
            </div>

            <div>
              <p className="text-gray-600 font-semibold  my-6">
                {' '}
                <span>USER ID </span>: {id}{' '}
              </p>
              <p className=" my-6">
                <span className="text-gray-800 font-semibold capitalize"> Type:</span>{' '}
                <span className=" text-gray-800 font-semibold capitalize  "> {user?.role}</span>
              </p>
              <p className=" my-6">
                <span className="text-gray-800 font-semibold capitalize"></span> Wallet:{' '}
                <span className=""> {'NGN'}</span>{' '}
              </p>
            </div>
          </div>
          <div
            className={`${!user?.active && 'bg-red-700'} px-4 py-10 border-t border-b flex justify-between items-center`}
          >
            <div>
              <p className="font-medium">Wallet ID</p>
              <p>{user?.wallet?.id}</p>
            </div>

            <ClickButton onClick={() => setOpenActivate(true)}>
              {user?.active ? 'Deactivate Account' : 'Activate Account'}
            </ClickButton>
            <ClickButton onClick={() => setOpenAccountModal(true)}>Fund Account</ClickButton>
          </div>

          <div className="overflow-x-auto">
            <div className="">
              <div className="mt-4 flow-root">
                <div className="">
                  <div className="inline-block min-w-full py-2 align-middle">
                    <table className="min-w-full  border border-gray-200 rounded-md border-separate border-spacing-0 table-auto overflow-hidden">
                      <thead className="top-0 sticky bg-gray-300 w-full left-0 uppercase">
                        <tr>
                          <th
                            scope="col"
                            className="sticky w-20 bg-gray-100 top-0 z-10 border-b  backdrop-blur backdrop-filter"
                          ></th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter"
                          >
                            Type
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter"
                          >
                            Amount
                          </th>

                          <th
                            scope="col"
                            className="sticky  top-0 z-10  border-b border-gray-200/50  bg-opacity-75 px-6 py-3.5  text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter sm:table-cell"
                          >
                            Bank
                          </th>
                          <th
                            scope="col"
                            className="sticky  top-0 z-10  border-b border-gray-200/50  bg-opacity-75 px-6 py-3.5  text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter sm:table-cell"
                          >
                            Address
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0  z-10 border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 pr-3 md:px-10 text-left text-xs font-semibold text-gray-900  backdrop-blur backdrop-filter"
                          >
                            Status
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10  border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter lg:table-cell"
                          >
                            Time{' '}
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10  border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter lg:table-cell"
                          >
                            {' '}
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {loading ? (
                          <tr>
                            <td className=" py-8 text-center justify-center " colSpan={6}>
                              <span>
                                <Loading />
                              </span>
                            </td>
                          </tr>
                        ) : user?.transactions?.length > 0 ? (
                          user?.transactions?.slice(fromPos, toPos).map((item, index) => (
                            <tr key={item?.id}>
                              <td className="whitespace-nowrap w-20 border-b capitalize border-gray-200 px-3 py-3 text-sm text-gray-600/90  font-semibold ">
                                <p className="font-bold">
                                  {' '}
                                  <span>{index + fromPos + 1}</span>
                                </p>
                              </td>
                              <td className="whitespace-nowrap border-b capitalize border-gray-200 px-3 py-3 text-sm text-gray-600/90  font-semibold ">
                                <p className="font-bold">
                                  {' '}
                                  <span className={`${pickTextColor(item?.transaction_type)}`}>
                                    {item?.transaction_type}
                                  </span>
                                </p>
                              </td>
                              <td className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-sm text-gray-600/90  font-semibold ">
                                <p className="font-bold">{nairaFormat(item.amount, 'ngn')}</p>
                              </td>
                              <td className="relative max-w-40 whitespace-nowrap border-b border-gray-200 py-3 pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                                {item?.bank ?? 'Not Available'}
                              </td>{' '}
                              <td className="relative max-w-40 whitespace-nowrap border-b border-gray-200 py-3 pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                                {item?.address ?? 'Not Available'}
                              </td>
                              <td className="relative whitespace-nowrap border-b border-gray-200 py-3 pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                                <span
                                  className={`${statusStyle(item?.status)} py-1 w-full max-w-[200px] block  text-center px-3 border rounded-3xl`}
                                >
                                  {item?.status}
                                </span>
                              </td>
                              {/* <td className="relative whitespace-nowrap border-b border-gray-200 py-3 pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                                        <span className={` py-1 inline-block text-center px-3 rounded-3xl`}>
                                            <img onClick={()=> {
                                                setToggle(true)
                                                setViewImage(item?.proof_url)
                                            }} src= {item?.proof_url} className="w-20 border border-y-gray-400 h-20" alt="" />
                                       
                                        </span>
                                        

                                    </td>  */}
                              <td className="relative whitespace-nowrap border-b text-left border-gray-200 py-3 pr-4 pl-3 text-gray-900  text-sm sm:pr-8 lg:pr-8">
                                {dateFormater(item?.created_at)}
                              </td>
                              <td className="relative whitespace-nowrap border-b border-gray-200 py-3 pr-4 pl-3 text-left font-semibold text-blue-600 text-sm sm:pr-8 lg:pr-8">
                                <NavLink className="" to={`/admin/transactions/${item?.id}`}>
                                  View
                                </NavLink>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="text-center py-10" colSpan={6}>
                              <span className="text-black">No Transaction</span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <div className="py-2 flex gap-4">
                      <span
                        onClick={() => setActivePage((prev) => Math.min(prev + 1, pages))}
                        className="border cursor-pointer bg-gray-300 px-4 rounded shadow"
                      >
                        Next
                      </span>
                      {Array.from({ length: pages })?.map((_, index) => (
                        <span
                          onClick={() => setActivePage(index)}
                          key={index}
                          className={`${activePage === index ? 'bg-gray-300' : 'bg-gray-100'}  border cursor-pointer0 px-4 rounded shadow`}
                        >
                          {index}
                        </span>
                      ))}

                      <span
                        onClick={() => setActivePage((prev) => Math.max(prev - 1, 0))}
                        className="border cursor-pointer bg-gray-300 px-4 rounded shadow"
                      >
                        Prev
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="">
              <h3 className="text-xl font-semibold text-gray-700">User Purchases</h3>
              <div className="mt-4 flow-root">
                <div className="">
                  <div className="inline-block min-w-full py-2 align-middle">
                    <table className="min-w-full  border border-gray-200 rounded-md border-separate border-spacing-0 table-auto overflow-hidden">
                      <thead className="bg-gray-200">
                        <tr>
                          <th
                            scope="col"
                            className="sticky top-0 z-10 border-b border-gray-200/50  bg-opacity-75 py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter sm:pl-6 lg:pl-8"
                          >
                            {' '}
                            Email
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0  z-10 border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 pr-3 text-left text-xs font-semibold text-gray-900  backdrop-blur backdrop-filter"
                          >
                            Type
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0  z-10 border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 pr-3 text-left text-xs font-semibold text-gray-900  backdrop-blur backdrop-filter"
                          >
                            Provider
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10  border-b border-gray-200/50  bg-opacity-75 px-6 py-3.5  text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter sm:table-cell"
                          >
                            Status
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter"
                          >
                            Amount
                          </th>
                          <th
                            scope="col"
                            className="sticky top-0 z-0  border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter lg:table-cell"
                          >
                            Time{' '}
                          </th>
                          <th
                            scope="col"
                            className=" top-0 z-0  border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter lg:table-cell bg-gray-500"
                          >
                            {' '}
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {loading ? (
                          <tr>
                            <td className=" py-8 text-center justify-center " colSpan={6}>
                              <span>
                                <Loading />
                              </span>
                            </td>
                          </tr>
                        ) : user?.bill_orders?.length > 0 ? (
                          user?.bill_orders?.slice(0, 10).map((item) => (
                            <tr key={item?.id}>
                              <td className="whitespace-nowrap border-b border-gray-200 py-2 pl-3 pr-3 text-sm font-normal sm:pl-6 lg:pl-8">
                                <p className="font-medium text-gray-600 leading-5">{item.email} </p>
                              </td>
                              <td className="whitespace-nowrap  border-b border-gray-200 hidden px-3 py-4 text-sm text-gray-900 font-normal sm:table-cell capitalize">
                                {item.service_type}
                              </td>
                              <td className="whitespace-nowrap  border-b border-gray-200 hidden px-3 py-4 text-sm text-gray-900 font-normal sm:table-cell capitalize">
                                {item.biller}
                              </td>
                              <td className="whitespace-nowrap  border-b border-gray-200 hidden px-3 py-4 text-sm text-gray-900 font-normal sm:table-cell capitalize">
                                {item.status}
                              </td>

                              {/* <td className="whitespace-nowrap border-b border-gray-200 hidden px-3 py-3 text-sm text-gray-600 sm:table-cell text-left"><span className="rounded-xl  text-xs border border-gray-200 py-1 px-2.5"> <span className= "text-base <%=set_empt_status(user.status)%>"> &#x2022;</span> <span></span></span></td> */}
                              <td className="relative whitespace-nowrap font-semibold border-b border-gray-200 py-3 pr-4 pl-3 text-left text-gray-900 text-sm sm:pr-8 lg:pr-8">
                                <p className="font-bold">
                                  {nairaFormat(item?.total_amount, 'ngn')}
                                </p>

                                {/* {item?.order_items[0].amount ?? "Not Available"} */}
                              </td>

                              <td className="relative whitespace-nowrap border-b text-left border-gray-200 py-3 pr-4 pl-3 text-gray-900  text-sm sm:pr-8 lg:pr-8">
                                {dateFormater(item?.created_at)}
                              </td>

                              <td className="relative z-0 whitespace-nowrap border-b text-center border-gray-200 py-3 pr-4 pl-3 text-gray-900  text-sm sm:pr-8 lg:pr-8">
                                <BreadCrunbs
                                  id={item.id}
                                  setSelectedId={setSelectedId}
                                  link={`/admin/purchases/${item?.id}`}
                                  setOpen={setOpen}
                                  open={open}
                                />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="text-center py-10" colSpan={6}>
                              <span className="text-black">No Transaction</span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AppModal handleCancel={() => setOpen(false)} isModalOpen={open} title={'Approve Orders'}>
        <div className="flex my-6 justify-between">
          <ClickButton onClick={() => handleOrderUpdate('declined')} btnType="decline">
            Decline
          </ClickButton>
          <ClickButton onClick={() => handleOrderUpdate('approved')}>Approve</ClickButton>
        </div>
      </AppModal>

      <AppModal
        className={'white-bg'}
        handleCancel={() => setOpenAccountModal(false)}
        isModalOpen={openAccountModal}
        title={`${transactionType} Transaction`}
      >
        <div className="my-6 justify-between">
          <div className="flex gap-4 my-4">
            <button
              onClick={() => setTransactionType('deposit')}
              className={`${transactionType == 'deposit' ? 'bg-alt text-primary' : 'bg-primary text-white'}  px-4 py-2 rounded-lg `}
            >
              Depodit
            </button>
            <button
              onClick={() => setTransactionType('withdrawal')}
              className={`${transactionType == 'withdrawal' ? 'bg-alt text-primary' : 'bg-primary text-white'}  px-4 py-2 rounded-lg `}
            >
              Withdrawal
            </button>
          </div>

          <Form
            className="add-fund w-full"
            layout={formLayout}
            onFinish={(values) => {
              handleSubmit(values)
            }}
            form={form}
            initialValues={{
              amount: '',
              bank: 'bitbridge',
            }}
            style={{
              color: 'white',
              maxWidth: formLayout === 'inline' ? 'none' : 600,
            }}
          >
            <FormInput required={true} className="" name="amount" type="number" label={`Amount`} />
            {transactionType === 'deposit' && (
              <FormInput
                required={true}
                className="add-fund"
                name="bank"
                disabled={true}
                type="text"
                label={'Bank'}
              />
            )}
            <div className="mt-10"></div>

            <Form.Item label={null}>
              <Button
                className="border-alt m-auto block w-full h-20 bg-primary text-gray-800 rounded-lg  border shadow-md font-medium text-xl"
                type="primary"
                htmlType="submit"
              >
                {transactionType === 'deposit' ? 'Credit User' : 'Debit User'}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </AppModal>

      <AppModal
        className={'white-bg'}
        handleCancel={() => setOpenActivate(false)}
        isModalOpen={openActivate}
        title={`${user?.active ? 'Deactivate' : 'Activate'} Account`}
      >
        <div className="flex my-6 justify-between w-full">
          <ClickButton onClick={() => setOpenActivate(false)} btnType="decline">
            Cancel
          </ClickButton>
          <ClickButton onClick={() => handleUserstatus('approved')}>
            {user?.active ? 'Deactivate Account' : 'Activate Account'}
          </ClickButton>
        </div>
      </AppModal>
    </>
  )
}

export default ViewUser
