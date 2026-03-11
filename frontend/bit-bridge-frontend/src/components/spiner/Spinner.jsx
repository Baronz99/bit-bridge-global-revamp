const Spinner = () => (
  <div className="flex items-center justify-center p-6">
    <div className="inline-flex items-center gap-3 rounded-lg bg-black/5 px-4 py-3 text-sm text-slate-600">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
      <span>Loading...</span>
    </div>
  </div>
)

export default Spinner
