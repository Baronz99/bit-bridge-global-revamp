import { Outlet, useParams } from 'react-router-dom'
import powerDistributions from '../../../../data/powerDistributions.json'

const PowerView = () => {
  const { id } = useParams()

  const selectedProvider = powerDistributions?.find((item) => item.id == id)
  const service = 'buy-power'
  console.log(selectedProvider)

  return (
    <section className="px-4  md:py-10">
      <div className="max-w-7xl text-white m-auto py-10 px-0 md:px-10">
        <div className="flex sm:flex-row flex-col  gap-3">
          <img
            src={selectedProvider?.image}
            alt=""
            className="md:h-52 h-40 w-full  sm:max-w-80 rounded-lg border border-alt p-2"
          />
          <div>
            <div>
              <p className="text-3xl text-gray-200 my-4 font-semibold ">{selectedProvider?.name}</p>
              <p className="text-lg text-gray-300">{selectedProvider?.description}</p>
            </div>

            <div className="my-4">
              <p className="text-base text-gray-400 my-0 ">{selectedProvider?.name}</p>
              <p className="text-base text-gray-400">{selectedProvider?.description}</p>
            </div>
          </div>
        </div>

        <Outlet context={[id, selectedProvider?.biller, service]} />
      </div>
    </section>
  )
}

export default PowerView
