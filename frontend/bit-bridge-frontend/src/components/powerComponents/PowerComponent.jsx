import powerDistributions from '../../data/powerDistributions.json'
import ElectricCard from '../product-card/ElectricCard'
import { useNavigate } from 'react-router-dom'

const PowerComponent = () => {
  const navigate = useNavigate()

  return (
    <section className="py-10  px-4 md:my-10">
      <div className="max-w-7xl text-white m-auto grid grid-cols-2 md:grid-cols-2 gap-4 lg:grid-cols-3">
        {powerDistributions.map(({ id, description, name, image }) => (
          <ElectricCard
            onClick={() => navigate(`/dashboard/utilities/buy-power/${id}/powerform`)}
            key={id}
            id={id}
            description={description}
            name={name}
            image={image}
          />
        ))}
      </div>
    </section>
  )
}

export default PowerComponent
