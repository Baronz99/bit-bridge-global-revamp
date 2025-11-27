import { useParams } from 'react-router-dom'

import Header from '../../compnents/header/Header'
import ProductCard from '../../compnents/product-card/ProductCard'
import CartButton from '../../compnents/button/CartButton'
import { ExclamationOutlined } from '@ant-design/icons'
import { useSelector } from 'react-redux'
const ViewGiftCard = () => {
  const { id } = useParams()

  const { giftcards } = useSelector((state) => state.provision)

  const selectedProvider = giftcards.find((item) => item.id == id)

  const description = {
    __html: `    Cherry Credits is a versatile virtual currency that can be used for over 1,000 digital content and games, including popular titles like Ragnarok Online, Dragon Nest, Black Desert Online, and more. By using Cherry Credits, you can easily purchase games, software, and other items on popular platforms such as Steam and Ubisoft Store.


                        Steam and Ubisoft Store
                        On Steam, redeem Cherry Credits for Steam Wallet Codes, which work like game activation codes, giving you access to over 1,800 game titles and a community of 75 million active users.


                        Cherry Credits can be used to buy Steam Wallet Codes in the following countries: Australia, Bahrain, Brunei, Cambodia, East Timor, Hong Kong, Indonesia, India, Kuwait, Laos, Malaysia, Myanmar, Oman, Philippines, Qatar, Saudi Arabia, Singapore, Thailand, Turkey, United Arab Emirates (UAE), Vietnam, Korea, Nepal, Taiwan, China, Pakistan, and Macau.


                        On Ubisoft, use Cherry Credits as a payment method to purchase games via the Uplay Launcher or Ubisoft Web Store. Cherry Credits simplifies the process of accessing a wide range of games and digital content on these popular platforms, all while enjoying the benefits of virtual currency.


                        You can find the instructions on how to redeem Cherry Credits on Steam and Ubisoft Store below:

                        Buy Steam Wallet Codes Credits
                        Buy Ubisoft Credits

                        Supported games
                        Black Desert SEA
                        Dragon Nest SEA
                        Travian: Legends
                        Ragnarok Online
                        World of Tanks
                        Conquer Online
                        Elsword
                        Habbo Hotel
                        And many more...
                        Read the full list on cherrycredits.com/Games
               `,
  }

  return (
    <div>
      <Header />
      <section className="px-4">
        <div className="grid grid-cols-2 gap-10 max-w-6xl m-auto py-10">
          <div className="p-10 bg-gray-200 flex justify-center items-center h-96">
            <img src={selectedProvider?.image} alt="provider image" />
          </div>
          <div>
            <div className="text-sm my-2 text-gray-600 font-medium">
              <p>Data &gt; {selectedProvider.product.provider}</p>
            </div>

            <h3 className="text-2xl font-medium">NTEL Refil</h3>

            <div className="notice border rounded-xl my-2">
              <p className="text-sm text-gray-700">
                This gift card is redeemable on the e-commerce platform & at the physical store
              </p>
            </div>
            <p className="my-3">
              Use Bitcoin, ETH or Crypto on NTEL. Pay with Bitcoin, Lightning, Ethereum, Binance
              Pay, USDT, USDC, Dogecoin, Litecoin, Dash. Instant email delivery. No account
              required. Start living on crypto!
            </p>
            <div>
              <h3 className="text-xl font-semibold">Enter Amount </h3>

              <div className="flex flex-col gap-0">
                <select
                  name=""
                  id=""
                  className="flex-1 rounded-lg border-gray-300 border-2  py-3 px-2"
                >
                  <option value="10"> 10NGN</option>
                </select>

                <div className="flex-1 text-sm mt-2 from-gray-800">Estimated price 0.0000BTC</div>
              </div>
            </div>

            <div>
              <div className="my-3">
                <CartButton> Add to Cart</CartButton>
              </div>

              <div className="my-4">
                <label htmlFor="phone_no my-2">Number to Top-Up</label>
                <input className="p-4 block border w-full rounded" placeholder="0801230456 7890" />
              </div>
            </div>
            <div className="bg-gray-600 flex items-center gap-3 rounded-lg text-white p-4">
              <span className="border rounded-full flex justify-center shrink-0">
                <ExclamationOutlined />
              </span>
              <p className="text-sm font-medium">We are currently out of stock on this product</p>
            </div>
            <div>
              <h3 className="text-2xl my-6 font-medium"> Description </h3>

              <div dangerouslySetInnerHTML={description} />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 bg-gray-200 py-10">
        <div className="max-w-7xl m-auto bg-red-40">
          <h2 className="text-2xl my-4">More Products on BitBridge</h2>
          <div className="grid sm:grid-cols-4 gap-3">
            {selectedProvider.map(({ id, product, name, min_value, max_value, currency }) => (
              <ProductCard
                link={`/phone-top-up/${id}`}
                key={id}
                id={id}
                provider={product.provider}
                currency={currency}
                provision={name}
                min_value={min_value}
                max_value={max_value}
              />
            ))}
          </div>
        </div>
      </section>
      <section className="px-4 py-20">
        <h2 className="text-3xl font-semibold">How gift card work</h2>
        <div></div>
      </section>
    </div>
  )
}

export default ViewGiftCard
