# frozen_string_literal: true

# Ensure the existence of records required to run the application in every environment (production, development, test).
# This script is idempotent, meaning it can be run multiple times without creating duplicate records.

# Create a default user
puts 'seeding data....'
User.find_or_create_by!(email: 'emmiemenz@gmail.com') do |user|
  user.password = 'chemistry101'
  user.role = 'admin'
end

# Seed product
products = [
  {
    featured: false,
    extra_info: 'Get the best of secure browsing and privacy.',
    provider: 'nordVpn',
    image: '/images/gift-cards/nordvpn-international.webp',
    provision: 'Standard Software Subscription',
    min_value: 5.0,
    max_value: 50_000.0,
    header_info: "Secure your online activities with NordVPN's fast and reliable VPN service.",
    description: 'NordVPN is a premium VPN service that provides top-notch security, privacy, and anonymity for your online activities. With NordVPN, you can protect up to 6 devices with one subscription, enjoy unlimited bandwidth, and access restricted content from anywhere in the world. Whether you are streaming, gaming, or browsing, NordVPN offers lightning-fast servers in 59 countries. Use NordVPN to unblock geo-restricted websites and services, ensuring a secure and private browsing experience. This gift card allows you to purchase NordVPN subscriptions or renew your existing plan. Start your journey to online security today by redeeming this gift card on the NordVPN website. For instructions on how to redeem, visit nordvpn.com/redeem.',
    rate: 4.7,
    category: 1, # "gift card"
    currency: 0, # "NGN"
    info: 'This is for the NordVPN Standard Software Subscription for 6 devices. Use it to enhance your online security.',
    attention: nil,
    notice_info: 'Please ensure your device meets the system requirements for NordVPN before purchasing.'
  },
  {
    featured: false,
    extra_info: 'Shop at Spar outlets across Nigeria.',
    provider: 'spar',
    image: '/images/gift-cards/spar-market-nigeria.webp',
    provision: 'Gift Card',
    min_value: 5.0,
    max_value: 50_000.0,
    header_info: 'Enjoy seamless shopping at Spar outlets with this gift card.',
    description: "The Spar gift card is your gateway to a premium shopping experience at any Spar outlet in Nigeria. Use this card to purchase groceries, home essentials, electronics, and much more. Spar is known for its wide variety of quality products at competitive prices. Whether you're looking to stock your pantry or buy the latest gadgets, this gift card makes shopping convenient and rewarding. Simply present this gift card at checkout to enjoy a seamless shopping experience. Redeemable at all participating Spar locations, this card is the perfect gift for friends and family who love shopping. For detailed redemption steps, visit sparnigeria.com.",
    rate: 4.7,
    category: 1, # "gift card"
    currency: 0, # "NGN"
    info: 'This gift code may only work in Nigeria. Redeemable at all Spar outlets nationwide.',
    attention: nil,
    notice_info: "Gift card validity and balance are subject to Spar's terms and conditions."
  },
  {
    featured: false,
    extra_info: 'Enjoy exclusive PlayStation content and subscriptions.',
    provider: 'playstation',
    image: '/images/gift-cards/sony-playstation-usa.webp',
    provision: 'Digital Gaming Services',
    min_value: 10.0,
    max_value: 250.0,
    header_info: 'Access PlayStation games, add-ons, and media with this gift card.',
    description: "The PlayStation gift card is your gateway to the ultimate gaming experience. Use it to purchase games, add-ons, movies, music, and more on the PlayStation Store. Access exclusive PlayStation Plus memberships, which grant you free monthly games, online multiplayer, and special discounts. With this card, you can enjoy titles like God of War, Horizon Zero Dawn, and Gran Turismo. Redeem your PlayStation gift card on any USA-region PlayStation Network account. It's the perfect gift for gamers who want to explore a vast library of digital content. Instructions for redemption can be found at playstation.com/redeem.",
    rate: 4.7,
    category: 1, # "gift card"
    currency: 1, # "USD"
    info: 'Only valid for accounts with USA as selected region. Region is selected during PlayStation account creation.',
    attention: 'This gift card is not refundable once purchased. Please ensure your account region is correct.',
    notice_info: 'Redeem on the PlayStation Store within the USA region.'
  },
  {
    featured: false,
    extra_info: 'Perfect for gamers who love the Steam platform.',
    provider: 'steam',
    image: '/images/gift-cards/steam-usa.webp',
    provision: 'Digital Gaming Services',
    min_value: 5.0,
    max_value: 100.0,
    header_info: 'Unlock endless gaming opportunities with Steam Wallet funds.',
    description: 'Steam gift cards provide you with access to one of the largest gaming platforms in the world. Redeem your Steam gift card to add funds to your Steam Wallet, which can be used to purchase games, software, and other digital content. With a community of millions of active users, Steam offers exclusive deals, free-to-play games, and early access titles. Use your Steam Wallet balance to explore thousands of games across every genre, from indie hits to AAA blockbusters. This card is perfect for avid gamers who want to stay updated on the latest gaming trends. For redemption instructions, visit steampowered.com/wallet.',
    rate: 4.7,
    category: 1, # "gift card"
    currency: 1, # "USD"
    info: 'Only valid for accounts with USD selected as the account currency.',
    attention: 'Ensure your Steam account uses USD as the default currency.',
    notice_info: 'Valid for Steam Wallet top-ups and in-game purchases.'
  },

  {
    provider: 'xbox',
    provision: 'Gaming Gift Card',
    min_value: 5.0,
    max_value: 50_000.0,
    currency: 'USD',
    rate: 4.7,
    image: '/images/gift-cards/xbox-live-usa.webp',
    description: "Pay for Xbox with Crypto. Buy Xbox Gift Card with Bitcoin, Lightning, Ethereum, Binance Pay, Tether (USDT), USD Coin (USDC), Dogecoin, Litecoin or Dash. Bitrefill's Xbox gift card lets you purchase what ever you want on the Microsoft Store.",
    info: 'This gift card is only redeemable on the e-commerce platform',
    attention: 'Attention! This product is only valid for accounts with the USA selected as the account region. The currency/region for an Xbox account is set during the account creation and cannot be modified afterward.',
    category: 'gift card'
  },
  {
    provider: 'skype',
    provision: 'Communication Services',
    min_value: 5.0,
    max_value: 50_000.0,
    currency: 'NGN',
    rate: 4.7,
    image: '/images/gift-cards/skype-usd-international.webp',
    description: "Looking to purchase Skype credit or a virtual number? Bitrefill's Skype gift card lets you pay for all of Skype's great services with Bitcoin, Ethereum, Dash, Dogecoin, and Litecoin.",
    category: 'gift card'
  },
  {
    provider: 'bankless',
    provision: 'Crypto-based Membership',
    min_value: 1.0,
    max_value: 1.0,
    currency: 'USD',
    rate: 4.7,
    image: '/images/gift-cards/nordvpn-international.webp',
    description: 'Purchase your one year Bankless Citizenship with crypto. Buy a Bankless Citizenship gift card with Bitcoin, Lightning, Ethereum, Binance Pay, USDT, USDC, Dogecoin, Litecoin, Dash. Instant email delivery. No account required. Start living on crypto!',
    info: 'This gift card is only redeemable on the e-commerce platform',
    attention: 'When redeeming this gift card at Bankless, you will need to share details of a fully functioning debit or credit card. Even though it will not be charged, these details are required.',
    category: 'gift card'
  },
  {
    provider: 'cherry credit',
    provision: 'Gaming Gift Card',
    min_value: 54.0,
    max_value: 80.0,
    currency: 'USD',
    rate: 4.7,
    image: '/images/gift-cards/cherry-credits-international.webp',
    description: 'Unlock limitless gaming potential with your Bitcoin, ETH or Tether through Cherry Credits Gift Card! Cherry Credits (CC) is a virtual currency that enables you to buy and enjoy over 1,000 games and digital content for popular games such as Black Desert, Dragon Nest, and Travian: Legends.',
    info: 'This gift card is redeemable on the e-commerce platform & at the physical store',
    category: 'gift card'
  },
  {
    provider: 'Kinguin Games Store EUR',
    provision: 'Digital Game Services',
    min_value: 54.0,
    max_value: 80.0,
    currency: 'USD',
    rate: 4.7,
    image: '/images/gift-cards/kinguin-gift-card-international.webp',
    description: 'Kinguin Games Store offers a vast selection of over 95,000 games, DLCs, software, and unique skins for gamers worldwide.',
    info: 'This gift card is redeemable on the e-commerce platform & at the physical store',
    category: 'gift card'
  },
  {
    provider: 'Suregift Multibrand',
    provision: 'Multibrand Services',
    min_value: 500.0,
    max_value: 500.0,
    currency: 'NGN',
    rate: 4.7,
    image: '/images/gift-cards/suregifts-generic-nigeria.webp',
    category: 'gift card'
  },

  {
    featured: false,
    extra_info: 'Unlock premium gaming and entertainment experiences.',
    provider: 'xbox',
    image: '/images/gift-cards/xbox-us.webp',
    provision: 'Digital Gaming Services',
    min_value: 10.0,
    max_value: 100.0,
    header_info: 'Access games, subscriptions, and entertainment with Xbox gift cards.',
    description: 'Xbox gift cards provide access to the ultimate gaming and entertainment experience. Use them to purchase games, downloadable content (DLCs), subscriptions, movies, and apps from the Microsoft Store on Xbox and Windows. Redeemable on Xbox consoles or online at microsoft.com, Xbox gift cards make it easy to enhance your gaming experience or enjoy the latest entertainment. Perfect for gamers who want to stay updated with the latest titles and features. Visit xbox.com/redeem for detailed instructions.',
    rate: 4.7,
    category: 1, # "gift card"
    currency: 1, # "USD"
    info: 'Only valid for accounts with USA as the selected region. Region is selected during Xbox account creation.',
    attention: "Ensure your Xbox account region matches the gift card's region.",
    notice_info: 'Redeemable for content on Xbox and Microsoft Store.'
  },
  {
    featured: false,
    extra_info: 'Stay connected with friends and family worldwide.',
    provider: 'skype',
    image: '/images/gift-cards/skype-credit.webp',
    provision: 'Communication Credit',
    min_value: 5.0,
    max_value: 50.0,
    header_info: 'Top up your Skype account for international calls and messaging.',
    description: 'Skype gift cards allow you to make international calls, send SMS, and connect with loved ones across the globe. Redeem the gift card to add credit to your Skype account and enjoy affordable rates on calls to mobile and landline numbers worldwide. Whether for business or personal use, Skype gift cards make staying in touch easy and cost-effective. Visit skype.com/redeem for instructions on how to add credit to your account.',
    rate: 4.7,
    category: 1, # "gift card"
    currency: 1, # "USD"
    info: 'Works globally for international calls via Skype credit.',
    attention: 'Ensure your account can accept gift card top-ups.',
    notice_info: 'Redeemable for Skype credit for calls and messaging.'
  },
  {
    featured: false,
    extra_info: 'The gateway to decentralized finance.',
    provider: 'bankless',
    image: '/images/gift-cards/bankless-credit.webp',
    provision: 'Decentralized Finance Access',
    min_value: 50.0,
    max_value: 5000.0,
    header_info: 'Empower your journey into decentralized finance with Bankless.',
    description: 'Bankless gift cards provide an easy way to access tools and services in the world of decentralized finance (DeFi). Use them to unlock exclusive content, educational resources, and premium memberships that guide you through the rapidly evolving DeFi ecosystem. Ideal for crypto enthusiasts and beginners looking to explore blockchain-based financial solutions. For detailed redemption instructions, visit bankless.com.',
    rate: 4.8,
    category: 1, # "gift card"
    currency: 1, # "USD"
    info: 'Redeemable for educational resources and DeFi tools.',
    attention: 'Ensure the gift card matches the intended DeFi platform.',
    notice_info: 'Not refundable once redeemed for services.'
  },
  {
    featured: false,
    extra_info: 'Versatile currency for gamers and digital content.',
    provider: 'cherry credit',
    image: '/images/gift-cards/cherry-credits.webp',
    provision: 'Gaming Credit',
    min_value: 5.0,
    max_value: 500.0,
    header_info: 'Unlock a vast range of games and digital content with Cherry Credits.',
    description: 'Cherry Credits is a versatile virtual currency used for over 1,000 games and digital content, including titles like Ragnarok Online, Dragon Nest, and Black Desert Online. Redeemable on platforms such as Steam and Ubisoft Store, Cherry Credits allows you to purchase games, software, and more across multiple regions. Enhance your gaming experience today by visiting cherrycredits.com/redeem for redemption instructions.',
    rate: 4.7,
    category: 1, # "gift card"
    currency: 1, # "USD"
    info: 'Usable for popular games and services across multiple platforms.',
    attention: 'Region-specific restrictions may apply for redemption.',
    notice_info: 'Check supported platforms before redeeming.'
  },
  {
    featured: false,
    extra_info: 'Shop for games and software at great prices.',
    provider: 'kinguin',
    image: '/images/gift-cards/kinguin-eur.webp',
    provision: 'Digital Game Store Credit',
    min_value: 10.0,
    max_value: 500.0,
    header_info: 'Explore gaming deals and software on Kinguin.',
    description: 'Kinguin gift cards provide credit for one of the best online platforms for discounted games and software. Use them to purchase game keys, software licenses, and in-game content for PC, Xbox, and PlayStation. Kinguin offers competitive prices and a vast selection of titles, making it the perfect destination for gamers. Visit kinguin.net/redeem for redemption details.',
    rate: 4.7,
    category: 1, # "gift card"
    currency: 0, # "EUR"
    info: 'Redeemable for Kinguin store credit in EUR.',
    attention: 'Ensure the currency matches your region for seamless redemption.',
    notice_info: 'Valid only for use on kinguin.net.'
  },
  {
    featured: false,
    extra_info: 'Gift your loved ones the choice of top brands.',
    provider: 'suregift',
    image: '/images/gift-cards/suregift-multibrand.webp',
    provision: 'Multibrand Gift Card',
    min_value: 10.0,
    max_value: 1000.0,
    header_info: 'Access products and services from multiple top brands with Suregift.',
    description: 'Suregift multibrand gift cards offer a convenient way to shop across various stores and services. Redeemable at participating retailers for groceries, electronics, apparel, and more, these cards provide flexibility and convenience. Suregift ensures that the recipient has a wide range of options to choose from, making it a perfect gift for any occasion. For redemption details, visit suregift.com/redeem.',
    rate: 4.8,
    category: 1, # "gift card"
    currency: 1, # "USD"
    info: 'Accepted by multiple top brands across various industries.',
    attention: 'Ensure the store accepts Suregift before purchasing.',
    notice_info: 'Redemption availability depends on participating retailers.'
  },
  {
    provider: 'mtn',
    provision: 'Mobile Airtime',
    min_value: 5.0,
    max_value: 50_000.0,
    currency: 'NGN',
    rate: 4.7,
    description: 'MTN provides reliable telecommunication services across Nigeria. Recharge airtime to stay connected effortlessly. Enjoy seamless communication with the MTN network, offering nationwide coverage and competitive pricing.',
    header_info: 'Recharge your MTN line with airtime for uninterrupted communication.',
    info: 'Use this to recharge any MTN line within Nigeria for voice calls, SMS, and data.',
    attention: 'Ensure the airtime value matches your communication needs.',
    notice_info: 'MTN recharge can be used for voice, data, and text services.',
    category: 'mobile provider'
  },
  {
    provider: 'mtn',
    provision: 'Bundle Data',
    min_value: 500.0,
    max_value: 50_000.0,
    currency: 'NGN',
    rate: 4.7,
    description: 'MTN offers a variety of data bundles to suit different browsing needs. Recharge with data bundles for uninterrupted internet connectivity, available in multiple plans.',
    header_info: 'Top-up your MTN line with data bundles to browse and stream without limits.',
    info: 'Use this to recharge any MTN line within Nigeria with data plans.',
    attention: 'Choose a data bundle based on your internet usage.',
    notice_info: 'Data bundles are valid for browsing, social media, and streaming.',
    category: 'mobile provider'
  },
  {
    provider: 'ntel',
    provision: 'Airtime',
    min_value: 5.0,
    max_value: 50_000.0,
    currency: 'NGN',
    rate: 4.7,
    description: 'ntel offers advanced 4G/LTE services and crystal-clear voice calls. Stay connected with ntel airtime for fast and reliable communication and internet services.',
    header_info: 'Recharge your ntel line with airtime for smooth voice and data services.',
    info: 'Recharge ntel for uninterrupted communication and browsing.',
    attention: 'Ensure the value is sufficient for your calls and data needs.',
    notice_info: 'ntel airtime is used for voice and data services.',
    category: 'mobile provider'
  },
  {
    provider: '9-mobile',
    provision: 'Airtime',
    min_value: 5.0,
    max_value: 50_000.0,
    currency: 'NGN',
    rate: 4.7,
    description: '9mobile provides flexible data and voice plans for its subscribers. Recharge your line with airtime to enjoy high-speed data and reliable voice calls.',
    header_info: 'Recharge your 9mobile line with airtime for calls and data.',
    info: 'Suitable for recharging any 9mobile line in Nigeria for calling and internet access.',
    attention: 'Check that the recharge value is compatible with your plan.',
    notice_info: '9mobile airtime can be used for both voice and data services.',
    category: 'mobile provider'
  },
  {
    provider: 'glo',
    provision: 'Airtime',
    min_value: 5.0,
    max_value: 50_000.0,
    currency: 'NGN',
    rate: 4.7,
    description: 'Globacom (Glo) offers affordable data and call services across Nigeria. Recharge your line seamlessly and enjoy great value on voice and internet services.',
    header_info: 'Recharge your Glo line with airtime for quality voice and data services.',
    info: 'Recharge any Glo line and enjoy unmatched bonuses and promotional offers.',
    attention: 'Ensure the airtime is sufficient for your communication needs.',
    notice_info: 'Glo airtime can be used for voice, SMS, and data services.',
    category: 'mobile provider'
  },
  {
    provider: 'airtel',
    provision: 'Airtime',
    min_value: 5.0,
    max_value: 50_000.0,
    currency: 'NGN',
    rate: 4.7,
    description: 'Airtel provides quality network coverage and affordable services across Nigeria. Recharge your airtime to enjoy high-quality calls, data, and SMS services.',
    header_info: 'Recharge your Airtel line for seamless communication and internet access.',
    info: 'Recharge Airtel lines for smooth voice calls and data browsing.',
    attention: 'Check the airtime value before recharging to match your needs.',
    notice_info: 'Airtel airtime is suitable for voice, data, and SMS services.',
    category: 'mobile provider'
  },
  {
    provider: 'Vortech Engineering',
    provision: 'Solar Installation',
    min_value: 5000.0,
    max_value: 50_000.0,
    currency: 'NGN',
    rate: 4.7,
    description: 'Vortech Engineering offers professional solar panel installation services. Harness the power of the sun with high-quality solar systems tailored to your needs.',
    header_info: 'Get solar panel installation services from Vortech Engineering.',
    info: 'Professional installation of solar panels to provide energy solutions for homes and businesses.',
    attention: 'Installation services require site assessment before booking.',
    notice_info: 'Solar panel installation includes setup and maintenance services.',
    category: 'service'
  },
  {
    provider: 'HPVC Consultancy',
    provision: 'Design and Development of Apartments',
    min_value: 5000.0,
    max_value: 50_000.0,
    currency: 'NGN',
    rate: 4.7,
    description: 'HPVC Consultancy provides expert design and development services for apartments, offering top-tier architectural solutions to transform your space.',
    header_info: 'Design and development services for apartments by HPVC Consultancy.',
    info: 'Expert consulting for designing and developing residential apartments with a focus on modern architecture.',
    attention: 'Consultation includes design and development phases, with optional follow-up services.',
    notice_info: 'Consultancy services are available for new builds or renovations.',
    category: 'service'
  },
  {
    provider: 'Vortech Engineering',
    provision: 'Solar installation',
    min_value: 5000,
    max_value: 50_000,
    image: '/images/services/installing-solar-panels.webp',
    rate: 4.7,
    category: 'service',
    currency: 'NGN'

  },
  {
    provider: 'HPVC Consulatancy',
    provision: 'Design and Development of Apartments',
    min_value: 5000,
    max_value: 50_000,
    rate: 4.7,
    image: '/images/services/engineering-consultancy.png',
    category: 'service',
    currency: 'NGN'
  }
]

products.each do |product_data|
  Product.find_or_create_by!(provider: product_data[:provider]) do |product|
    product.assign_attributes(product_data)
  end
end

puts 'seeding completed'
