import { useNavigate } from 'react-router-dom'
import cable from '../../../../assets/images/deals/cable.webp'
import mobile from '../../../../assets/images/deals/mobile.webp'
import pexels1 from '../../../../assets/images/deals/pexels-julia-m-cameron-4144038.jpg'
import pexels2 from '../../../../assets/images/deals/pexels-n-voitkevich-6214473.jpg'

import ClickButton from '../../../../components/button/Button'

const ExclusiveDeals = () => {
  const navigate = useNavigate()

  const items = [
    {
      id: 1,
      promo: 'Instant bill payments',
      offer:
        'Settle power, cable TV and internet in seconds — no queues, no scratch cards, no stress.',
      img: cable,
      link: '/utility-services',
    },
    {
      id: 2,
      promo: 'Payment accounts & virtual cards',
      offer:
        'Use BitBridge as the home for your payment accounts and virtual cards for subscriptions, online services and safer digital spend.',
      img: pexels2,
      link: '/dashboard/virtual-account',
    },
    {
      id: 3,
      promo: 'Mobile data & airtime that just works',
      offer:
        'Top up airtime and data for yourself or loved ones instantly across major networks — from one simple balance.',
      img: pexels1,
      link: '/phone-top-up',
    },
  ]

  return (
    <section className="bg-black px-4 text-white py-20">
      <div className="m-auto max-w-app-layout">
        <h2 className="text-3xl lg:text-5xl my-5">
          Built around how you actually pay.
        </h2>
        <p className="text-slate-300 max-w-2xl mb-8">
          BitBridge brings payment accounts, utilities, virtual cards and everyday payments
          into one experience — so you stay in control without juggling multiple apps.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden"
            >
              {/* Fixed-height image area, no distortion */}
              <div className="h-64 rounded-t-3xl overflow-hidden">
                <img
                  src={item.img}
                  alt={item.promo}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Fixed-height content area to keep cards aligned */}
              <div className="py-6 px-4 flex flex-col justify-between h-52">
                <div>
                  <p className="text-xl my-2 font-semibold">{item.promo}</p>
                  <p className="text-sm text-slate-200">{item.offer}</p>
                </div>

                <ClickButton
                  className="!text-white mt-4"
                  onClick={() => navigate(item.link)}
                >
                  Explore
                </ClickButton>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ExclusiveDeals
