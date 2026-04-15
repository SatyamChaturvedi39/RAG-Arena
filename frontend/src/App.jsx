import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home'
import Compare from './pages/Compare'
import Evaluation from './pages/Evaluation'
import ServerStatus from './components/ServerStatus'

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? 'bg-accent-500/20 text-accent-300'
            : 'text-slate-400 hover:text-slate-200 hover:bg-surface-700'
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
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-surface-700 bg-surface-800/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="font-mono font-medium text-white tracking-tight">
                RAG<span className="text-accent-400">Arena</span>
              </span>
              <nav className="flex items-center gap-1">
                <NavItem to="/">Documents</NavItem>
                <NavItem to="/compare">Compare</NavItem>
                <NavItem to="/eval">Evaluation</NavItem>
              </nav>
            </div>
            <ServerStatus />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/eval" element={<Evaluation />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-surface-700 py-3 text-center text-xs text-slate-600">
          RAG-Arena — open source · free tier only ·{' '}
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
