import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Home from './pages/Home'
import Compare from './pages/Compare'
import Evaluation from './pages/Evaluation'
import ServerStatus from './components/ServerStatus'

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.14 } },
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/"       element={<motion.div {...pageVariants}><Home /></motion.div>} />
        <Route path="/compare" element={<motion.div {...pageVariants}><Compare /></motion.div>} />
        <Route path="/eval"    element={<motion.div {...pageVariants}><Evaluation /></motion.div>} />
      </Routes>
    </AnimatePresence>
  )
}

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
        }`
      }
      style={({ isActive }) => isActive ? {
        background: 'rgba(99, 102, 241, 0.15)',
        boxShadow: 'inset 0 0 0 1px rgba(99, 102, 241, 0.22)',
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
          className="sticky top-0 z-50 border-b"
          style={{
            background: 'rgba(8, 13, 22, 0.82)',
            borderColor: 'rgba(30, 45, 66, 0.6)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
            <div className="flex items-center gap-7">
              <span className="font-mono font-semibold text-base tracking-tight select-none">
                RAG<span className="text-gradient">Arena</span>
              </span>
              <nav className="flex items-center gap-0.5">
                <NavItem to="/">Documents</NavItem>
                <NavItem to="/compare">Compare</NavItem>
                <NavItem to="/eval">Evaluation</NavItem>
              </nav>
            </div>
            <ServerStatus />
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto w-full px-5 py-8">
          <AnimatedRoutes />
        </main>

        <footer
          className="border-t py-4 text-center text-xs text-slate-600"
          style={{ borderColor: 'rgba(30, 45, 66, 0.5)' }}
        >
          RAG-Arena · open source · free tier only ·{' '}
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
