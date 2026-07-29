import { useEffect, useState } from 'react'

const useRenderedSimulationState = (simulationState) => {
  const [renderedSimulationState, setRenderedSimulationState] = useState(() => simulationState)

  useEffect(() => {
    setRenderedSimulationState(simulationState)
  }, [simulationState])

  return {
    renderedSimulationState,
    setRenderedSimulationState,
  }
}

export default useRenderedSimulationState
