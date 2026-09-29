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
  Activity,
  Sparkles,
  Compass
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
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-4">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
        <span className="text-sm text-slate-400 font-medium">Aggregating database telemetry...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-8 text-center max-w-md mx-auto space-y-4 my-12 border-red-500/30 bg-red-950/20 rounded-2xl backdrop-blur-md">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto text-red-400">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-white">Failed to load telemetry</h3>
        <p className="text-sm text-slate-300 leading-relaxed">{error}</p>
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
    { name: 'Parametric', value: routerDist.parametric || 0, color: '#f59e0b' },
    { name: 'Vector RAG', value: routerDist.vector || 0, color: '#38bdf8' },
    { name: 'Vectorless RAG', value: routerDist.vectorless || 0, color: '#34d399' }
  ].filter(d => d.value > 0)

  const activePieData = routerPieData.length > 0 ? routerPieData : [
    { name: 'Parametric (No data)', value: 1, color: '#334155' },
    { name: 'Vector RAG (No data)', value: 1, color: '#475569' },
    { name: 'Vectorless RAG (No data)', value: 1, color: '#64748b' }
  ]

  // Bar chart data for Query Type distribution
  const typeCounts = summary?.queries_by_type || {}
  const barData = Object.entries(typeCounts).map(([type, count]) => ({
    name: type.replace('_', ' '),
    count: count
  }))

  const votePieData = [
    { name: 'Vector Wins', value: voteStats.vector_wins || 0, color: '#38bdf8' },
    { name: 'Vectorless Wins', value: voteStats.vectorless_wins || 0, color: '#34d399' },
    { name: 'Ties', value: voteStats.ties || 0, color: '#94a3b8' }
  ].filter(d => d.value > 0)

  const activeVotePieData = votePieData.length > 0 ? votePieData : [
    { name: 'Vector Wins (No data)', value: 1, color: '#334155' },
    { name: 'Vectorless Wins (No data)', value: 1, color: '#475569' }
  ]

  const tooltipDarkStyle = {
    background: '#090d16',
    borderColor: '#334155',
    borderRadius: '10px',
    color: '#f8fafc',
    fontSize: '12px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)'
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 mb-2">
            <Activity className="w-3.5 h-3.5" />
            <span>Telemetry & Human Feedback</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Performance Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Aggregated metrics across dual-axis routing decisions, execution latency, and crowdsourced evaluations.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="btn-secondary flex items-center gap-2 text-xs py-2 px-3.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Analytics
        </button>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Queries */}
        <div className="card p-5 space-y-2 bg-slate-900/80 border border-slate-800 rounded-xl shadow-lg backdrop-blur-md">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Runs</span>
            <Database className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-white tracking-tight">{totalQueries}</span>
            <span className="text-xs text-emerald-400 flex items-center gap-0.5 font-medium"><TrendingUp className="w-3 h-3" /> Live</span>
          </div>
          <p className="text-xs text-slate-400">Queries run across all documents</p>
        </div>

        {/* Avg Vector Latency */}
        <div className="card p-5 space-y-2 bg-slate-900/80 border border-slate-800 rounded-xl shadow-lg backdrop-blur-md">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Vector Latency</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-sky-400 tracking-tight">
              {avgVector ? `${avgVector}ms` : '0ms'}
            </span>
          </div>
          <p className="text-xs text-slate-400">Dense retrieval + LLM synthesis</p>
        </div>

        {/* Avg Vectorless Latency */}
        <div className="card p-5 space-y-2 bg-slate-900/80 border border-slate-800 rounded-xl shadow-lg backdrop-blur-md">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Vectorless Latency</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-emerald-400 tracking-tight">
              {avgVectorless ? `${avgVectorless}ms` : '0ms'}
            </span>
          </div>
          <p className="text-xs text-slate-400">Hierarchical tree navigation</p>
        </div>

        {/* Human Feedback Votes */}
        <div className="card p-5 space-y-2 bg-slate-900/80 border border-slate-800 rounded-xl shadow-lg backdrop-blur-md">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">User Votes</span>
            <ThumbsUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-indigo-300 tracking-tight">{voteStats.total_votes}</span>
          </div>
          <p className="text-xs text-slate-400">Crowdsourced preference votes</p>
        </div>
      </div>

      {/* Latency History & Human Preference */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2 p-6 space-y-4 bg-slate-900/80 border border-slate-800 rounded-xl shadow-lg backdrop-blur-md">
          <h3 className="font-semibold text-white flex items-center gap-2 text-base">
            <Zap className="w-4 h-4 text-indigo-400" /> Latency Over Time (ms)
          </h3>
          <div className="h-[280px]">
            {latencyHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={latencyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVector" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorVectorless" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={tooltipDarkStyle} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area
                    type="monotone"
                    dataKey="Vector"
                    stroke="#38bdf8"
                    fillOpacity={1}
                    fill="url(#colorVector)"
                    strokeWidth={2}
                    connectNulls
                  />
                  <Area
                    type="monotone"
                    dataKey="Vectorless"
                    stroke="#34d399"
                    fillOpacity={1}
                    fill="url(#colorVectorless)"
                    strokeWidth={2}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                Run comparative queries to see latency trends
              </div>
            )}
          </div>
        </div>

        {/* Human Preference (User Voting Stats) */}
        <div className="card p-6 flex flex-col justify-between bg-slate-900/80 border border-slate-800 rounded-xl shadow-lg backdrop-blur-md">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2 text-base">
            <ThumbsUp className="w-4 h-4 text-indigo-400" /> Human Preference (Votes)
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
                <Tooltip contentStyle={tooltipDarkStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-bold font-mono text-white">
                {voteStats.total_votes}
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">Votes</span>
            </div>
          </div>
          
          <div className="space-y-2 mt-4">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Vector Wins
              </span>
              <span className="font-mono text-slate-400">
                {voteStats.vector_wins} ({Math.round(voteStats.vector_win_rate * 100)}%)
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Vectorless Wins
              </span>
              <span className="font-mono text-slate-400">
                {voteStats.vectorless_wins} ({Math.round(voteStats.vectorless_win_rate * 100)}%)
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Ties
              </span>
              <span className="font-mono text-slate-400">
                {voteStats.ties}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Router Recommendation & Query Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Router Recommendation Distribution */}
        <div className="card p-6 space-y-4 bg-slate-900/80 border border-slate-800 rounded-xl shadow-lg backdrop-blur-md">
          <h3 className="font-semibold text-white flex items-center gap-2 text-base">
            <Compass className="w-4 h-4 text-amber-400" /> Router Recommendation Split
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
                <Tooltip contentStyle={tooltipDarkStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-xl font-bold font-mono text-white">
                {totalQueries}
              </span>
              <span className="text-[9px] text-slate-400 uppercase tracking-widest">Queries</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs pt-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="text-slate-300">Parametric ({routerDist.parametric || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-sky-400" />
              <span className="text-slate-300">Vector ({routerDist.vector || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-slate-300">Vectorless ({routerDist.vectorless || 0})</span>
            </div>
          </div>
        </div>

        {/* Query Intent Distribution */}
        <div className="card p-6 space-y-4 bg-slate-900/80 border border-slate-800 rounded-xl shadow-lg backdrop-blur-md">
          <h3 className="font-semibold text-white flex items-center gap-2 text-base">
            <BarChart3 className="w-4 h-4 text-indigo-400" /> Routing Signal Distribution
          </h3>
          <div className="h-[220px]">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipDarkStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#6366f1" opacity={0.9 - (index * 0.1)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500 px-6 text-center">
                No routing decisions logged yet — run a comparison to see signal data.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Query Signal Map (2D Scatter Plot) */}
      <div className="card p-6 space-y-4 bg-slate-900/80 border border-slate-800 rounded-xl shadow-lg backdrop-blur-md">
        <h3 className="font-semibold text-white flex items-center gap-2 text-base">
          <Activity className="w-4 h-4 text-emerald-400" /> Query Signal Map (2D Empirical Scatter)
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Distribution of queries plotted against Mean Token Surprisal S(q) and Named Entity Density D(q). Threshold boundaries θ₁ (11.5 bits) and θ₂ (0.15) partition queries into Parametric, Vector, and Vectorless routing zones.
        </p>
        <div className="h-[320px] w-full">
          {signalMapData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Surprisal"
                  unit=" bits"
                  domain={[0, 40]}
                  stroke="#64748b"
                  fontSize={10}
                >
                  <Label value="Mean Token Surprisal (S) →" offset={-5} position="insideBottom" fill="#94a3b8" fontSize={10} fontStyle="italic" />
                </XAxis>
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Density"
                  domain={[0, 1.0]}
                  stroke="#64748b"
                  fontSize={10}
                >
                  <Label value="Entity Density (D) ↑" angle={-90} position="insideLeft" offset={0} fill="#94a3b8" fontSize={10} fontStyle="italic" />
                </YAxis>
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-2xl max-w-xs text-xs space-y-1.5 text-slate-200">
                          <p className="font-semibold text-white border-b border-slate-800 pb-1">
                            Route: <span className="uppercase font-mono font-bold" style={{ color: data.route === 'parametric' ? '#fbbf24' : data.route === 'vectorless' ? '#34d399' : '#38bdf8' }}>{data.route}</span>
                          </p>
                          <p className="font-medium text-slate-100">Q: "{data.query}"</p>
                          <p className="text-slate-400 font-mono text-[10px] leading-relaxed">Reason: {data.reason}</p>
                          <p className="text-[10px] text-slate-400">S: {data.x.toFixed(2)} | D: {data.y.toFixed(2)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine x={11.5} stroke="#f59e0b" strokeDasharray="3 3" />
                <ReferenceLine y={0.15} stroke="#38bdf8" strokeDasharray="3 3" />
                <Scatter name="Queries" data={signalMapData}>
                  {signalMapData.map((entry, index) => {
                    const color = entry.route === 'parametric' ? '#f59e0b' : entry.route === 'vectorless' ? '#34d399' : '#38bdf8';
                    return <Cell key={`cell-${index}`} fill={color} r={6} />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
              Run comparisons to populate the empirical signal map.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
