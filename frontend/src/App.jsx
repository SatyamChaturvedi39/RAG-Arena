import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Scale } from 'lucide-react'
import Home from './pages/Home'
import Compare from './pages/Compare'
import History from './pages/History'
import Dashboard from './pages/Dashboard'
import About from './pages/About'
import Evaluation from './pages/Evaluation'
import ServerStatus from './components/ServerStatus'

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.14 } },
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
        `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'text-white' : 'text-slate-300 hover:text-white'
        }`
      }
      style={({ isActive }) => isActive ? {
        background: 'rgba(26, 107, 138, 0.3)',
        boxShadow: 'inset 0 0 0 1px rgba(26, 107, 138, 0.4)',
      } : {}}
    >
      {children}
    </NavLink>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <header
          className="sticky top-0 z-50 border-b text-white"
          style={{
            background: '#0C3547',
            borderColor: 'rgba(255, 255, 255, 0.15)',
          }}
        >
          <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
            <div className="flex items-center gap-7">
              <NavLink
                to="/"
                className="flex items-center gap-2 select-none group"
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(26, 107, 138, 0.3)', border: '1px solid rgba(26, 107, 138, 0.4)' }}
                >
                  <Scale className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-mono font-semibold text-base tracking-tight text-white">
                  RAG-Arena
                </span>
              </NavLink>
              <nav className="flex items-center gap-0.5">
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

        <footer
          className="border-t py-4 text-center text-s text-slate-600"
          style={{ borderColor: 'rgba(30, 45, 66, 0.5)' }}
        >
          RAG-Arena ·{' '}
          <a
            href="https://github.com/SatyamChaturvedi39/RAG-Arena"
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-400 transition-colors"
          >
            GitHub
          </a>
        </footer>
      </div>
    </BrowserRouter>
  )
}
