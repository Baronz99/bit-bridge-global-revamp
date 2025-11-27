import { StarOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'

import { splitString } from '../../utils'
import { nairaFormat } from '../../utils/nairaFormat'
const ProductCard = ({
  id,
  min_value,
  currency,
  isDetails = true,
  max_value,
  provider,
  provision,
  link,
}) => {
  const navigate = useNavigate()

  const imagePic = splitString(provider)

  return (
    <div
      key={id}
      onClick={() => {
        navigate(link)
      }}
      className=""
    >
      <div className="md:h-52 border shadow cursor-pointer hover:scale-105 rounded-md hover:shadow-xl transition-all ease-linear duration-300  bg-white overflow-hidden">
        <img
          src={`/images/providers/${imagePic}.webp`}
          alt=""
          className="w-full md:object-cover object-fill  h-full"
        />
      </div>

      {isDetails && (
        <div className=" justify-between px-2 my-2">
          <div className="flex items-center w-full justify-between">
            <p className="md:text-lg text-gray-800 font-medium capitalize">{provider}</p>

            <div className="flex gap-3">
              <span className="font-semibold">4.7</span>
              <span>
                <StarOutlined />
              </span>
            </div>
          </div>

          <div className="flex items-center w-full justify-between">
            <p className="md:text-lg text-gray-600 font-medium">{provision}</p>

            {min_value && (
              <p className="text-base font-medium text-gray-600">{`${nairaFormat(min_value, currency)} - ${nairaFormat(max_value, currency)}`}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

ProductCard.propTypes = {
  id: PropTypes.string,
  provider: PropTypes.string,
  provision: PropTypes.string,
  min_value: PropTypes.string,
  max_value: PropTypes.string,
  currency: PropTypes.string,
}

export default ProductCard
