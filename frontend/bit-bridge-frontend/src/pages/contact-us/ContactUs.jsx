import HeroBanner from '../../components/hero/Hero'

import Header from '../../components/header/Header'
import Footer from '../../components/footer/Footer'
import { IoMdHome } from 'react-icons/io'
import { FaGlobe, FaInbox, FaPhoneAlt } from 'react-icons/fa'
const ContactUs = () => {
  return (
    <>
      <div>
        <Header />
        <HeroBanner extra={'Policies'} link={'contact us'} text={'Contact Us'} />

        <section className="py-10 px-5">
          <div></div>
        </section>

        <section id="contact-form" className="get-in-touch text-white py-20 px-4">
          <h3 className="text-5xl text-center font-semibold text-primary ">Get In Touch</h3>
          <p className="md:text-2xl my-5 text-center text-gray-700">
            Have questions? Reach out to our support team via email or live chat.
          </p>
          <div className="max-w-7xl items-center grid md:grid-cols-2 m-auto my-14">
            <div className="text-gray-600">
              <h2 className="font-semibold text-xl mb-4"> Link With Us</h2>
              <div className="flex items-center gap-4 mb-4">
                <IoMdHome className="text-xl" />
                <p className="font-medium">plot 40, cluster 4, Riverpark estate Lugbe, Abuja</p>
              </div>

              <div className="">
                <a className="flex items-center gap-4 mb-4 font-medium" href="tel:+2349064619436">
                  <FaPhoneAlt />
                  <span>+2349064619436</span>
                </a>
              </div>
              <div>
                <a
                  className="flex items-center gap-4 mb-4 font-medium"
                  href="mailto:support@bitbridgeglobal.com"
                >
                  <FaInbox />
                  <span>support@bitbridgeglobal.com</span>
                </a>
                <p></p>
              </div>

              <div>
                <a
                  className="flex items-center gap-4 mb-4 font-medium"
                  href="https://bitbridgeglobal.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FaGlobe />
                  <p>https://bitbridgeglobal.com</p>
                </a>
              </div>
            </div>

            <div>
              <p className="text-left font-medium text-gray-600 max-w-4xl m-auto my-6">
                Need assistance? Simply fill out our contact form with your details and inquiry, and
                our support team will get back to you as soon as possible. We’re here to help with
                any questions or concerns you may have.
              </p>

              <form
                action="https://formspree.io/f/mrbqzqzk"
                method="POST"
                className="max-w-7xl m-auto md:p-5 border-[5px] px-1 border-gray-300"
              >
                <div className="flex flex-col md:flex-row gap-6 my-6">
                  <div className="flex-1">
                    <label htmlFor="name"></label>
                    <input
                      type="text"
                      placeholder="Name"
                      name="name"
                      className="border rounded p-5 focus:border-none text-gray-900 w-full font-semibold"
                    />
                  </div>

                  <div className="flex-1">
                    <label htmlFor="email">
                      <input
                        type="text"
                        placeholder="Email"
                        name="email"
                        className="p-5 rounded focus:outline-none text-gray-900 w-full font-semibold"
                      />
                    </label>
                  </div>
                </div>
                <div className="my-6">
                  <div className="flex-1">
                    <label htmlFor="phone_no">
                      <input
                        type="text"
                        placeholder="Phone Number"
                        name="Phone Number"
                        className="p-5 rounded focus:outline-none text-gray-900 w-full font-semibold"
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <textarea
                    name="message"
                    id="message"
                    placeholder="Message"
                    className="p-5 focus:outline-none h-40 rounded-lg text-gray-900 w-full font-semibold"
                  ></textarea>
                </div>

                <div>
                  <button className="py-4 px-14 w-full bg-gray-900 my-5 rounded ">Submit</button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  )
}

export default ContactUs
