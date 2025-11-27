import { useNavigate } from 'react-router-dom'
import solar from '../../../../assets/images/deals/solar-installation.webp'
import cable from '../../../../assets/images/deals/cable.webp'
import mobile from '../../../../assets/images/deals/mobile.webp'
import ClickButton from '../../../../components/button/Button'

const ExclusiveDeals = () => {
  const navigate = useNavigate()
  const items = [
    {
      id: 1,
      promo: '10% on Solar Installation',
      offer: 'Get 10% on Solar installation services when you request on  BitBridge Global',
      img: solar,
      link: '#',
    },
    {
      id: 1,
      promo: 'Fast Cable Subscription',
      offer:
        'Experience effortless global connectivity in over 180 countries with BitBridge Global eSIMs at an unbeatable price',
      img: cable,
      link: '#',
    },
    {
      id: 1,
      promo: '50% Cashback on Mobile top up',
      offer:
        'Experience effortless global connectivity  with BitBridge Data subscription and mobile recharge at an unbeatable price',
      img: mobile,
      link: '#',
    },
  ]
  return (
    <section className="bg-black  px-4 text-white py-20">
      <div className="m-auto max-w-app-layout ">
        <h2 className="text-3xl lg:text-5xl my-5">Exclusive Black Friday Weekly Deals</h2>

        <div className="grid md:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id}>
              <div className="h-72 rounded overflow-hidden">
                <img
                  src={item.img}
                  alt={item.promo}
                  className="h-full w-full object-cover md:object-fill"
                />
              </div>
              <div className="py-10">
                <p className="text-2xl my-3 font-semibold">{item.promo}</p>
                <p>{item.offer}</p>
              </div>

              <ClickButton className={'!text-white'} onClick={() => navigate(item.link)}>
                Grab the Deal{' '}
              </ClickButton>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ExclusiveDeals
