import { useQuery } from '@tanstack/react-query'
import { checkHealth } from '../api/client'

export default function ServerStatus() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => checkHealth().then((r) => r.data),
    refetchInterval: 30_000,
    retry: 3,
    retryDelay: 5_000,
  })

  if (isLoading) {
    return (
      <span className="flex items-center gap-2 text-xs text-slate-500">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-yellow-500" />
        </span>
        connecting
      </span>
    )
  }

  if (isError || !data) {
    return (
      <span className="flex items-center gap-2 text-xs text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        offline
      </span>
    )
  }

  const allOk = data.status === 'ok'
  return (
    <span className="flex items-center gap-2 text-xs" style={{ color: allOk ? '#4ade80' : '#facc15' }}>
      <span className="relative flex h-1.5 w-1.5">
        {allOk && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
            style={{ background: '#4ade80' }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-1.5 w-1.5"
          style={{ background: allOk ? '#4ade80' : '#facc15', boxShadow: allOk ? '0 0 6px #4ade80' : 'none' }}
        />
      </span>
      {allOk ? 'online' : 'degraded'}
    </span>
  )
}
