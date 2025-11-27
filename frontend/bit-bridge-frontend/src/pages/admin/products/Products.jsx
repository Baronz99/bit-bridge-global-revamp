import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { delProduct, getProducts } from '../../../redux/actions/product'
import OptionDropDown from '../../../components/optionDropDown/OPtionDropDown'
import AppModal from '../../../components/modal/Modal'
import ClickButton from '../../../components/button/Button'
import { toast } from 'react-toastify'

const Products = () => {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState()
  const { products } = useSelector((state) => state.product)
  const dispatch = useDispatch()
  useEffect(() => {
    dispatch(getProducts())
  }, [])

  const handleDelete = (id) => {
    dispatch(delProduct(id)).then((result) => {
      if (delProduct.fulfilled.match(result)) {
        toast(result.payload.message, { type: 'success' })
        dispatch(getProducts())
        setOpen(false)
      } else {
        toast(result.message, { type: 'error' })
      }
    })
  }

  return (
    <div className="bg-gray-100 p-4">
      <h3 className="font-semibold text-xl text-gray-900">Products</h3>

      <div className="mt-4 px-0 bg-gray-100 overflow-x-auto flow-root">
        <div className="mx-1 my-2 sm:mx-2 lg:mx-0">
          <div className="inline-block min-w-full py-2 align-middle">
            <table className="min-w-full bg-gray-100 border border-gray-200 rounded-md border-separate border-spacing-0 table-auto overflow-hidden">
              <thead className="bg-gray-200">
                <tr>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-gray-200/50  bg-opacity-75 py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter sm:pl-6 lg:pl-8"
                  >
                    Provider{' '}
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0  z-10 border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 pr-3 text-left text-xs font-semibold text-gray-900  backdrop-blur backdrop-filter"
                  >
                    Provision
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 hidden border-b border-gray-200/50  bg-opacity-75 px-6 py-3.5  text-left text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter sm:table-cell"
                  >
                    Currency
                  </th>
                  {/* <th scope="col" className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-center text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter">Value</th> */}
                  <th
                    scope="col"
                    className="sticky top-0 z-10 hidden border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-center text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter lg:table-cell bg-gray-500"
                  >
                    {' '}
                  </th>
                </tr>
              </thead>

              <tbody>
                {products?.map((item) => (
                  <tr key={item?.id}>
                    <td className="whitespace-nowrap border-b border-gray-200 py-2 pl-3 pr-3 text-sm font-normal sm:pl-6 lg:pl-8">
                      <p className="font-medium text-gray-600 leading-5">{item.provider} </p>
                    </td>
                    <td className="whitespace-nowrap  border-b border-gray-200 px-3 py-4 text-sm text-gray-900 font-normal sm:table-cell capitalize">
                      {item.category}
                    </td>

                    <td className="relative whitespace-nowrap border-b border-gray-200 py-3 px-6 uppercase text-left text-gray-900 text-sm sm:pr-8 ">
                      {item?.currency}
                    </td>

                    <td className="whitespace-nowrap bg-gray-200 border-b border-gray-200 px-3 py-3 text-sm text-gray-600/90  font-semibold ">
                      <p className="font-bold">
                        <OptionDropDown
                          id={item.id}
                          handleDel={() => {
                            setOpen(true)
                            setSelectedId(item.id)
                          }}
                        />{' '}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <AppModal handleCancel={() => setOpen(false)} isModalOpen={open} title={'Delete Product'}>
        <div className="flex my-6 justify-between">
          <ClickButton onClick={() => setOpen(false)} btnType="decline">
            Cancel
          </ClickButton>
          <ClickButton onClick={() => handleDelete(selectedId)}>Delete</ClickButton>
        </div>
      </AppModal>
    </div>
  )
}

export default Products
