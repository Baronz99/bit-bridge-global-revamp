import { NavLink } from 'react-router-dom'
import Footer from '../../components/footer/Footer'
import Header from '../../components/header/Header'
import HeroBanner from '../../components/hero/Hero'

const SiteMap = () => {
  return (
    <>
      <main className="">
        <Header />
        <HeroBanner link="policies" extra="site map" text={'Site Map'} />

        <section className=" py-10 px-4 ">
          <div className="m-auto mx-10">
            <ul className="space-y-10 list-disc">
              <li>
                <NavLink to={'/'} className={'text-primary font-semibold'}>
                  {' '}
                  Home Page{' '}
                </NavLink>
              </li>
              <li>
                <NavLink to={'/utility-services'} className={'text-primary font-semibold'}>
                  {' '}
                  utility services{' '}
                </NavLink>
              </li>
              <li>
                <NavLink to={'/phone-top-up'} className={'text-primary font-semibold'}>
                  {' '}
                  Phone Top-up{' '}
                </NavLink>
              </li>
              <li>
                <NavLink to={'/contact-us'} className={'text-primary font-semibold'}>
                  {' '}
                  Contact us{' '}
                </NavLink>
              </li>
              {/* <li><NavLink to={"/"} className={"text-primary font-semibold"}> Home Page </NavLink></li> */}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

export default SiteMap
