import { useNavigate } from 'react-router-dom'
import MoneyTransferFlow from '../../components/fundTransfer/FundTransfer'

const BridgeSend = () => {
  const navigate = useNavigate()

  return (
    <MoneyTransferFlow
      embedded={false}
      initialMode="bitbridge"
      onClose={() => navigate('/dashboard/bridge')}
    />
  )
}

export default BridgeSend
