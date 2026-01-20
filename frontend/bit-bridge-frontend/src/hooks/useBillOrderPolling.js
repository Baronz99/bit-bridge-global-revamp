import { useEffect, useRef } from 'react'

const SUCCESS_STATUSES = new Set(['approved', 'completed', 'success', 'paid'])
const FAILED_STATUSES = new Set(['failed', 'declined', 'cancelled', 'reversed', 'expired', 'refunded'])
const TERMINAL_STATUSES = new Set([...SUCCESS_STATUSES, ...FAILED_STATUSES])
const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = 60_000

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
      if (Date.now() - startedAtRef.current > POLL_TIMEOUT_MS) return

      dispatch(getPurchaseOrder(queryId))
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
    }

    timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [queryId, dispatch, getPurchaseOrder])
}

export default useBillOrderPolling
