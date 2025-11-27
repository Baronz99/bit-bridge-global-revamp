import React from 'react'
import { useSelector } from 'react-redux'

const Services = () => {
  const { services } = useSelector((state) => state.product)

  return (
    <div className="bg-gray-100 p-4">
      <h3 className="font-semibold text-xl text-gray-900">Services</h3>

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
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-gray-200/50 bg-opacity-75 px-3 py-3.5 text-center text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter"
                  >
                    USD
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 hidden border-b border-gray-200/50 bg- bg-opacity-75 px-3 py-3.5 text-center text-xs font-semibold text-gray-900 backdrop-blur backdrop-filter lg:table-cell bg-gray-500"
                  >
                    {' '}
                  </th>
                </tr>
              </thead>

              <tbody>
                {/* make conditional statement  here  */}
                {/* <td colspan="5" rowspan="10" class="font-semibold text-gray-900 backdrop-blur backdrop-filter text-center">  </td> */}
                {services?.map((item) => (
                  <tr key={item?.id}>
                    <td className="whitespace-nowrap border-b border-gray-200 py-2 pl-3 pr-3 text-sm font-normal sm:pl-6 lg:pl-8">
                      <p className="font-medium text-gray-600 leading-5">{item.provider} </p>
                    </td>
                    <td className="whitespace-nowrap  border-b border-gray-200 px-3 py-4 text-sm text-gray-900 font-normal sm:table-cell capitalize">
                      {item.provision}
                    </td>

                    {/* <td className="whitespace-nowrap border-b border-gray-200 hidden px-3 py-3 text-sm text-gray-600 sm:table-cell text-left"><span className="rounded-xl  text-xs border border-gray-200 py-1 px-2.5"> <span className= "text-base <%=set_empt_status(user.status)%>"> &#x2022;</span> <span></span></span></td> */}
                    <td className="relative whitespace-nowrap border-b border-gray-200 py-3 pr-4 pl-6 text-left text-gray-900 text-sm sm:pr-8 lg:pr-6">
                      {item?.currency}
                    </td>
                    <td className="relative whitespace-nowrap border-b text-center border-gray-200 py-3 pr-4 pl-3 text-gray-900  text-sm sm:pr-8 font-medium lg:px-8">
                      {item?.min_value + ' - ' + item?.max_value}
                    </td>
                    <td className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-sm text-gray-600/90  font-semibold ">
                      <p className="font-bold">{item.amount}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Services
