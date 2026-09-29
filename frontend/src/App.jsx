import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Scale, Sparkles } from 'lucide-react'
import Home from './pages/Home'
import Compare from './pages/Compare'
import History from './pages/History'
import Dashboard from './pages/Dashboard'
import About from './pages/About'
import Evaluation from './pages/Evaluation'
import ServerStatus from './components/ServerStatus'

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<motion.div {...pageVariants}><Home /></motion.div>} />
        <Route path="/compare" element={<motion.div {...pageVariants}><Compare /></motion.div>} />
        <Route path="/history" element={<motion.div {...pageVariants}><History /></motion.div>} />
        <Route path="/dashboard" element={<motion.div {...pageVariants}><Dashboard /></motion.div>} />
        <Route path="/evaluation" element={<motion.div {...pageVariants}><Evaluation /></motion.div>} />
        <Route path="/about" element={<motion.div {...pageVariants}><About /></motion.div>} />
      </Routes>
    </AnimatePresence>
  )
}

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
          isActive
            ? 'text-white bg-indigo-500/15 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-[#090D16] text-slate-100">
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#090D16]/80 border-b border-slate-800/80">
          <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <NavLink
                to="/"
                className="flex items-center gap-2.5 select-none group"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-indigo-500 to-sky-500 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
                  <Scale className="w-4 h-4 text-white" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-lg tracking-tight text-white font-mono">
                    RAG<span className="text-indigo-400">-Arena</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Dual-Axis
                  </span>
                </div>
              </NavLink>
              <nav className="flex items-center gap-1">
                <NavItem to="/dashboard">Dashboard</NavItem>
                <NavItem to="/evaluation">Evaluation</NavItem>
                <NavItem to="/">Documents</NavItem>
                <NavItem to="/compare">Compare</NavItem>
                <NavItem to="/history">History</NavItem>
                <NavItem to="/about">About</NavItem>
              </nav>
            </div>
            <ServerStatus />
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto w-full px-5 py-8">
          <AnimatedRoutes />
        </main>

        <footer className="border-t py-6 text-center text-xs text-slate-500 border-slate-800/80">
          <div className="flex items-center justify-center gap-3">
            <span>RAG-Arena · Side-by-Side Benchmarking & Deterministic Routing</span>
            <span>·</span>
            <a
              href="https://github.com/SatyamChaturvedi39/RAG-Arena"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-indigo-400 transition-colors"
            >
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  )
}
