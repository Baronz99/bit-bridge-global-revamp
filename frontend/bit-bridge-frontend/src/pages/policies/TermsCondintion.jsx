import Footer from '../../components/footer/Footer'
import Header from '../../components/header/Header'
import HeroBanner from '../../components/hero/Hero'

const TermsCondintion = () => {
  return (
    <>
      <main className="">
        <Header />
        <HeroBanner link="policies" extra="terms and conditions" text={'Terms and Condition'} />

        <section className="px-4">
          <div className="max-w-7xl m-auto my-10">
            {/* <h3 className="text-2xl font-semibold my-4"> Privacy Policy</h3> */}

            <p className="my-3">
              <strong> Effective Date</strong> March 2025
            </p>
            <p>
              <strong> Last Updated Date</strong> March 2025
            </p>

            <div className="my-4">
              <p className="font-semibold text-gray-900 mt-5">1. Introduction</p>
              <p className="my-3 pl-4">
                Welcome to Bit Bridge Global! These Terms and Conditions govern your access to and
                use of our platform, which allows users to pay utility bills and purchase mobile
                top-ups. By using our services, you agree to comply with these terms. If you do not
                agree, please discontinue use of our platform.
              </p>
            </div>
            <div className="my-4">
              <p className="font-semibold text-gray-900 mt-5">2. Eligibility </p>
              <p className="my-3 pl-4">To use our services, you must:</p>

              <ul className="pl-2">
                <li className="my-2">
                  - Be at least 18 years old or the legal age in your jurisdiction.{' '}
                </li>
                <li className="my-2">
                  {' '}
                  - Provide accurate and up-to-date personal and payment information.{' '}
                </li>
                <li className="my-2"> - Use the platform for lawful purposes only.</li>
              </ul>
            </div>

            <div className="my-4">
              <p className="font-medium text-gray-900 mt-5">3. Account Registration</p>
              <p className="my-3 pl-4">Your data is used for the following purposes:</p>
              <ul className="list-inside list-dis pl-8">
                <li className="my-2">
                  {' '}
                  - You are responsible for maintaining the confidentiality of your account
                  credentials.
                </li>
                <li className="my-2"> - Any activity under your account is your responsibility.</li>
                <li className="my-2">
                  - Notify us immediately if you suspect unauthorized access or security breaches.
                </li>
              </ul>
            </div>

            <div className="my-4">
              <p className="font-medium text-gray-900 mt-5">4. Services Offered </p>
              <p className="pl-4">
                Bit Bridge Global provides digital payment solutions for utility bills and mobile
                top-ups. We work with third-party service providers and are not responsible for
                service disruptions caused by them.
              </p>
            </div>
            <div></div>
            <div>
              <p className="font-medium text-gray-900 mt-5">5. Payments and Transactions</p>
              <p className="pl-4">
                We implement industry-leading security measures to protect your personal
                information, including
              </p>
              <ul className="list-inside list-dis pl-4">
                <li className="my-2"> - All payments are processed securely.</li>
                <li className="my-2">
                  {' '}
                  - Transactions are final and non-refundable unless required by law or explicitly
                  stated in our refund policy.
                </li>
                <li className="my-2">
                  - You agree to provide accurate payment details and authorize us to process
                  transactions on your behalf.
                </li>
              </ul>
            </div>

            <p className="font-medium text-gray-900 mt-5">6. Fees and Charges</p>
            <ul className="list-inside list-dis pl-4">
              <li className="my-2"> - Certain transactions may be subject to processing fees.</li>
              <li className="my-2">- Fees will be disclosed before confirming a transaction.</li>
              <li className="my-2">- We reserve the right to modify fees with prior notice.</li>
            </ul>
            <div className="my-4">
              <p className="font-medium text-gray-900 mt-5">7. Prohibited Activities</p>
              <p className="pl-4">
                You agree not to:
                <ul className="list-inside list-dis pl-4">
                  <li className="my-2">
                    {' '}
                    - Use the platform for fraudulent, illegal, or unauthorized activities.
                  </li>
                  <li className="my-2">
                    - Tamper with or disrupt the security and functionality of the platform.
                  </li>
                  <li className="my-2">
                    - Violate any applicable laws, regulations, or third-party rights.
                  </li>
                </ul>
              </p>
            </div>
            <div className="my-4">
              <p className="font-medium text-gray-900 mt-5 "> 8. Intellectual Property</p>
              <ul className="list-inside list-dis pl-4">
                <li className="my-2">
                  {' '}
                  All content, logos, and trademarks on Bit Bridge Global are our exclusive property
                  or licensed for use.{' '}
                </li>
                <li className="my-2">
                  - You may not copy, modify, distribute, or exploit our intellectual property
                  without prior written consent.{' '}
                </li>
              </ul>
            </div>
            <div className="my-4">
              <p className="font-medium text-gray-900 mt-5">9. Privacy and Data Protection</p>
              <ul className="list-inside list-dis pl-4">
                <li className="my-2">
                  {' '}
                  - We collect and process personal data in accordance with our [Privacy Policy].
                </li>
                <li className="my-2">
                  - Your use of our services constitutes consent to our data handling practices.
                </li>
              </ul>
            </div>

            <div className="my-4">
              <p className="font-medium text-gray-900 mt-5">10. Limitation of Liability</p>
              <ul className="list-inside list-dis pl-4">
                <li className="my-2">
                  {' '}
                  - Bit Bridge Global is not liable for indirect, incidental, or consequential
                  damages resulting from the use of our services.{' '}
                </li>
                <li className="my-2">
                  - We do not guarantee uninterrupted or error-free service and are not responsible
                  for losses due to system failures or third-party issues.{' '}
                </li>
              </ul>
            </div>

            <div className="my-4">
              <p className="font-medium text-gray-900 mt-5">11. Suspension and Termination</p>
              <ul className="list-inside list-dis pl-4">
                <li className="my-2">
                  - We reserve the right to suspend or terminate accounts suspected of violating
                  these terms.{' '}
                </li>
                <li className="my-2">
                  - Users may also terminate their accounts by submitting a request to customer
                  support.{' '}
                </li>
              </ul>
            </div>

            <div className="my-4">
              <p className="font-medium text-gray-900 mt-5">12. Amendments to These Terms</p>
              <ul className="list-inside list-dis pl-4">
                <li className="my-2"> - We may update these Terms and Conditions at any time.</li>
                <li className="my-2">
                  - Continued use of our platform after changes indicates your acceptance of the
                  updated terms.
                </li>
              </ul>
            </div>
            <div className="my-4">
              <p className="font-medium text-gray-900 mt-5">
                13. Governing Law and Dispute Resolution
              </p>
              <ul className="list-inside list-dis pl-4">
                <li className="my-2">
                  - These terms are governed by the laws of Federal Republic of Nigeria.
                </li>
                <li className="my-2">
                  - Disputes shall first be resolved through negotiation, and if unresolved, through
                  arbitration or legal proceedings in the appropriate jurisdiction.
                </li>
              </ul>
            </div>
            <div className="my-4">
              <p className="font-medium text-gray-900 mt-5">14. Contact Information</p>
              <p>For inquiries or concerns regarding these Terms and Conditions, contact us:</p>

              <p className="font-medium text-gray-900 mt-5">Contact Us</p>
              <p className="pl-4">
                If you have any questions or concerns about this Privacy Policy or your data, please
                contact us{' '}
              </p>
              <p>
                <a href="mailto:support@bitbridgeglobal.com" className="underline text-blue-600">
                  {' '}
                  Email: <span>support@bitbridgeglobal.com </span>{' '}
                </a>
              </p>
              <p>
                <a href="tel:+234 90 6461 9436" className="underline text-blue-600">
                  Phone: <span>234 90 6461 9436</span>
                </a>
              </p>

              <p>
                BitBridge reserves the right to update these terms at any time. Continued use of the
                platform constitutes acceptance of any changes.{' '}
              </p>
            </div>

            <div className="my-4"></div>

            <p></p>
            <div className="font-medium text-gray-700"></div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

export default TermsCondintion
