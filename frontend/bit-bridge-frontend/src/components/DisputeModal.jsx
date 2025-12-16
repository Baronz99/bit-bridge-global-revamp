import { useState } from 'react'
import ClassicBtn from './button/ClassicButton'
import { raiseDispute } from '../api/disputes'

export default function DisputeModal({ tx, onClose, onCreated }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async () => {
    if (!reason) {
      setError('Please select a reason.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const dispute = await raiseDispute({
        circleTransactionId: tx.id,
        reason,
        note,
      })
      onCreated(dispute)
      onClose()
    } catch (e) {
      setError(e.message || 'Unable to request review.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Request review</h3>
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
          Reason
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
        >
          <option value="">Select a reason</option>
          <option value="NO_APPROVAL">I didn’t approve this</option>
          <option value="WRONG_AMOUNT">Incorrect amount</option>
          <option value="ALREADY_PAID">I already paid</option>
          <option value="ADMIN_REVIEW">Admin action needs review</option>
        </select>

        <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1 mt-3">
          Note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          rows={3}
          className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none resize-none"
          placeholder="Short note (max 200 characters)"
        />

        {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}

        <div className="flex gap-2 mt-4">
          <ClassicBtn className="h-10 text-sm w-full !bg-slate-800 hover:!bg-slate-700" onclick={onClose}>
            Cancel
          </ClassicBtn>
          <ClassicBtn className="h-10 text-sm w-full" onclick={submit} disabled={loading}>
            {loading ? 'Submitting…' : 'Submit'}
          </ClassicBtn>
        </div>
      </div>
    </div>
  )
}
