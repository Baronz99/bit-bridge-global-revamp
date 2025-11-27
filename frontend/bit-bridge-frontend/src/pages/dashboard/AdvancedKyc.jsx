// src/pages/dashboard/AdvancedKyc.jsx
import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { NavLink } from 'react-router-dom'
import { toast } from 'react-toastify'
import { SafetyCertificateOutlined, IdcardOutlined } from '@ant-design/icons'

const AdvancedKyc = () => {
  const { user } = useSelector((state) => state.auth)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)

    // For now, just show a message – backend/file storage not wired yet
    toast(
      'Advanced document upload is coming soon. Your basic KYC is already saved on BitBridge.',
      { type: 'info' }
    )

    setTimeout(() => {
      setSubmitting(false)
    }, 800)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-1">
              KYC – Tier 2
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold">
              Upload ID & boost your limits
            </h1>
            <p className="text-sm text-slate-400 max-w-xl mt-2">
              This step is for higher limits, salary/vendor payouts and more advanced features.
              Your basic profile is already saved.
            </p>
          </div>
          <div className="hidden md:flex h-11 w-11 rounded-full bg-emerald-500/10 border border-emerald-400/60 items-center justify-center">
            <SafetyCertificateOutlined className="text-emerald-300" />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6"
        >
          {/* Government ID */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <IdcardOutlined /> Government ID (coming soon)
            </h2>
            <p className="text-xs text-slate-400">
              You’ll be able to upload your international passport or driver’s licence here.
            </p>
            <input
              type="file"
              disabled
              className="mt-2 block w-full rounded-md border border-slate-700 bg-slate-800/60 text-slate-400 text-xs p-2 cursor-not-allowed"
              accept="image/*,application/pdf"
            />
          </div>

          {/* Selfie */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Selfie / Face match (coming soon)</h2>
            <p className="text-xs text-slate-400">
              A short selfie step to match your face with your ID, just like other modern
              fintech apps.
            </p>
            <button
              type="button"
              disabled
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-400 cursor-not-allowed"
            >
              Launch selfie capture
            </button>
          </div>

          {/* Proof of address */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Proof of address (optional – coming soon)</h2>
            <p className="text-xs text-slate-400">
              For very high limits, you may be asked to upload a utility bill or bank statement.
            </p>
            <input
              type="file"
              disabled
              className="mt-2 block w-full rounded-md border border-slate-700 bg-slate-800/60 text-slate-400 text-xs p-2 cursor-not-allowed"
              accept="image/*,application/pdf"
            />
          </div>

          <div className="flex justify-between items-center pt-3">
            <NavLink
              to="/dashboard/kyc"
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Back to KYC overview
            </NavLink>

            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                submitting
                  ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                  : 'bg-alt text-black hover:bg-alt/90'
              }`}
            >
              {submitting ? 'Preparing…' : 'Got it – continue later'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AdvancedKyc
