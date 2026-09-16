const spinner = (
  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
)

const Loading = () => {
  return (
    <div className="inline-flex items-center gap-3 text-sm text-slate-300">
      {spinner}
      <span>Loading...</span>
    </div>
  )
}

export default Loading
