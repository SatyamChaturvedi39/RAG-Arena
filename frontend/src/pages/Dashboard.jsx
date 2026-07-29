import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
  ScatterChart,
  Scatter,
  CartesianGrid,
  ReferenceLine,
  Label
} from 'recharts'
import {
  getMetricsSummary,
  getMetricsHistory,
  getVoteStats,
  getQueryHistory
} from '../api/client'
import {
  BarChart3,
  Clock,
  ThumbsUp,
  HelpCircle,
  Database,
  TrendingUp,
  RefreshCw,
  Zap,
  Activity
} from 'lucide-react'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)
  const [latencyHistory, setLatencyHistory] = useState([])
  const [signalMapData, setSignalMapData] = useState([])
  const [voteStats, setVoteStats] = useState({
    total_votes: 0,
    vector_wins: 0,
    vectorless_wins: 0,
    ties: 0,
    vector_win_rate: 0,
    vectorless_win_rate: 0
  })

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryRes, historyRes, votesRes, queriesRes] = await Promise.allSettled([
        getMetricsSummary(30), // Past 30 days
        getMetricsHistory(100),
        getVoteStats(),
        getQueryHistory(null, 200) // fetch up to 200 queries
      ])

      let anySucceeded = false

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value.data)
        anySucceeded = true
      }

      if (historyRes.status === 'fulfilled') {
        // Process latency points for the AreaChart
        const pts = historyRes.value.data.points || []
        const formattedPoints = pts
          .slice()
          .reverse()
          .map((p, idx) => ({
            name: `Q${idx + 1}`,
            latency: p.latency_ms,
            pipeline: p.pipeline === 'vector' ? 'Vector' : 'Vectorless',
            Vector: p.pipeline === 'vector' ? p.latency_ms : null,
            Vectorless: p.pipeline === 'vectorless' ? p.latency_ms : null
          }))
        setLatencyHistory(formattedPoints)
        anySucceeded = true
      }

      if (votesRes.status === 'fulfilled' && votesRes.value.data) {
        setVoteStats(votesRes.value.data)
        anySucceeded = true
      }

      if (queriesRes.status === 'fulfilled') {
        // Process query signal map scatter data
        const rawQueries = queriesRes.value.data.items || []
        const signalPoints = rawQueries
          .filter(q => q.dual_axis_result && q.dual_axis_result.s_q !== undefined)
          .map(q => {
            const dar = q.dual_axis_result
            return {
              x: dar.s_q,
              y: dar.d_q !== null ? dar.d_q : 0.0,
              query: q.query_text,
              reason: dar.reason || q.router_reasoning || '',
              route: dar.route || 'unknown'
            }
          })
        setSignalMapData(signalPoints)
        anySucceeded = true
      }

      if (!anySucceeded) {
        const firstErr = [summaryRes, historyRes, votesRes, queriesRes]
          .find(r => r.status === 'rejected')
        throw firstErr?.reason || new Error('All analytics endpoints failed')
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError('Could not load analytics. Make sure the database schema is fully active.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
        <span className="text-sm text-[var(--color-muted)]">Aggregating database telemetry...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-8 text-center max-w-md mx-auto space-y-4 my-12 border-red-500/20 bg-red-950/5">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <HelpCircle className="w-6 h-6 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--color-text)]">Failed to load telemetry</h3>
        <p className="text-sm text-[var(--color-muted)] leading-relaxed">{error}</p>
        <button onClick={fetchData} className="btn-secondary w-full text-xs">
          Retry Connection
        </button>
      </div>
    )
  }

  // Fallbacks if no database entries yet
  const totalQueries = summary?.total_queries || 0
  const avgVector = summary?.avg_vector_latency_ms || 0
  const avgVectorless = summary?.avg_vectorless_latency_ms || 0

  // Pie chart data for Router Recommended Distribution
  const routerDist = summary?.router_recommendation_distribution || { parametric: 0, vector: 0, vectorless: 0 }
  const routerPieData = [
    { name: 'Parametric', value: routerDist.parametric || 0, color: '#E6A817' },
    { name: 'Vector RAG', value: routerDist.vector || 0, color: '#1A6B8A' },
    { name: 'Vectorless RAG', value: routerDist.vectorless || 0, color: '#2D6A4F' }
  ].filter(d => d.value > 0)

  // Fallback pie data to show a nice mock if empty
  const activePieData = routerPieData.length > 0 ? routerPieData : [
    { name: 'Parametric (No data)', value: 1, color: '#cbd5e1' },
    { name: 'Vector RAG (No data)', value: 1, color: '#94a3b8' },
    { name: 'Vectorless RAG (No data)', value: 1, color: '#64748b' }
  ]

  // Bar chart data for Query Type distribution
  const typeCounts = summary?.queries_by_type || {}
  const barData = Object.entries(typeCounts).map(([type, count]) => ({
    name: type.replace('_', ' '),
    count: count
  }))

  const votePieData = [
    { name: 'Vector Wins', value: voteStats.vector_wins || 0, color: '#1A6B8A' },
    { name: 'Vectorless Wins', value: voteStats.vectorless_wins || 0, color: '#2D6A4F' },
    { name: 'Ties', value: voteStats.ties || 0, color: '#5E7387' }
  ].filter(d => d.value > 0)

  const activeVotePieData = votePieData.length > 0 ? votePieData : [
    { name: 'Vector Wins (No data)', value: 1, color: '#cbd5e1' },
    { name: 'Vectorless Wins (No data)', value: 1, color: '#94a3b8' }
  ]

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto text-[var(--color-text)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-[var(--color-primary)]">
            <Activity className="w-8 h-8 text-[var(--color-accent)]" />
            Performance Analytics
          </h1>
          <p className="text-sm text-[var(--color-muted)]">
            Real-time analytics aggregated across all comparisons and crowdsourced human judgements.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="btn-secondary flex items-center gap-2 text-xs py-2 px-3"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Analytics
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Queries */}
        <div className="metric-card space-y-2 border border-[var(--color-border)] bg-white">
          <div className="flex justify-between items-center text-[var(--color-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Runs</span>
            <Database className="w-5 h-5 text-[var(--color-muted)]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-[var(--color-text)]">{totalQueries}</span>
            <span className="text-xs text-[var(--color-vectorless)] flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> Live</span>
          </div>
          <p className="text-xs text-[var(--color-muted)]">Queries run across all documents</p>
        </div>

        {/* Avg Vector Latency */}
        <div className="metric-card space-y-2 border border-[var(--color-border)] bg-white">
          <div className="flex justify-between items-center text-[var(--color-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Vector Latency</span>
            <Clock className="w-5 h-5 text-[var(--color-vector)]" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-[var(--color-vector)]">
              {avgVector ? `${avgVector}ms` : '0ms'}
            </span>
          </div>
          <p className="text-xs text-[var(--color-muted)]">Dense retrieval + LLM synthesis</p>
        </div>

        {/* Avg Vectorless Latency */}
        <div className="metric-card space-y-2 border border-[var(--color-border)] bg-white">
          <div className="flex justify-between items-center text-[var(--color-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Vectorless Latency</span>
            <Clock className="w-5 h-5 text-[var(--color-vectorless)]" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-[var(--color-vectorless)]">
              {avgVectorless ? `${avgVectorless}ms` : '0ms'}
            </span>
          </div>
          <p className="text-xs text-[var(--color-muted)]">Multi-pass tree traversal</p>
        </div>

        {/* Human Feedback Votes */}
        <div className="metric-card space-y-2 border border-[var(--color-border)] bg-white">
          <div className="flex justify-between items-center text-[var(--color-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">User Votes</span>
            <ThumbsUp className="w-5 h-5 text-[var(--color-accent)]" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-[var(--color-accent)]">{voteStats.total_votes}</span>
          </div>
          <p className="text-xs text-[var(--color-muted)]">Preferred answers recorded</p>
        </div>
      </div>

      {/* Latency History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2 p-6 space-y-4 bg-white border border-[var(--color-border)] rounded-xl">
          <h3 className="font-semibold text-[var(--color-primary)] flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--color-accent)]" /> Latency Over Time (ms)
          </h3>
          <div className="h-[280px]">
            {latencyHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={latencyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVector" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-vector)" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="var(--color-vector)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorVectorless" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-vectorless)" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="var(--color-vectorless)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="var(--color-muted)" fontSize={10} tickLine={false} />
                  <YAxis stroke="var(--color-muted)" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#ffffff',
                      borderColor: 'var(--color-border)',
                      borderRadius: '8px',
                      color: 'var(--color-text)',
                      fontSize: '12px'
                    }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area
                    type="monotone"
                    dataKey="Vector"
                    stroke="var(--color-vector)"
                    fillOpacity={1}
                    fill="url(#colorVector)"
                    strokeWidth={2}
                    connectNulls
                  />
                  <Area
                    type="monotone"
                    dataKey="Vectorless"
                    stroke="var(--color-vectorless)"
                    fillOpacity={1}
                    fill="url(#colorVectorless)"
                    strokeWidth={2}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center border border-dashed border-[var(--color-border)] rounded-xl text-xs text-[var(--color-muted)]">
                Run comparative queries to see latency trends
              </div>
            )}
          </div>
        </div>

        {/* Human Preference (User Voting Stats) */}
        <div className="card p-6 flex flex-col justify-between bg-white border border-[var(--color-border)] rounded-xl">
          <h3 className="font-semibold text-[var(--color-primary)] mb-4 flex items-center gap-2">
            <ThumbsUp className="w-4 h-4 text-[var(--color-accent)]" /> Human Preference (Votes)
          </h3>
          <div className="h-[200px] flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={activeVotePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {activeVotePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#ffffff',
                    borderColor: 'var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    fontSize: '11px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-bold font-mono text-[var(--color-text)]">
                {voteStats.total_votes}
              </span>
              <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-widest">Votes</span>
            </div>
          </div>
          
          <div className="space-y-2 mt-4">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[var(--color-vector)]" /> Vector Wins</span>
              <span className="font-mono text-[var(--color-muted)]">
                {voteStats.vector_wins} ({Math.round(voteStats.vector_win_rate * 100)}%)
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[var(--color-vectorless)]" /> Vectorless Wins</span>
              <span className="font-mono text-[var(--color-muted)]">
                {voteStats.vectorless_wins} ({Math.round(voteStats.vectorless_win_rate * 100)}%)
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[var(--color-muted)]" /> Ties</span>
              <span className="font-mono text-[var(--color-muted)]">
                {voteStats.ties}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Router Recommendation & Query Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Router Recommendation Distribution */}
        <div className="card p-6 space-y-4 bg-white border border-[var(--color-border)] rounded-xl">
          <h3 className="font-semibold text-[var(--color-primary)] flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--color-accent)]" /> Router Recommendation Split
          </h3>
          <div className="h-[220px] flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={activePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {activePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#ffffff',
                    borderColor: 'var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    fontSize: '11px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-xl font-bold font-mono text-[var(--color-text)]">
                {totalQueries}
              </span>
              <span className="text-[9px] text-[var(--color-muted)] uppercase tracking-widest">Queries</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs pt-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#E6A817]" />
              <span className="text-[var(--color-muted)]">Parametric ({routerDist.parametric || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[var(--color-vector)]" />
              <span className="text-[var(--color-muted)]">Vector ({routerDist.vector || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[var(--color-vectorless)]" />
              <span className="text-[var(--color-muted)]">Vectorless ({routerDist.vectorless || 0})</span>
            </div>
          </div>
        </div>

        {/* Query Intent Distribution */}
        <div className="card p-6 space-y-4 bg-white border border-[var(--color-border)] rounded-xl">
          <h3 className="font-semibold text-[var(--color-primary)] flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--color-accent)]" /> Routing Signal Distribution
          </h3>
          <div className="h-[220px]">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="var(--color-muted)" fontSize={9} tickLine={false} />
                  <YAxis stroke="var(--color-muted)" fontSize={9} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#ffffff',
                      borderColor: 'var(--color-border)',
                      borderRadius: '8px',
                      color: 'var(--color-text)',
                      fontSize: '11px'
                    }}
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="var(--color-accent)" opacity={0.8 - (index * 0.1)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center border border-dashed border-[var(--color-border)] rounded-xl text-xs text-[var(--color-muted)] px-6 text-center">
                No routing decisions logged yet — run a comparison to see signal data.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Query Signal Map (2D Scatter Plot) */}
      <div className="card p-6 space-y-4 bg-white border border-[var(--color-border)] rounded-xl">
        <h3 className="font-semibold text-[var(--color-primary)] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--color-accent)]" /> Query Signal Map
        </h3>
        <p className="text-xs text-[var(--color-muted)] leading-relaxed">
          Empirical distribution of queries plotted against Mean Token Surprisal S(q) and Entity Density D(q). Threshold boundaries θ₁ (11.5 bits) and θ₂ (0.15) partition queries into Parametric, Vector, and Vectorless routing zones.
        </p>
        <div className="h-[320px] w-full">
          {signalMapData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Surprisal"
                  unit=" bits"
                  domain={[0, 40]}
                  stroke="var(--color-muted)"
                  fontSize={10}
                >
                  <Label value="Mean Token Surprisal (S) →" offset={-5} position="insideBottom" fill="var(--color-text)" fontSize={10} fontStyle="italic" />
                </XAxis>
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Density"
                  domain={[0, 1.0]}
                  stroke="var(--color-muted)"
                  fontSize={10}
                >
                  <Label value="Entity Density (D) ↑" angle={-90} position="insideLeft" offset={0} fill="var(--color-text)" fontSize={10} fontStyle="italic" />
                </YAxis>
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-md max-w-xs text-xs space-y-1.5 text-[var(--color-text)]">
                          <p className="font-semibold text-[var(--color-primary)] border-b pb-1">
                            Route: <span className="uppercase font-mono" style={{ color: data.route === 'parametric' ? '#E6A817' : data.route === 'vectorless' ? '#2D6A4F' : '#1A6B8A' }}>{data.route}</span>
                          </p>
                          <p className="font-medium text-slate-800">Q: "{data.query}"</p>
                          <p className="text-[var(--color-muted)] font-mono text-[10px] leading-relaxed">Reason: {data.reason}</p>
                          <p className="text-[10px] text-slate-500">S: {data.x.toFixed(2)} | D: {data.y.toFixed(2)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine x={11.5} stroke="var(--color-signal-2)" strokeDasharray="3 3" />
                <ReferenceLine y={0.15} stroke="var(--color-signal-2)" strokeDasharray="3 3" />
                <Scatter name="Queries" data={signalMapData}>
                  {signalMapData.map((entry, index) => {
                    const color = entry.route === 'parametric' ? '#E6A817' : entry.route === 'vectorless' ? '#2D6A4F' : '#1A6B8A';
                    return <Cell key={`cell-${index}`} fill={color} r={6} />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center border border-dashed border-[var(--color-border)] rounded-xl text-xs text-[var(--color-muted)]">
              Run comparisons to populate the signal map.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
