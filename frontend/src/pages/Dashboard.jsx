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
  Legend
} from 'recharts'
import {
  getMetricsSummary,
  getMetricsHistory,
  getVoteStats
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
      const [summaryRes, historyRes, votesRes] = await Promise.all([
        getMetricsSummary(30), // Past 30 days
        getMetricsHistory(100),
        getVoteStats()
      ])

      setSummary(summaryRes.data)
      
      // Process latency points for the AreaChart
      const pts = historyRes.data.points || []
      // Group points by approx time or order them sequentially
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

      if (votesRes.data) {
        setVoteStats(votesRes.data)
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
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
        <span className="text-sm text-zinc-400">Aggregating database telemetry...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-8 text-center max-w-md mx-auto space-y-4 my-12 border-red-500/20 bg-red-950/5">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <HelpCircle className="w-6 h-6 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-200">Failed to load telemetry</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">{error}</p>
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
  const routerDist = summary?.router_recommendation_distribution || { vector: 0, vectorless: 0 }
  const routerPieData = [
    { name: 'Vector RAG', value: routerDist.vector || 0, color: '#f59e0b' },
    { name: 'Vectorless RAG', value: routerDist.vectorless || 0, color: '#10b981' }
  ].filter(d => d.value > 0)

  // Fallback pie data to show a nice mock if empty
  const activePieData = routerPieData.length > 0 ? routerPieData : [
    { name: 'Vector RAG (No data)', value: 1, color: '#4b5563' },
    { name: 'Vectorless RAG (No data)', value: 1, color: '#374151' }
  ]

  // Bar chart data for Query Type distribution
  const typeCounts = summary?.queries_by_type || {}
  const barData = Object.entries(typeCounts).map(([type, count]) => ({
    name: type.replace('_', ' '),
    count: count
  }))

  const votePieData = [
    { name: 'Vector Wins', value: voteStats.vector_wins || 0, color: '#fbbf24' },
    { name: 'Vectorless Wins', value: voteStats.vectorless_wins || 0, color: '#34d399' },
    { name: 'Ties', value: voteStats.ties || 0, color: '#60a5fa' }
  ].filter(d => d.value > 0)

  const activeVotePieData = votePieData.length > 0 ? votePieData : [
    { name: 'Vector Wins (No data)', value: 1, color: '#4b5563' },
    { name: 'Vectorless Wins (No data)', value: 1, color: '#374151' }
  ]

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="w-8 h-8 text-indigo-400" />
            Performance <span className="text-gradient">Analytics</span>
          </h1>
          <p className="text-sm text-zinc-400">
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
        <div className="metric-card space-y-2">
          <div className="flex justify-between items-center text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Runs</span>
            <Database className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-zinc-100">{totalQueries}</span>
            <span className="text-xs text-emerald-400 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> Live</span>
          </div>
          <p className="text-xs text-zinc-500">Queries run across all documents</p>
        </div>

        {/* Avg Vector Latency */}
        <div className="metric-card space-y-2 border-amber-500/10">
          <div className="flex justify-between items-center text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Vector Latency</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-amber-400">
              {avgVector ? `${avgVector}ms` : '0ms'}
            </span>
          </div>
          <p className="text-xs text-zinc-500">Dense retrieval + LLM synthesis</p>
        </div>

        {/* Avg Vectorless Latency */}
        <div className="metric-card space-y-2 border-emerald-500/10">
          <div className="flex justify-between items-center text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Vectorless Latency</span>
            <Clock className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-emerald-400">
              {avgVectorless ? `${avgVectorless}ms` : '0ms'}
            </span>
          </div>
          <p className="text-xs text-zinc-500">Multi-pass tree traversal</p>
        </div>

        {/* Human Feedback Votes */}
        <div className="metric-card space-y-2 border-indigo-500/10">
          <div className="flex justify-between items-center text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider">User Votes</span>
            <ThumbsUp className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-indigo-400">{voteStats.total_votes}</span>
          </div>
          <p className="text-xs text-zinc-500">Preferred answers recorded</p>
        </div>
      </div>

      {/* Latency History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2 p-6 space-y-4">
          <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-400" /> Latency Over Time (ms)
          </h3>
          <div className="h-[280px]">
            {latencyHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={latencyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVector" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorVectorless" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#18181b',
                      borderColor: '#3f3f46',
                      borderRadius: '8px',
                      color: '#f4f4f5',
                      fontSize: '12px'
                    }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area
                    type="monotone"
                    dataKey="Vector"
                    stroke="#f59e0b"
                    fillOpacity={1}
                    fill="url(#colorVector)"
                    strokeWidth={2}
                    connectNulls
                  />
                  <Area
                    type="monotone"
                    dataKey="Vectorless"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorVectorless)"
                    strokeWidth={2}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center border border-dashed border-zinc-800 rounded-xl text-xs text-zinc-500">
                Run comparative queries to see latency trends
              </div>
            )}
          </div>
        </div>

        {/* Human Preference (User Voting Stats) */}
        <div className="card p-6 flex flex-col justify-between">
          <h3 className="font-semibold text-zinc-200 mb-4 flex items-center gap-2">
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
                <Tooltip
                  contentStyle={{
                    background: '#18181b',
                    borderColor: '#3f3f46',
                    borderRadius: '8px',
                    color: '#f4f4f5',
                    fontSize: '11px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-bold font-mono text-zinc-200">
                {voteStats.total_votes}
              </span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Votes</span>
            </div>
          </div>
          
          <div className="space-y-2 mt-4">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Vector Wins</span>
              <span className="font-mono text-zinc-300">
                {voteStats.vector_wins} ({Math.round(voteStats.vector_win_rate * 100)}%)
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Vectorless Wins</span>
              <span className="font-mono text-zinc-300">
                {voteStats.vectorless_wins} ({Math.round(voteStats.vectorless_win_rate * 100)}%)
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Ties</span>
              <span className="font-mono text-zinc-300">
                {voteStats.ties}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Router Recommendation & Query Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Router Recommendation Distribution */}
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-400" /> Router Recommendation Split
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
                    background: '#18181b',
                    borderColor: '#3f3f46',
                    borderRadius: '8px',
                    color: '#f4f4f5',
                    fontSize: '11px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-xl font-bold font-mono text-zinc-200">
                {totalQueries}
              </span>
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Queries</span>
            </div>
          </div>

          <div className="flex justify-center gap-8 text-xs pt-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-zinc-400">Vector ({routerDist.vector || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-zinc-400">Vectorless ({routerDist.vectorless || 0})</span>
            </div>
          </div>
        </div>

        {/* Query Intent Distribution */}
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" /> Classified Query Intent
          </h3>
          <div className="h-[220px]">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#52525b" fontSize={9} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={9} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#18181b',
                      borderColor: '#3f3f46',
                      borderRadius: '8px',
                      color: '#f4f4f5',
                      fontSize: '11px'
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#6366f1" opacity={0.8 - (index * 0.1)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center border border-dashed border-zinc-800 rounded-xl text-xs text-zinc-500">
                No query logs registered yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
