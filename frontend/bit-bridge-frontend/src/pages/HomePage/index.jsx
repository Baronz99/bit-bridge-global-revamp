import { useNavigate } from 'react-router-dom'
import ClassicBtn from '../../components/button/ClassicButton'
import Header from '../../components/header/Header'
import ExxlusiveDeals from './components/deals/ExclusiveDeals'
import PopularCards from './components/popular-card/PopularCards'

import './style.scss'

const Home = () => {
  const navigate = useNavigate()

  const scrollToFeatures = () => {
    const el = document.getElementById('features')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="-mt-40 md:-mt-40">
      <Header />

      <main>
        {/* HERO */}
        <section className="hero-header px-4">
          <div className="max-w-app-layout mx-auto h-full min-h-[640px] lg:min-h-[720px] flex items-center">
            <div className="grid md:grid-cols-2 gap-10 w-full hero-grid">
              {/* LEFT – new main story */}
              <div className="p-5 mt-10 bg-slate-950/70 backdrop-blur rounded-2xl border border-slate-800">
                <p className="hero-eyebrow">
                  SOCIAL DIGITAL PAYMENTS
                </p>

                <h1 className="hero-title">
                  Modern digital payment solutions, powered by social finance.
                </h1>

                <p className="hero-subtitle">
                  Activate payment accounts through our banking partners, send to any Nigerian
                  bank, create shared wallets, and handle everyday bills &amp; airtime — all
                  from one secure platform.
                </p>

                <div className="mt-6 flex flex-wrap gap-2 text-[11px] text-slate-100">
                  <span className="chip-pill">Payment accounts</span>
                  <span className="chip-pill">Transfers to any bank</span>
                  <span className="chip-pill">Shared wallets &amp; groups</span>
                  <span className="chip-pill">Bills, airtime &amp; data</span>
                  <span className="chip-pill">Virtual cards for online spend</span>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <ClassicBtn
                    onclick={() => navigate('/login')}
                    className="text-base h-12 px-8 font-semibold"
                  >
                    Get started in seconds
                  </ClassicBtn>

                  <button
                    type="button"
                    onClick={scrollToFeatures}
                    className="text-sm text-slate-200 hover:text-white underline-offset-4 hover:underline"
                  >
                    Explore what you can do
                  </button>
                </div>

                {/* TRUST / POSITIONING STATS (no sensitive numbers) */}
                <div className="mt-8 hero-stat-grid text-xs text-slate-200">
                  <div className="hero-stat-card">
                    <p className="hero-stat-value">Partner-backed rails</p>
                    <p className="hero-stat-label">Bank-integrated payment infrastructure</p>
                  </div>
                  <div className="hero-stat-card">
                    <p className="hero-stat-value">Multi-channel access</p>
                    <p className="hero-stat-label">Web, mobile app &amp; dashboard</p>
                  </div>
                  <div className="hero-stat-card">
                    <p className="hero-stat-value">Social-first design</p>
                    <p className="hero-stat-label">Built for people, teams &amp; communities</p>
                  </div>
                </div>
              </div>

              {/* RIGHT – fresh “phone” snapshot */}
              <div className="mt-10 md:mt-0 flex items-center justify-center">
                <div className="hero-phone">
                  <div className="hero-phone-inner">
                    <div className="hero-phone-header">
                      <span className="hero-phone-dot" />
                      <span className="hero-phone-label">BitBridge Balance</span>
                      <span className="hero-phone-tag">Live</span>
                    </div>

                    <div className="hero-phone-balance">
                      <p className="hero-phone-balance-label">Total balance</p>
                      <p className="hero-phone-balance-value">₦245,300.00</p>
                    </div>

                    <div className="hero-phone-row">
                      <div className="hero-phone-pill">
                        <p className="hero-phone-pill-label">Payment account</p>
                        <p className="hero-phone-pill-value">0123 45 6789</p>
                      </div>
                      <div className="hero-phone-pill">
                        <p className="hero-phone-pill-label">Linked bank</p>
                        <p className="hero-phone-pill-value">Anchor</p>
                      </div>
                    </div>

                    <div className="hero-phone-section">
                      <p className="hero-phone-section-title">Today’s activity</p>
                      <ul className="hero-phone-list">
                        <li>
                          <span className="hero-phone-list-dot credit" />
                          <div>
                            <p className="hero-phone-list-title">Salary • Workplace Wallet</p>
                            <p className="hero-phone-list-meta">₦120,000 received</p>
                          </div>
                        </li>
                        <li>
                          <span className="hero-phone-list-dot debit" />
                          <div>
                            <p className="hero-phone-list-title">PHCN Bill • Shared Home Wallet</p>
                            <p className="hero-phone-list-meta">₦32,500 paid</p>
                          </div>
                        </li>
                        <li>
                          <span className="hero-phone-list-dot debit" />
                          <div>
                            <p className="hero-phone-list-title">Netflix • Virtual card</p>
                            <p className="hero-phone-list-meta">₦5,200 subscription</p>
                          </div>
                        </li>
                      </ul>
                    </div>

                    <div className="hero-phone-actions">
                      <button
                        type="button"
                        className="hero-phone-action primary"
                        onClick={() => navigate('/dashboard')}
                      >
                        Open dashboard
                      </button>
                      <button
                        type="button"
                        className="hero-phone-action ghost"
                        onClick={() => navigate('/utility-services')}
                      >
                        Pay a bill
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CORE FEATURES */}
        <section
          id="features"
          className="px-4 py-16 bg-slate-950 text-slate-100 border-t border-slate-800/60"
        >
          <div className="max-w-app-layout mx-auto">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
              <div>
                <p className="text-xs tracking-[0.3em] uppercase text-sky-300/80 mb-2">
                  WHY BITBRIDGE
                </p>
                <h2 className="text-2xl md:text-3xl font-semibold">
                  One platform for accounts, payments and shared money.
                </h2>
                <p className="mt-2 text-sm text-slate-300 max-w-xl">
                  BitBridge connects people, workplaces and communities through modern digital
                  payments — so the way money moves can finally match how you actually live and work.
                </p>
              </div>

              <div className="text-xs text-slate-400 max-w-sm">
                No more juggling multiple apps for accounts, bills and transfers. With BitBridge,
                everything sits in one experience that’s simple enough for everyday use and powerful
                enough for groups and organisations.
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              <div className="feature-card">
                <p className="feature-pill">Payment accounts &amp; transfers</p>
                <h3 className="feature-title">Accounts that plug into your life.</h3>
                <p className="feature-body">
                  Activate payment accounts through our banking partners, fund from your existing
                  banks and move money when you need to.
                </p>
                <ul className="feature-list">
                  <li>Dedicated payment accounts</li>
                  <li>Transfers to any Nigerian bank</li>
                  <li>Unified history across accounts &amp; wallet</li>
                </ul>
              </div>

              <div className="feature-card">
                <p className="feature-pill">Everyday payments</p>
                <h3 className="feature-title">Bills, airtime &amp; data in seconds.</h3>
                <p className="feature-body">
                  Handle the things you do every week — power, cable, airtime and data — without
                  stress or uncertainty.
                </p>
                <ul className="feature-list">
                  <li>Airtime &amp; data across major networks</li>
                  <li>Electricity, cable &amp; internet bills</li>
                  <li>Instant receipts and transaction history</li>
                </ul>
              </div>

              <div className="feature-card">
                <p className="feature-pill">Social finance layer</p>
                <h3 className="feature-title">Money that works in groups.</h3>
                <p className="feature-body">
                  Build shared wallets and payment flows for families, teams, estates and
                  organisations — with clear visibility for everyone involved.
                </p>
                <ul className="feature-list">
                  <li>Family &amp; beneficiary wallets</li>
                  <li>Workplace &amp; community payouts</li>
                  <li>Transparent timelines for shared bills</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Popular flows today */}
        <PopularCards />

        {/* Campaign / promos */}
        <ExxlusiveDeals />

        {/* App section */}
        <section id="app" className="py-20 px-4 bg-gray-100">
          <div className="max-w-4xl m-auto text-center">
            <h2 className="text-primary text-3xl md:text-4xl font-semibold mb-4">
              BitBridge in your pocket
            </h2>
            <p className="text-gray-600 text-sm md:text-base mb-6">
              Open payment accounts, send to any bank, pay bills and manage shared wallets — all
              from the BitBridge mobile app.
            </p>
          </div>
          <div className="flex justify-center items-center gap-4">
            <a
              target="_blank"
              rel="noreferrer"
              href="https://apps.apple.com/ng/app/bitbridge-utility/id6749049356"
            >
              <img src="/images/appstore.png" alt="app store" className="h-14" />
            </a>
            <a
              target="_blank"
              rel="noreferrer"
              href="https://play.google.com/store/apps/details?id=com.vortech.bitbridgeapp"
            >
              <img src="/images/playstore.png" alt="play store" className="h-14" />
            </a>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Home
