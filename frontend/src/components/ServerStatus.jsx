import { useQuery } from '@tanstack/react-query'
import { checkHealth } from '../api/client'

/**
 * Small indicator in the header showing backend health.
 * Polls /health every 30s. Shows a "waking up" state if server is unreachable —
 * important for Fly.io where the first hit after a long idle might need a moment.
 */
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
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        connecting…
      </span>
    )
  }

  if (isError || !data) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        backend offline
      </span>
    )
  }

  const allOk = data.status === 'ok'
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-400">
      <span className={`w-1.5 h-1.5 rounded-full ${allOk ? 'bg-green-400' : 'bg-yellow-400'}`} />
      {allOk ? 'online' : 'degraded'}
    </span>
  )
}
