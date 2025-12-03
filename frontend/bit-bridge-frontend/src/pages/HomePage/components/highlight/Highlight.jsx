import { recommendedData } from '../../../../data/recommended'
import ClassicBtn from '../../../../components/button/ClassicButton'

import 'react-responsive-carousel/lib/styles/carousel.min.css'
import { Carousel } from 'react-responsive-carousel'
import { useNavigate } from 'react-router-dom'

const HighlightInfo = () => {
  const navigate = useNavigate()

  const items = [
    {
      id: 1,
      image: '/backgrounds/fast-browsing.webp',
      text: 'See every payment account credit, top-up and bill in one clean history — no more scattered receipts.',
    },
    {
      id: 2,
      image: '/backgrounds/swipe-2.jpg',
      text: 'Move money with confidence: pay electricity, cable and data instantly from your BitBridge balance or linked accounts.',
    },
    {
      id: 3,
      image: '/backgrounds/swipe-3.jpg',
      text: 'Soon: shared wallets for families, flatmates, teams and communities — everyone sees what was paid, and when.',
    },
  ]

  return (
    <section className="px-4 py-10 bg-gray-900/10">
      <div className="grid lg:grid-cols-home-grid gap-4 max-w-app-layout m-auto">
        <div>
          <h5 className="text-lg font-bold text-gray-800 my-4">
            BitBridge in action
          </h5>
          <div className="rounded text-white overflow-hidden">
            <Carousel
              autoFocus
              autoPlay
              infiniteLoop
              showThumbs={false}
              showStatus={false}
              showArrows
            >
              {items.map((item) => (
                <div key={item.id} className="w-full h-[380px] relative">
                  <img src={item.image} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/70 to-slate-700/40 z-10">
                    <div className="h-full px-5 md:w-3/4 flex flex-col justify-center">
                      <h2 className="md:text-2xl text-xl font-semibold leading-relaxed mb-4">
                        {item.text}
                      </h2>

                      <ClassicBtn
                        className="text-sm h-11 px-6 text-alt font-semibold"
                        onclick={() => navigate('/login')}
                      >
                        Start with BitBridge
                      </ClassicBtn>
                    </div>
                  </div>
                </div>
              ))}
            </Carousel>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-800 text-lg my-4">Popular shortcuts</h3>

          <div className="grid grid-cols-2 gap-3 gap-y-5">
            {recommendedData.map((item) => (
              <div
                onClick={() => navigate(item.link)}
                key={item.id}
                className="border border-gray-300/60 bg-white shadow-sm overflow-hidden rounded-xl cursor-pointer hover:-translate-y-1 transition-transform duration-200"
              >
                <div className="h-32">
                  <img
                    className="w-full h-full hover:scale-105 transition-transform duration-300 ease-out"
                    src={item.image}
                    alt={item.name}
                  />
                </div>

                <p className="text-sm my-3 font-semibold px-4">{item.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default HighlightInfo
