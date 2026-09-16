const LoaderPage = () => {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-900">
      <div className="flex flex-col items-center gap-4 text-slate-200">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-alt" />
        <p className="text-sm tracking-[0.18em] uppercase text-slate-400">Loading</p>
      </div>
    </div>
  )
}

export default LoaderPage
