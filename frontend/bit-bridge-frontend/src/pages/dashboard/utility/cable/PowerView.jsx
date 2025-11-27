import { Outlet, useNavigate, useParams } from 'react-router-dom'
import powerDistributions from '../../../../data/powerDistributions.json'
import { useDispatch, useSelector } from 'react-redux'
import { useEffect } from 'react'
import { getProvisions } from '../../../../redux/actions/provision'
import { splitString } from '../../../../utils'

const CableView = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const { utilities } = useSelector((state) => state.provision)
  useEffect(() => {
    dispatch(getProvisions())
  }, [])
  const { id } = useParams()

  const selectedProvider = utilities?.find((item) => item.id == id)
  const imagePic = splitString(selectedProvider?.product?.provider)
  const service = 'cable'
  return (
    <section className="px-4  py-10">
      <div className="max-w-7xl text-white m-auto py-10 px-0  md:px-10">
        <div className="flex sm:flex-row flex-col  gap-3">
          <img
            src={`/images/providers/${imagePic}.webp`}
            alt=""
            className="h-52 md:h-max sm:max-w-40 rounded-lg border border-alt p-2"
          />
          <div>
            <div>
              <p className="text-3xl text-gray-200 mb-4 mt-0 font-semibold ">
                {selectedProvider?.name}
              </p>
              <p className="text-lg text-gray-300">{selectedProvider?.description}</p>
            </div>

            <div className="my-4">
              <p className="text-base text-gray-400 my-0 ">{selectedProvider?.name}</p>
              <p className="text-base text-gray-400">{selectedProvider?.description}</p>
            </div>
          </div>
          <p></p>
        </div>

        <Outlet context={[id, selectedProvider, service]} />
      </div>
    </section>
  )
}

export default CableView
