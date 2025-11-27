import { CiBitcoin } from 'react-icons/ci'
import { TbCurrencyDogecoin } from 'react-icons/tb'
import { NavLink, Outlet } from 'react-router-dom'

const CryptoSell = () => {
  return (
    <div className="flex flex-col md:flex-row  gap-4">
      <aside className="max-w-52 lg:max-w-xs w-full px-2 hidden md:block rounded-xl border border-gray-700">
        <ul className="">
          <Links />
        </ul>
      </aside>

      <div className="md:hidden ">
        <ul className="overflow-x-auto flex">
          <Links />
        </ul>
      </div>

      <div className="flex-1 flex justify-center items-center rounded-lg p-4 bg-black min-h-96 py-20">
        <div className="max-w-3xl w-full bg-gray-900 rounded-lg">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

const Links = () => {
  const active = 'w-full flex items-center gap-3 px-4 text-alt border-b border-alt py-5 text-xl'
  const normal =
    'w-full flex items-center  gap-3 px-4 text-gray-500 border-b border-gray-500 py-5 text-xl'

  return (
    <>
      <NavLink
        to={'/dashboard/crypto-sell/bitcoin'}
        className={({ isActive }) => (isActive ? active : normal)}
      >
        <CiBitcoin className="bg-red-" />
        <span className=" items-">Bitcoin</span>
      </NavLink>
      <NavLink
        to={'/dashboard/crypto-sell/dogecoin'}
        className={({ isActive }) => (isActive ? active : normal)}
      >
        <TbCurrencyDogecoin />
        Dogecoin
      </NavLink>
      <NavLink
        to={'/dashboard/crypto-sell/ethereum'}
        className={({ isActive }) => (isActive ? active : normal)}
      >
        <TbCurrencyDogecoin />
        Ethereum
      </NavLink>
      {/* <NavLink to={"/dashboard/crypto-sell/ethereum"} className={({isActive}) => isActive ? active : normal}>
            <TbCurrencyDogecoin />
            Ethereum

          </NavLink> */}
    </>
  )
}

export default CryptoSell
