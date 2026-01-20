import { useEffect, useRef } from 'react'

const SUCCESS_STATUSES = new Set(['approved', 'completed', 'success', 'paid'])
const FAILED_STATUSES = new Set(['failed', 'declined', 'cancelled', 'reversed', 'expired'])
const TERMINAL_STATUSES = new Set([...SUCCESS_STATUSES, ...FAILED_STATUSES])

const normalizeStatus = (status) => String(status || '').toLowerCase()

const useBillOrderPolling = ({ queryId, dispatch, getPurchaseOrder, status }) => {
  const startedAtRef = useRef(null)
  const timerRef = useRef(null)
  const statusRef = useRef(status)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    if (!queryId) return
    if (TERMINAL_STATUSES.has(normalizeStatus(statusRef.current))) return

    if (!startedAtRef.current) startedAtRef.current = Date.now()

    dispatch(getPurchaseOrder(queryId))

    const poll = () => {
      if (TERMINAL_STATUSES.has(normalizeStatus(statusRef.current))) return
      if (Date.now() - startedAtRef.current > 60_000) return

      dispatch(getPurchaseOrder(queryId))
      timerRef.current = setTimeout(poll, 23_000)
    }

    timerRef.current = setTimeout(poll, 23_000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [queryId, dispatch, getPurchaseOrder])
}

export default useBillOrderPolling
