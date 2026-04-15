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
        `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'text-white'
            : 'text-slate-500 hover:text-slate-300'
        }`
      }
      style={({ isActive }) => isActive ? {
        background: 'rgba(99, 102, 241, 0.15)',
        boxShadow: 'inset 0 0 0 1px rgba(99, 102, 241, 0.2)',
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
        {/* Header */}
        <header
          className="sticky top-0 z-50 border-b"
          style={{
            background: 'rgba(8, 13, 22, 0.80)',
            borderColor: 'rgba(30, 45, 66, 0.6)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
            <div className="flex items-center gap-7">
              {/* Logo */}
              <span className="font-mono font-semibold text-base tracking-tight select-none">
                RAG<span className="text-gradient">Arena</span>
              </span>

              {/* Nav */}
              <nav className="flex items-center gap-0.5">
                <NavItem to="/">Documents</NavItem>
                <NavItem to="/compare">Compare</NavItem>
                <NavItem to="/eval">Evaluation</NavItem>
              </nav>
            </div>

            <ServerStatus />
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-5 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/eval" element={<Evaluation />} />
          </Routes>
        </main>

        {/* Footer */}
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
