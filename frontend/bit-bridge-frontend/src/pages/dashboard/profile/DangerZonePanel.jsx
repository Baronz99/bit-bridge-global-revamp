// src/pages/dashboard/profile/DangerZonePanel.jsx

export default function DangerZonePanel({ onOpenDelete }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Danger zone</h2>
        <p className="text-sm text-gray-400 mt-1">Irreversible actions.</p>
      </div>

      <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-4 space-y-3">
        <div>
          <h3 className="text-base font-semibold text-red-300">Delete account</h3>
          <p className="text-sm text-red-200/70 mt-1">
            This permanently deletes your account. This action cannot be undone.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenDelete}
          className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition"
        >
          Delete My Account
        </button>
      </div>
    </div>
  )
}
