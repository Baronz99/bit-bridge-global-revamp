import { Outlet, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { splitString } from '../../../../utils'
import { getSectionCatalog } from '../../../../api/catalog'
import { groupBridgeUtilityCatalog } from '../../../../utils/bridgeUtilityCatalog'

const MobileView = () => {
  const [mobileProviders, setMobileProviders] = useState([])

  useEffect(() => {
    let active = true

    const loadCatalog = async () => {
      try {
        const response = await getSectionCatalog('bridge')
        if (!active) return
        const items = Array.isArray(response?.data?.data) ? response.data.data : []
        const grouped = groupBridgeUtilityCatalog(items)
        setMobileProviders(grouped.mobileProviders)
      } catch {
        if (!active) return
        setMobileProviders([])
      }
    }

    loadCatalog()

    return () => {
      active = false
    }
  }, [])

  const { id } = useParams()

  const selectedProvider = mobileProviders?.find((item) => item.id == id)
  const imagePic = splitString(selectedProvider?.product?.provider)
  const service = 'mobile-top-up'

  return (
    <section className="px-4  md:py-10">
      <div className="max-w-7xl text-white m-auto py-10 px-4 md:px-10">
        <div className="flex sm:flex-row flex-col mb-4  gap-3">
          <img
            src={`/images/providers/${imagePic}.webp`}
            alt={selectedProvider?.product?.provider}
            className="md:h-52 h-40 w-full  sm:max-w-80  rounded-lg border border-alt p-2"
          />
          <div>
            <div>
              <p className="md:text-3xl text-xl text-gray-200 mb-4 mt-0 font-semibold ">
                {selectedProvider?.product?.provider || selectedProvider?.name}
              </p>
              <p className="text-lg text-gray-300">
                {(selectedProvider?.product?.description || selectedProvider?.description || '')
                  .substring(0, 100)}
                ...
              </p>
            </div>
          </div>
        </div>

        <Outlet context={[id, selectedProvider, service]} />
      </div>
    </section>
  )
}

export default MobileView
