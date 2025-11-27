import Footer from '../../components/footer/Footer'
import Header from '../../components/header/Header'
import HeroBanner from '../../components/hero/Hero'

const AboutUs = () => {
  return (
    <>
      <div>
        <Header />
        <HeroBanner link={'About Us'} extra={'Policies'} text={'About Us'} />

        <section id="contact-form" className="get-in-touch text-white py-10 px-4">
          <div className="max-w-4xl  m-auto my-14">
            <h3 className="text-5xl text-left font-semibold text-primary ">Who We Are?</h3>
            <p className="md:text-lg my-5 text-justify text-gray-700">
              Bit Bridge Global is a trusted digital payment platform designed to make financial
              transactions seamless, secure, and efficient. We specialize in utility payment
              services and connecting buyers to sellers in our online market place.{' '}
            </p>

            <h3 className="text-2xl text-primary font-semibold"> Why Choose Bit Bridge Global? </h3>
            <p className="md:text-base my-5 text-justify text-gray-700">
              We stand out as a reliable and customer-centric platform committed to simplifying
              financial transactions. Here’s why thousands trust us:
            </p>
            <div>
              <p className="text-gray-800 text-base my-4 font-normal">
                <span className="font-semibold">✅ Fast Transactions –</span> Enjoy instant
                processing for bill payments.
              </p>
            </div>

            <div>
              <p className="text-gray-800 text-base my-4 font-normal">
                <span className="font-semibold">✅ Secure & Reliable –</span> Your data and
                transactions are safeguarded with industry-leading security measures
              </p>
            </div>
            {/* <div>
              <p className="text-gray-800 text-base my-4 font-normal">
                <span className="font-semibold">✅ Competitive Rates –</span> Get the best market
                value for your gift card trades
              </p>
            </div> */}
            <div>
              <p className="text-gray-800 text-base my-4 font-normal">
                <span className="font-semibold">✅ 24/7 Customer Support –</span> Our dedicated team
                is always available to assist you
              </p>
            </div>
            <div>
              <p className="text-gray-800 text-base my-4 font-normal">
                <span className="font-semibold">✅ User-Friendly Experience –</span> Our platform is
                designed for smooth navigation on both desktop and mobile devices.
              </p>
            </div>

            <div>
              <h3 className="text-2xl text-primary font-semibold"> Our Services </h3>

              {/* <div>
                <p className="text-gray-800 text-base my-4 font-semibold">
                  1. Trade Gift Cards for Instant Cash
                </p>
                <p className="text-gray-800 px-4 font-semibold">
                  Got unused or unwanted gift cards? Convert them into cash effortlessly! We support
                  a wide range of gift cards, offering <bold>competitive rates</bold> and{' '}
                  <bold>instant payouts</bold>
                </p>
              </div> */}
              <div>
                <p className="text-gray-800 text-base my-4 font-semibold">
                  1. Pay Utility Bills with Ease
                </p>
                <p className="text-gray-800 px-4 font-semibold">
                  Never worry about missing a payment again! With Bit Bridge Global, you can settle
                  your essential bills quickly and securely, including:
                </p>
                <ul className="list-disc list-inside my-3 text-gray-700 font-normal">
                  <li>Electricity Bills</li>
                  <li>Water Bills</li>
                  <li>Internet & Cable Subscriptions</li>
                  <li>Mobile Airtime & Data Top-ups</li>
                </ul>
                <p className="text-gray-800 my-6 text-base">
                  We partner with multiple service providers to ensure you stay connected and
                  powered up at all times. Comprehensive Support for Your Payment Needs*
                </p>
              </div>

              <div className="my-6">
                <p className="text-gray-700">
                  We go beyond just transactions – we are committed to providing exceptional
                  customer service. Whether you need assistance with bill payments, or navigating
                  our platform, our team of experts is here to offer personalized guidance and
                  ensure a seamless experience.
                </p>

                <p className="text-xl text-primary font-semibold my-4"> How It Works</p>
                <p>
                  <p className="text-gray-700 my-3 font-semibold ">For Utility Bill Payments:</p>
                  <ul className="text-gray-800 list-disc list-inside">
                    <li className="text-gray-700">Choose the bill you want to pay.</li>
                    <li>Enter your account details and billing amount.</li>
                    <li>Complete the payment securely.</li>
                    <li>Receive a confirmation instantly!</li>
                  </ul>

                  <p className="text-gray-700 my-5 text-xl ">Legally Certified & Registered</p>

                  <p className="text-gray-700 font-semibold my-0">
                    Bit Bridge Global is officially certified to provide these services. We are
                    registered under <strong> The Registrar - General Affairs Commission</strong>{' '}
                    with <strong> Company Registration No. 8178481 </strong>. Our compliance with
                    legal and regulatory standards ensures that you can transact with complete
                    confidence. Join Thousands of Happy Users!
                  </p>

                  <p className="text-base text-gray-800 my-5">
                    {' '}
                    Experience the convenience of paying your bills with *Bit Bridge Global*.
                    Get started today!{' '}
                  </p>
                </p>
              </div>
            </div>

            <p></p>
          </div>
        </section>
      </div>
      <Footer />
    </>
  )
}

export default AboutUs
