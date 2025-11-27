import Footer from '../../components/footer/Footer'
import Header from '../../components/header/Header'
import HeroBanner from '../../components/hero/Hero'

const PrivacyPolicies = () => {
  return (
    <>
      <main>
        <Header />
        <HeroBanner link="policies" extra="privacy" text={'Privacy Policy'} />

        <section className="px-4">
          <div className="max-w-7xl m-auto my-10">
            <h3 className="text-2xl font-semibold my-4"> Privacy Policy</h3>

            <p className="my-3">
              <strong> Effective Date</strong> March 2025
            </p>
            <p>
              <strong> Last Updated Date</strong> March 2025
            </p>

            <div className="my-4">
              <p className="font-semibold text-gray-900 mt-5">1. Introduction</p>
              <p className="my-3 pl-4">
                Bit Bridge Global is committed to protecting your privacy and ensuring the security
                of your personal information. This Privacy Policy outlines how we collect, use,
                disclose, and safeguard your information when you access our platform to pay utility
                bills and mobile top-ups. By using our services, you consent to the practices
                described in this policy.{' '}
              </p>
            </div>
            <div className="my-4">
              <p className="font-semibold text-gray-900 mt-5">2. Information We Collect </p>
              <p className="my-3 pl-4">
                We collect various types of information to provide, improve, and secure our services
              </p>
              <ul className="list-inside list-item pl-8">
                <li>
                  <h5 className="font-semibold text-gray-900 my-2">
                    {' '}
                    A. Information You Provide Directly
                  </h5>
                  <ul className="pl-2">
                    <li className="my-2">
                      {' '}
                      <strong className="mr-3 text-gray-700">Account Information</strong> Name,
                      email address, postal address,  phone number.{' '}
                    </li>
                    <li className="my-2">
                      {' '}
                      <strong className="mr-3 my-5 text-gray-700">Payment Information</strong>{' '}
                      Billing details and transaction history when making payments (excluding full
                      credit/debit card details, which are processed securely by third-party
                      providers){' '}
                    </li>
                    <li className="my-2">
                      {' '}
                      <strong className="mr-3 my-3 text-gray-700">
                        Customer Support Data
                      </strong>{' '}
                      Communications and inquiries submitted to our support team{' '}
                    </li>
                  </ul>
                </li>
              </ul>
              <ul className="list-inside my-8 list-item pl-8">
                <li>
                  <h5 className="font-semibold text-gray-900 my-2">
                    {' '}
                    B. Information Collected Automatically{' '}
                  </h5>
                  <ul className="pl-2">
                    <li className="my-2">
                      {' '}
                      <strong className="mr-3 text-gray-700">Device and Usage Data:</strong> IP
                      address, device type, operating system, browser type, and access
                      timestamps.{' '}
                    </li>
                    <li className="my-2">
                      {' '}
                      <strong className="mr-3 my-5 text-gray-700">Transaction History:</strong>{' '}
                      Records of payments made through our platform.{' '}
                    </li>
                    <li className="my-2">
                      {' '}
                      <strong className="mr-3 my-3 text-gray-700">
                        Cookies and Tracking Technologies:
                      </strong>{' '}
                      We use cookies to enhance your experience, analyze usage trends, and improve
                      our services.{' '}
                    </li>
                  </ul>
                </li>
              </ul>
              <ul className="list-inside my-8 list-item pl-8">
                <li>
                  <h5 className="font-semibold text-gray-900 my-2">
                    C. Information from Third Party
                  </h5>
                  <ul className="pl-2">
                    <li className="my-2">
                      {' '}
                      <strong className="mr-3 text-gray-700">
                        Financial Institutions and Payment Processors:
                      </strong>{' '}
                      To verify transactions and prevent fraud.
                    </li>
                    <li className="my-2">
                      {' '}
                      <strong className="mr-3 my-5 text-gray-700">
                        Identity Verification Services:
                      </strong>{' '}
                      Where required by law or platform security policies{' '}
                    </li>
                    {/* <li className='my-2'> <strong className='mr-3 my-3 text-gray-700'> How We Use Your Information:</strong>  We use cookies to enhance your experience, analyze usage trends, and improve our services.          </li> */}
                  </ul>
                </li>
              </ul>
            </div>

            <div className="my-4">
              <p className="font-medium text-gray-900 mt-5">3. How We Use Your Information</p>
              <p className="my-3 pl-4">Your data is used for the following purposes:</p>
              <ul className="list-inside list-disc pl-8">
                <li className="my-2">
                  {' '}
                  <strong className="mr-3 text-gray-700">Service Delivery</strong> Processing
                  payments, managing accounts, and providing customer support.{' '}
                </li>
                <li className="my-2">
                  {' '}
                  <strong className="mr-3 text-gray-700">Security and Fraud Prevention</strong>{' '}
                  Detecting, preventing, and mitigating security threats and fraudulent
                  activities.{' '}
                </li>
                <li className="my-2">
                  {' '}
                  <strong className="mr-3 text-gray-700">Platform Optimization</strong> Enhancing
                  user experience and improving the functionality of our platform.{' '}
                </li>
                <li className="my-2">
                  {' '}
                  <strong className="mr-3 text-gray-700">
                    Legal and Regulatory Compliance
                  </strong>{' '}
                  Ensuring adherence to financial regulations and legal requirements.{' '}
                </li>
                <li className="my-2">
                  {' '}
                  <strong className="mr-3 text-gray-700">Marketing and Communication</strong>{' '}
                  Sending important service updates, promotional offers, and newsletters (you can
                  opt out at any time).{' '}
                </li>
              </ul>
            </div>

            <div className="my-4">
              <p className="font-medium text-gray-900 mt-5">4. How We Share Your Information </p>
              <p className="pl-4">
                We do not sell your personal data. However, we may share your information with
              </p>
              <ul className="list-inside list-disc pl-8">
                <li className="my-2">
                  {' '}
                  <strong className="mr-3 text-gray-700">Service Providers</strong> Third-party
                  partners who assist in payment processing, cloud storage, customer support, and
                  analytics{' '}
                </li>
                <li className="my-2">
                  {' '}
                  <strong className="mr-3 text-gray-700">Regulatory Authorities</strong> When
                  required by law or to comply with legal and regulatory obligations.{' '}
                </li>
                <li className="my-2">
                  {' '}
                  <strong className="mr-3 text-gray-700">Business Partners</strong>If you opt to use
                  third-party integrations within our platform{' '}
                </li>
                <li className="my-2">
                  {' '}
                  <strong className="mr-3 text-gray-700">Fraud Prevention Agencies</strong> To
                  safeguard against unauthorized transactions.{' '}
                </li>
              </ul>
            </div>
            <div></div>
            <div>
              <p className="font-medium text-gray-900 mt-5">5. Data Security Measure</p>
              <p className="pl-4">
                We implement industry-leading security measures to protect your personal
                information, including
              </p>
              <ul className="list-inside list-disc pl-4">
                <li className="my-2">
                  {' '}
                  <strong className="mr-3 text-gray-700">End-to-End Encryption</strong> Secure
                  transmission of sensitive data.{' '}
                </li>
                <li className="my-2">
                  {' '}
                  <strong className="mr-3 text-gray-700">Data Minimization</strong> Storing only the
                  necessary information required for service functionality{' '}
                </li>
                <li className="my-2">
                  {' '}
                  <strong className="mr-3 text-gray-700">Access Controls</strong> Restricting
                  unauthorized access to personal data{' '}
                </li>
                <li className="my-2">
                  {' '}
                  <strong className="mr-3 text-gray-700">Regular Security Audits</strong> Ongoing
                  vulnerability assessments and compliance checks.{' '}
                </li>
              </ul>
            </div>

            <p className="font-medium text-gray-900 mt-5">6. Your Rights and Choices</p>
            <p className="pl-4">
              You have control over your personal data and can exercise the following rights{' '}
            </p>
            <ul className="list-inside list-disc pl-4">
              <li className="my-2">
                {' '}
                <strong className="mr-3 text-gray-700">Access & Correction</strong> <br />
                Review and update your account information at any time.{' '}
              </li>
              <li className="my-2">
                {' '}
                <strong className="mr-3 text-gray-700">Data Portability</strong> <br /> Request a
                copy of your personal data in a structured format{' '}
              </li>
              <li className="my-2">
                {' '}
                <strong className="mr-3 text-gray-700">Opt-Out of Marketing</strong> <br />{' '}
                Unsubscribe from promotional communications{' '}
              </li>
              <li className="my-2">
                {' '}
                <strong className="mr-3 text-gray-700">Account Deletion</strong> <br /> Request
                permanent deletion of your account and associated data{' '}
              </li>
            </ul>
            <div className="my-4">
              <p className="font-medium text-gray-900 mt-5">7. Cookies & Tracking Technologies</p>
              <p className="pl-4">
                We use cookies to improve your browsing experience. You can manage your cookie
                preferences through your browser settings. Disabling cookies may affect certain
                features of the platform.
              </p>
            </div>
            <div className="my-4">
              <p className="font-medium text-gray-900 mt-5 "> 8. International Data Transfers</p>
              <p className="pl-4">
                If you access our services from outside our primary operational region, your data
                may be transferred and stored in jurisdictions with different data protection laws.
                We ensure that such transfers comply with applicable legal frameworks.
              </p>
            </div>
            <div className="my-4">
              <p className="font-medium text-gray-900 mt-5">9. Updates to This Privacy Policy</p>
              <p className="pl-4">
                We may update this Privacy Policy periodically to reflect changes in our practices
                or regulatory requirements. We will notify users of significant changes via email or
                platform notifications.{' '}
              </p>
            </div>

            <div className="my-4">
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
            </div>

            <p></p>
            <div className="font-medium text-gray-700">
              <p>
                BitBridge reserves the right to update these terms at any time. Continued use of the
                platform constitutes acceptance of any changes.{' '}
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

export default PrivacyPolicies
