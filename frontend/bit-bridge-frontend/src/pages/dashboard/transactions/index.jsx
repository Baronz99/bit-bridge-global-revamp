// import React from 'react'

import { NavLink, Outlet } from 'react-router-dom'

const Transactions = () => {
  const active = 'bg-alt rounded-tr-lg rounded-tl-lg bg-alt text-gray-900 px-3 py-1 font-semibold'
  const normal = 'rounded-tr-lg rounded-tl-lg bg-gray-500 text-gray-200 px-3 py-1 font-semibold'
  return (
    <div>
      <div className="px-4">
        {/* <ul className="flex gap-5 px-2">
        <li><NavLink to={"/dashboard/transactions/orders"} className={({isActive})  => isActive ? active : normal }>Order</NavLink>    </li>
        <li><NavLink to={"/dashboard/transactions/deposits"} className={({isActive})  => isActive ? active : normal }>Deposits</NavLink>    </li>
        <li><NavLink to={"/dashboard/transactions/withdrawals"} className={({isActive})  => isActive ? active : normal }>Withdrawals</NavLink>    </li>
   
        </ul> */}

        <ul className="flex gap-5 px-2">
          <li>
            <NavLink
              to={'/dashboard/transactions/orders'}
              className={({ isActive }) => (isActive ? active : normal)}
            >
              Order
            </NavLink>{' '}
          </li>
          <li>
            <NavLink
              to={'/dashboard/transactions/deposits'}
              className={({ isActive }) => (isActive ? active : normal)}
            >
              Deposits
            </NavLink>{' '}
          </li>
          <li>
            <NavLink
              to={'/dashboard/transactions/withdrawals'}
              className={({ isActive }) => (isActive ? active : normal)}
            >
              Withdrawals
            </NavLink>{' '}
          </li>
        </ul>
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default Transactions
