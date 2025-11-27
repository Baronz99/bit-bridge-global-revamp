import { useEffect } from 'react'
import { nairaFormat } from '../../utils/nairaFormat'
import { useDispatch, useSelector } from 'react-redux'
import { SET_LOADING } from '../../redux/app'
import { getUserCardTokens, updateCardToken } from '../../redux/actions/orderToken'

const GiftCardOrder = () => {
  const dispatch = useDispatch()
  const { cardTokens } = useSelector((state) => state.orderToken)

  useEffect(() => {
    dispatch(getUserCardTokens())
  }, [])

  return (
    <div className="px-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
        {cardTokens.map((item) => (
          <>
            <div className="border flex m-auto flex-col justify-between  h-40 max-w-[300px] w-full rounded-lg shadow p-4 px-2">
              <div className="flex justify-between ">
                <p className="text-gray-100 font-semibold">{item?.order_item?.provision?.name}</p>
                <p className="text-gray-100">
                  {nairaFormat(item?.order_item?.amount, item?.currency)}
                </p>
              </div>
              <div>
                <button
                  onClick={() => {
                    dispatch(SET_LOADING(true))
                    dispatch(updateCardToken({ id: item?.id, data: { reveal: true } })).then(
                      (result) => {
                        if (updateCardToken.fulfilled.match(result)) {
                          dispatch(getUserCardTokens())

                          dispatch(SET_LOADING(false))
                        } else {
                          dispatch(SET_LOADING(false))
                        }
                      }
                    )
                  }}
                  className="border m-auto block px-4 rounded-lg text-sm bg-alt font-semibold"
                >
                  Reveal code
                </button>
              </div>
              <div>
                <small className="text-gray-100">GIft Card Code</small>

                <p className="bg-gray-300 text-center py-1">
                  {item?.reveal ? item?.token : '************'}
                </p>
              </div>
            </div>
          </>
        ))}
      </div>
    </div>
  )
}

export default GiftCardOrder
