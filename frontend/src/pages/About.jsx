import React from 'react'
import { motion } from 'framer-motion'
import { GitBranch, Shield, Zap, Cpu, Award, BookOpen, ChevronRight, Layers, FileText } from 'lucide-react'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 }
  }
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } }
}

export default function About() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12 max-w-5xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          About <span className="text-gradient">RAG-Arena</span>
        </h1>
        <p className="text-zinc-400 max-w-2xl mx-auto text-lg">
          A side-by-side empirical chatbot-arena for evaluating Vector RAG vs Vectorless Hierarchical RAG.
        </p>
      </motion.div>

      {/* Intro Section */}
      <motion.div variants={itemVariants} className="card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-zinc-100">
          <BookOpen className="w-6 h-6 text-indigo-400" />
          The Research Hypothesis
        </h2>
        <div className="space-y-4 text-zinc-300 leading-relaxed text-base">
          <p>
            Standard <strong>Vector RAG</strong> splits documents into flat, arbitrary chunks and embeds them. While highly effective for semantic and fuzzy searches, it fails on complex structured documents (like 10-K financial reports, legal contracts, and technical specifications) because it lacks <strong>structural awareness</strong> and struggle with precise hierarchical context.
          </p>
          <p>
            <strong>Vectorless RAG</strong> (or Hierarchical Navigation RAG) constructs an interactive, nested document hierarchy from section titles, fonts, and numbering systems. It then uses an LLM to navigate the tree from the root node to the specific leaf node containing the answer, preserving parent-child summaries and context at every depth.
          </p>
          <p>
            <strong>RAG-Arena</strong> allows users to run both pipelines in parallel on any PDF to evaluate which paradigm performs better, collect crowdsourced preference votes, and evaluate accuracy and latency under controlled environments.
          </p>
        </div>
      </motion.div>

      {/* Pipelines side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vector RAG Column */}
        <motion.div variants={itemVariants} className="panel-vector p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="badge-vector">Vector RAG</span>
              <Cpu className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-zinc-200">Semantic & Dense Retrieval</h3>
            <ul className="space-y-3 text-zinc-300 text-sm">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span><strong>Chunking:</strong> Sliding-window splitting (e.g. 500-token chunks with 50-token overlap).</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span><strong>Indexing:</strong> Dense vector representations via Gemini <code>gemini-embedding-001</code>.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span><strong>Retrieval:</strong> Nearest-neighbor cosine search using PostgreSQL <code>pgvector</code> HNSW indices.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span><strong>Generation:</strong> LLM synthesizes an answer using top-k retrieved text blocks.</span>
              </li>
            </ul>
          </div>
          <div className="mt-6 pt-4 border-t border-amber-500/10 text-xs text-amber-400">
            ⚡ Best for: Fuzzy semantic queries, keyword cross-referencing, multi-document synthesis.
          </div>
        </motion.div>

        {/* Vectorless RAG Column */}
        <motion.div variants={itemVariants} className="panel-vectorless p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="badge-vectorless">Vectorless RAG</span>
              <Layers className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-zinc-200">Hierarchical Navigation</h3>
            <ul className="space-y-3 text-zinc-300 text-sm">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Ingestion:</strong> Multi-pass hierarchy parsing (embedded TOC → font heuristics → numbering regex).</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Summarization:</strong> Bottom-up summary generation for each internal folder/parent node.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Navigation:</strong> LLM evaluates node summaries recursively, selecting the child path to follow.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Synthesis:</strong> The final leaf section text is sent to the LLM to write a high-fidelity answer.</span>
              </li>
            </ul>
          </div>
          <div className="mt-6 pt-4 border-t border-emerald-500/10 text-xs text-emerald-400">
            🌲 Best for: Highly-structured documents, precise section retrieval, structural metadata questions.
          </div>
        </motion.div>
      </div>

      {/* Architecture diagram Section */}
      <motion.div variants={itemVariants} className="card p-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-indigo-400" />
          RAG-Arena Architecture & Flow
        </h2>
        
        {/* Interactive SVG Diagram */}
        <div className="w-full bg-zinc-950/80 rounded-xl p-4 md:p-6 border border-zinc-800 flex items-center justify-center overflow-x-auto">
          <svg className="w-full min-w-[700px] h-auto max-h-[360px]" viewBox="0 0 800 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Background Grid */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.015)" strokeWidth="1" />
              </pattern>
              <linearGradient id="vector-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(245, 158, 11, 0.2)" />
                <stop offset="100%" stopColor="rgba(245, 158, 11, 0.05)" />
              </linearGradient>
              <linearGradient id="vectorless-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(16, 185, 129, 0.2)" />
                <stop offset="100%" stopColor="rgba(16, 185, 129, 0.05)" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Input node */}
            <rect x="20" y="160" width="100" height="60" rx="8" fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" />
            <text x="70" y="195" fill="#f4f4f5" fontFamily="monospace" fontSize="13" textAnchor="middle">Query/PDF</text>

            {/* Ingestion Router node */}
            <rect x="180" y="150" width="120" height="80" rx="8" fill="#1e1b4b" stroke="#4338ca" strokeWidth="1.5" />
            <text x="240" y="185" fill="#e0e7ff" fontFamily="sans-serif" fontSize="13" fontWeight="bold" textAnchor="middle">AI Router</text>
            <text x="240" y="205" fill="#a5b4fc" fontFamily="sans-serif" fontSize="10" textAnchor="middle">Decision Matrix</text>

            {/* Connectors to Router */}
            <path d="M 120 190 L 180 190" stroke="#52525b" strokeWidth="2" markerEnd="url(#arrow)" />

            {/* Vector RAG Flow */}
            <path d="M 300 170 C 350 120, 370 100, 420 100" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" />
            <rect x="420" y="70" width="140" height="60" rx="8" fill="url(#vector-grad)" stroke="#d97706" strokeWidth="1.5" />
            <text x="490" y="95" fill="#fef3c7" fontFamily="sans-serif" fontSize="12" fontWeight="bold" textAnchor="middle">Vector Pipeline</text>
            <text x="490" y="112" fill="#d97706" fontFamily="monospace" fontSize="10" textAnchor="middle">pgvector HNSW</text>

            {/* Vectorless RAG Flow */}
            <path d="M 300 210 C 350 260, 370 280, 420 280" stroke="#10b981" strokeWidth="2" strokeDasharray="4 2" />
            <rect x="420" y="250" width="140" height="60" rx="8" fill="url(#vectorless-grad)" stroke="#059669" strokeWidth="1.5" />
            <text x="490" y="275" fill="#ecfdf5" fontFamily="sans-serif" fontSize="12" fontWeight="bold" textAnchor="middle">Vectorless Tree</text>
            <text x="490" y="292" fill="#059669" fontFamily="monospace" fontSize="10" textAnchor="middle">Hierarchical Nav</text>

            {/* Generation & Evaluation */}
            <rect x="640" y="150" width="130" height="80" rx="8" fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" />
            <text x="705" y="185" fill="#f4f4f5" fontFamily="sans-serif" fontSize="13" fontWeight="bold" textAnchor="middle">Arena Synthesis</text>
            <text x="705" y="205" fill="#10b981" fontFamily="sans-serif" fontSize="10" textAnchor="middle">User Voting & Stats</text>

            {/* Arrows to Synthesis */}
            <path d="M 560 100 C 600 100, 610 160, 640 170" stroke="#f59e0b" strokeWidth="1.5" />
            <path d="M 560 280 C 600 280, 610 220, 640 210" stroke="#10b981" strokeWidth="1.5" />

            {/* Marker definitions */}
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#52525b" />
              </marker>
            </defs>
          </svg>
        </div>
      </motion.div>

      {/* Router Decision Matrix Section */}
      <motion.div variants={itemVariants} className="card p-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Zap className="w-6 h-6 text-indigo-400" />
          The Router Decision Matrix
        </h2>
        <div className="space-y-6 text-zinc-300 text-base leading-relaxed">
          <p>
            Rather than blindly running queries, the backend uses a fast, lightweight <strong>Query Classifier</strong> to predict which pipeline will serve the query best based on three signals:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
              <span className="text-indigo-400 font-mono text-lg font-bold">01.</span>
              <h4 className="font-bold my-2 text-zinc-200">Document Structure</h4>
              <p className="text-sm text-zinc-400">
                A quantitative score (0.0 to 1.0) of how structured the PDF parser found the document hierarchy. Highly structured documents favor tree navigation.
              </p>
            </div>
            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
              <span className="text-indigo-400 font-mono text-lg font-bold">02.</span>
              <h4 className="font-bold my-2 text-zinc-200">Document Class</h4>
              <p className="text-sm text-zinc-400">
                Identified class (Financial, Technical, Legal, General). Financial tables and technical specs favor vectorless structured trees; general texts favor vector.
              </p>
            </div>
            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
              <span className="text-indigo-400 font-mono text-lg font-bold">03.</span>
              <h4 className="font-bold my-2 text-zinc-200">Query Intent</h4>
              <p className="text-sm text-zinc-400">
                Classified as <code>precise_factual</code> (e.g. "What was Q3 revenue on page 14?"), <code>fuzzy_semantic</code>, or <code>multi_hop</code>. Precise factual favors vectorless.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Footer Info */}
      <motion.div variants={itemVariants} className="flex justify-center items-center gap-6 py-6 text-slate-500 text-sm">
        <span className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> MIT Licensed</span>
        <span>·</span>
        <span className="flex items-center gap-1.5"><Award className="w-4 h-4" /> Academic Portfolio</span>
      </motion.div>
    </motion.div>
  )
}
