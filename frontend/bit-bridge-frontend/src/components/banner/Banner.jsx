import './style.scss'

const Banner = () => {
  return (
    <div className="h-72 banner px-4 relative bg-gray-200 flex justify-center items-center">
      <div className="absolute top-0 bg-gray-900 opacity-80 left-0 w-full h-full"></div>
      <div className="z-10">
        <h2 className="md:text-4xl text-2xl max-w-5xl font-semibold text-center text-gray-100">
          Top up prepaid and postpaid Utility bill with Bitcoin and other cryptocurrencies from
          anywhere in the world
        </h2>
      </div>
    </div>
  )
}

export default Banner
