import { nairaFormat } from '../../utils/nairaFormat'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'

const BillOrderDetails = ({ purchaseOrder, applyCommission }) => {
  const { user } = useSelector((state) => state.auth)

  const pickLabel = (type) => {
    switch (type) {
      case 'vtu':
      case 'data':
        return 'Phone Number'
      case 'tv':
        return 'Decoder ID'
      case 'electricity':
        return 'Meter Number'

      default:
        return 'Number'
    }
  }

  return (
    <div className="bg-gray-900 text-white  flex items-center justify-center p-6 mt-4">
      <div className="bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-7xl">
        <h2 className="text-2xl font-semibold mb-4 text-center">Billing Transaction</h2>
        <h2>
          {purchaseOrder?.token && (
            <div className="  md:flex-row flex-col my-4 flex gap-4">
              <p className="md:w-60 border-b  border-gray-700 px-2 font-semibold">Token</p>
              <p className="flex-1 border-b  border-gray-700 px-2 font-bold text-2xl">
                {purchaseOrder?.token}
              </p>
            </div>
          )}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {purchaseOrder?.name && (
            <Detail
              label={'Customer Name'}
              value={purchaseOrder?.name}
              hidden={
                purchaseOrder?.service_type === 'VTU' || purchaseOrder?.service_type === 'VTU'
              }
            />
          )}
          {purchaseOrder?.address && (
            <Detail
              label={'Address'}
              value={purchaseOrder?.address}
              hidden={
                purchaseOrder?.service_type === 'VTU' || purchaseOrder?.service_type === 'VTU'
              }
            />
          )}

          {purchaseOrder?.meter_number && (
            <Detail
              label={pickLabel(purchaseOrder?.service_type.toLowerCase())}
              value={purchaseOrder?.meter_number}
            />
          )}

          {purchaseOrder?.biller && (
            // <div className="gap-4 my-4 md:flex-row flex-col  flex">
            //     <p className="w-60 md:w-60 border-b  border-gray-700 px-2 font-semibold">Biller</p>
            //     <p className="flex-1 border-b  border-gray-700 px-2">{purchaseOrder?.biller}</p>
            // </div>

            <Detail label={'Biller'} value={purchaseOrder?.biller} />
          )}

          {purchaseOrder?.amount && (
            // <div className="gap-4 my-4 md:flex-row flex-col  flex">
            //     <p className="w-60 md:w-60 border-b  border-gray-700 px-2 font-semibold">Amount</p>
            //     <p className="flex-1 border-b  border-gray-700 px-2">{nairaFormat(purchaseOrder?.amount ?? 0)}</p>
            // </div>
            <Detail
              label={'Amount'}
              applyCommission={applyCommission}
              commission={
                purchaseOrder?.bill_commission && nairaFormat(purchaseOrder?.bill_commission)
              }
              value={nairaFormat(purchaseOrder?.amount ?? 0)}
            />
          )}
          {purchaseOrder?.amount && (
            // <div className="gap-4 my-4 md:flex-row flex-col  flex">
            //     <p className="w-60 md:w-60 border-b  border-gray-700 px-2 font-semibold">Service Charge</p>
            //     <p className="flex-1 border-b  border-gray-700 px-2">{nairaFormat(purchaseOrder?.service_charge)}</p>
            // </div>

            <Detail label={'Service Charge'} value={nairaFormat(purchaseOrder?.service_charge)} />
          )}

          {purchaseOrder?.amount && (
            <Detail
              label={'Total Payable Amount'}
              value={nairaFormat(Number(purchaseOrder?.total_amount))}
              applyCommission={applyCommission}
              commission={
                purchaseOrder?.bill_commission && nairaFormat(purchaseOrder?.bill_commission)
              }
            />
          )}
          {purchaseOrder?.transaction_id && (
            // <div className="gap-4 my-4 md:flex-row flex-col flex">
            //                 <p className="w-60 md:w-60 border-b  border-gray-700 px-2 font-semibold">Transaction ID</p>
            //                 <p className="flex-1 border-b  border-gray-700 px-2">{purchaseOrder?.transaction_id}</p>
            //             </div>

            <Detail label={'Transaction ID'} value={purchaseOrder?.transaction_id} />
          )}
          {purchaseOrder?.status && (
            // <div className="gap-4 my-4 md:flex-row flex-col  flex">
            //     <p className="w-60 border-b  border-gray-700 px-2  md:w-60 font-semibold"></p>
            //     <p className="flex-1 border-b  border-gray-700 px-2">{purchaseOrder?.status}</p>
            // </div>
            <Detail label={'Status'} value={purchaseOrder?.status} badge />
          )}
          {purchaseOrder?.id && (
            // <div className="gap-4 my-4 md:flex-row flex-col  flex">
            // <p className="w-60 px-2 md:w-60 font-semibold">Order ID</p>
            // <p className="flex-1 px-2">{purchaseOrder?.id}</p>
            // </div>

            <Detail label={'Order ID'} value={purchaseOrder?.id} />
          )}

          {purchaseOrder?.email && (
            <Detail label={'Email'} value={purchaseOrder?.email ?? user?.emal} />
          )}
        </div>
      </div>
    </div>
  )
}

BillOrderDetails.propTypes = {
  purchaseOrder: PropTypes.object,
  applyCommission: PropTypes.bool,
}

const Detail = ({
  label,
  value,
  badge = false,
  hidden = false,
  applyCommission = false,
  commission,
}) => {
  console.log(commission, applyCommission)
  return (
    <div className={`${hidden ? 'hidden' : 'flex'} flex-col`}>
      <span className="text-gray-400 uppercase text-xs">{label}</span>
      {badge ? (
        <span
          className={`mt-1 inline-block px-2 py-1 rounded-md text-xs font-medium ${
            value === 'approved' || value === 'completed'
              ? 'bg-green-600 text-white'
              : value === 'pending'
                ? 'bg-yellow-600 text-white'
                : 'bg-red-600 text-white'
          }`}
        >
          {value}
        </span>
      ) : (
        <p className="flex items-center gap-5 bg-red">
          <span className={`text-white  ${applyCommission && 'line-through'}`}>{value}</span>
          {applyCommission && <span className="text-white">{commission}</span>}
        </p>
      )}
    </div>
  )
}

Detail.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
  badge: PropTypes.bool,
  hidden: PropTypes.bool,
  applyCommission: PropTypes.bool,
}

export default BillOrderDetails
