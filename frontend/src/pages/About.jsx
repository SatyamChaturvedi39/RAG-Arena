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
      className="space-y-12 max-w-5xl mx-auto text-[var(--color-text)] animate-fade-in"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-[var(--color-primary)]">
          About RAG-Arena
        </h1>
        <p className="text-[var(--color-muted)] max-w-2xl mx-auto text-lg">
          A side-by-side empirical chatbot-arena for evaluating Vector RAG vs Vectorless Hierarchical RAG.
        </p>
      </motion.div>

      {/* Intro Section */}
      <motion.div variants={itemVariants} className="card p-8 bg-white border border-[var(--color-border)] rounded-xl relative overflow-hidden">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-[var(--color-primary)]">
          <BookOpen className="w-6 h-6 text-[var(--color-accent)]" />
          The Research Hypothesis
        </h2>
        <div className="space-y-4 text-[var(--color-text)] leading-relaxed text-base">
          <p>
            Standard <strong>Vector RAG</strong> converts queries into dense embeddings and retrieves document chunks by cosine similarity. It handles broad semantic questions well but is unnecessary for queries the language model can already answer, and suboptimal for queries requiring precise structural navigation.
          </p>
          <p>
            <strong>Vectorless RAG</strong> constructs a hierarchical section tree from the document's own structure — headings, fonts, and numbering — and uses an LLM to navigate it branch by branch. It handles entity-dense and structurally precise queries better than similarity search, with zero embedding cost.
          </p>
          <p>
            <strong>RAG-Arena</strong> implements a Deterministic Dual-Axis Router (DDAR) that analyses each query before retrieval begins and routes it to the most appropriate path: parametric (no retrieval), vector retrieval, or vectorless retrieval. Both pipelines then run so human judges can evaluate whether the router's recommendation matched the better answer.
          </p>
        </div>
      </motion.div>

      {/* Pipelines side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vector RAG Column */}
        <motion.div variants={itemVariants} className="panel-vector p-6 flex flex-col justify-between bg-white border border-[var(--color-border)] rounded-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="badge-vector">Vector RAG</span>
              <Cpu className="w-5 h-5 text-[var(--color-vector)]" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-[var(--color-primary)]">Semantic & Dense Retrieval</h3>
            <ul className="space-y-3 text-[var(--color-text)] text-sm">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-[var(--color-vector)] shrink-0 mt-0.5" />
                <span><strong>Chunking:</strong> Sliding-window splitting (512-token chunks with 64-token overlap).</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-[var(--color-vector)] shrink-0 mt-0.5" />
                <span><strong>Indexing:</strong> Dense vector representations via Gemini <code>gemini-embedding-001</code>.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-[var(--color-vector)] shrink-0 mt-0.5" />
                <span><strong>Retrieval:</strong> Nearest-neighbor cosine search using PostgreSQL <code>pgvector</code> HNSW indices.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-[var(--color-vector)] shrink-0 mt-0.5" />
                <span><strong>Generation:</strong> LLM synthesizes an answer using top-k retrieved text blocks.</span>
              </li>
            </ul>
          </div>
          <div className="mt-6 pt-4 border-t border-[var(--color-border)] text-xs text-[var(--color-accent)] font-semibold">
            ⚡ Best for: Fuzzy semantic queries, keyword cross-referencing, multi-document synthesis.
          </div>
        </motion.div>

        {/* Vectorless RAG Column */}
        <motion.div variants={itemVariants} className="panel-vectorless p-6 flex flex-col justify-between bg-white border border-[var(--color-border)] rounded-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="badge-vectorless">Vectorless RAG</span>
              <Layers className="w-5 h-5 text-[var(--color-vectorless)]" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-[var(--color-primary)]">Hierarchical Navigation</h3>
            <ul className="space-y-3 text-[var(--color-text)] text-sm">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-[var(--color-vectorless)] shrink-0 mt-0.5" />
                <span><strong>Ingestion:</strong> Multi-pass hierarchy parsing (embedded TOC → font heuristics → numbering regex).</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-[var(--color-vectorless)] shrink-0 mt-0.5" />
                <span><strong>Summarization:</strong> Bottom-up summary generation for each internal folder/parent node.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-[var(--color-vectorless)] shrink-0 mt-0.5" />
                <span><strong>Navigation:</strong> LLM evaluates node summaries recursively, selecting the child path to follow.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-[var(--color-vectorless)] shrink-0 mt-0.5" />
                <span><strong>Synthesis:</strong> The final leaf section text is sent to the LLM to write a high-fidelity answer.</span>
              </li>
            </ul>
          </div>
          <div className="mt-6 pt-4 border-t border-[var(--color-border)] text-xs text-[var(--color-vectorless)] font-semibold">
            🌲 Best for: Highly-structured documents, precise section retrieval, structural metadata questions.
          </div>
        </motion.div>
      </div>

      {/* Architecture diagram Section */}
      <motion.div variants={itemVariants} className="card p-8 bg-white border border-[var(--color-border)] rounded-xl">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-[var(--color-primary)]">
          <GitBranch className="w-6 h-6 text-[var(--color-accent)]" />
          RAG-Arena Architecture &amp; Flow
        </h2>

        {/* Clean, hand-crafted decision tree in HTML/CSS */}
        <div className="w-full bg-white rounded-xl p-6 border border-[var(--color-border)] flex flex-col items-center justify-center space-y-4">
          <div className="flex flex-col items-center w-full">
            {/* Input Query */}
            <div className="px-4 py-2 border border-[var(--color-border)] bg-[#F7F9FB] rounded-lg shadow-sm text-center">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--color-muted)] block">Input</span>
              <span className="font-semibold text-sm text-[var(--color-primary)]">Incoming Query (q)</span>
            </div>
            
            {/* Arrow */}
            <div className="h-6 w-0.5 bg-[var(--color-border)] relative">
              <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-[var(--color-border)]" />
            </div>
            
            {/* Axis 1 Box */}
            <div className="px-5 py-3 border border-[var(--color-border)] bg-white rounded-xl shadow-sm text-center max-w-sm">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-signal-1)] font-bold block mb-1">Axis 1: Retrieval Necessity</span>
              <span className="text-xs text-[var(--color-text)] block mb-1">
                Computes mean token surprisal <strong>S(q)</strong> against the Google Web Trillion Word corpus.
              </span>
            </div>
            
            {/* Arrow */}
            <div className="h-6 w-0.5 bg-[var(--color-border)] relative">
              <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-[var(--color-border)]" />
            </div>
            
            {/* Decision Gate 1 */}
            <div className="px-4 py-2 border-2 border-dashed border-[var(--color-signal-1)] bg-slate-50 rounded-lg text-center font-mono text-xs font-bold text-[var(--color-text)]">
              S(q) &lt; 11.5 bits?
            </div>
            
            {/* Yes/No Split */}
            <div className="w-full max-w-xl flex justify-between relative mt-2 px-10">
              {/* Horizontal line connector */}
              <div className="absolute top-0 left-[18%] right-[18%] h-0.5 bg-[var(--color-border)]" />
              
              {/* Left Branch (YES) */}
              <div className="flex flex-col items-center w-1/2">
                <div className="h-6 w-0.5 bg-[var(--color-border)] relative">
                  <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-[var(--color-border)]" />
                </div>
                <div className="font-mono text-[10px] text-emerald-600 font-bold mb-1">YES</div>
                <div className="px-4 py-2 bg-[#E6A817]/10 border border-[#E6A817] text-[#E6A817] rounded-lg text-center font-semibold text-xs shadow-sm max-w-[160px]">
                  PARAMETRIC
                  <span className="block text-[9px] font-normal text-slate-500 font-mono mt-0.5">(No retrieval)</span>
                </div>
              </div>
              
              {/* Right Branch (NO) */}
              <div className="flex flex-col items-center w-1/2">
                <div className="h-6 w-0.5 bg-[var(--color-border)] relative">
                  <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-[var(--color-border)]" />
                </div>
                <div className="font-mono text-[10px] text-red-500 font-bold mb-1">NO</div>
                
                {/* Axis 2 Box */}
                <div className="px-5 py-3 border border-[var(--color-border)] bg-white rounded-xl shadow-sm text-center max-w-xs">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-signal-2)] font-bold block mb-1">Axis 2: Retrieval Mode</span>
                  <span className="text-xs text-[var(--color-text)] block mb-1">
                    Computes entity density <strong>D(q)</strong> and SQT flag.
                  </span>
                </div>
                
                {/* Arrow */}
                <div className="h-6 w-0.5 bg-[var(--color-border)] relative">
                  <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-[var(--color-border)]" />
                </div>
                
                {/* Decision Gate 2 */}
                <div className="px-4 py-2 border-2 border-dashed border-[var(--color-signal-2)] bg-slate-50 rounded-lg text-center font-mono text-xs font-bold text-[var(--color-text)]">
                  D(q) &gt; 0.15 or SQT = True?
                </div>
                
                {/* YES/NO branch Axis 2 */}
                <div className="w-full flex justify-between relative mt-2 px-4">
                  {/* Connector line */}
                  <div className="absolute top-0 left-[25%] right-[25%] h-0.5 bg-[var(--color-border)]" />
                  
                  {/* Left (YES) */}
                  <div className="flex flex-col items-center w-1/2">
                    <div className="h-6 w-0.5 bg-[var(--color-border)] relative">
                      <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-[var(--color-border)]" />
                    </div>
                    <div className="font-mono text-[10px] text-emerald-700 font-bold mb-1">YES</div>
                    <div className="px-4 py-2 bg-[#2D6A4F]/10 border border-[#2D6A4F] text-[#2D6A4F] rounded-lg text-center font-semibold text-xs shadow-sm max-w-[140px]">
                      VECTORLESS
                      <span className="block text-[9px] font-normal text-slate-500 font-mono mt-0.5">(Section nav)</span>
                    </div>
                  </div>
                  
                  {/* Right (NO) */}
                  <div className="flex flex-col items-center w-1/2">
                    <div className="h-6 w-0.5 bg-[var(--color-border)] relative">
                      <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-[var(--color-border)]" />
                    </div>
                    <div className="font-mono text-[10px] text-red-500 font-bold mb-1">NO</div>
                    <div className="px-4 py-2 bg-[#1A6B8A]/10 border border-[#1A6B8A] text-[#1A6B8A] rounded-lg text-center font-semibold text-xs shadow-sm max-w-[140px]">
                      VECTOR
                      <span className="block text-[9px] font-normal text-slate-500 font-mono mt-0.5">(Dense index)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Reconvergence Flow */}
            <div className="w-full flex justify-center relative mt-8">
              {/* Connector lines to convergence */}
              <div className="absolute -top-8 left-[18%] right-[18%] h-0.5 bg-[var(--color-border)]" />
              <div className="flex flex-col items-center">
                <div className="h-8 w-0.5 bg-[var(--color-border)] relative">
                  <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-[var(--color-border)]" />
                </div>
                <div className="px-5 py-3 border border-[var(--color-border)] bg-[#0C3547] text-white rounded-xl shadow-md text-center max-w-sm">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate-300 block mb-1">Answer Generation</span>
                  <span className="text-xs font-semibold block">Llama 3.3-70B-Versatile</span>
                  <span className="block text-[9px] text-slate-300 mt-0.5 font-mono">Final Response</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* DDAR Section */}
      <motion.div variants={itemVariants} className="card p-8 bg-white border border-[var(--color-border)] rounded-xl">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-[var(--color-primary)]">
          <Zap className="w-6 h-6 text-[var(--color-accent)]" />
          The Dual-Axis Routing Mechanism
        </h2>
        <p className="text-[var(--color-muted)] text-sm mb-6 leading-relaxed">
          Rather than blindly running queries, the backend uses two sequential, deterministic gates to route
          each query — with zero neural model calls involved in the decision itself.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Axis 1 */}
          <div className="p-4 bg-slate-50 rounded-xl border border-[var(--color-border)]">
            <span className="text-[var(--color-signal-1)] font-mono text-lg font-bold">01.</span>
            <h4 className="font-bold my-2 text-[var(--color-primary)]">Axis 1 — Retrieval Necessity</h4>
            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              Computes the mean token surprisal <strong>S(q)</strong> of the query against Peter Norvig's
              English word-frequency corpus (the full Norvig English word-frequency corpus, approximately 333,000 words representing ~1.02 trillion tokens from the Google Web Trillion Word Corpus). Common
              words have low surprisal; rare or technical words have high surprisal. If S(q) &lt; θ1
              (11.5 bits), the query is answered directly from the language model's parametric
              knowledge — no retrieval, no embedding call.
            </p>
          </div>
          {/* Axis 2 */}
          <div className="p-4 bg-slate-50 rounded-xl border border-[var(--color-border)]">
            <span className="text-[var(--color-signal-2)] font-mono text-lg font-bold">02.</span>
            <h4 className="font-bold my-2 text-[var(--color-primary)]">Axis 2 — Retrieval Mode</h4>
            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              Computes Named Entity Density <strong>D(q)</strong>: the fraction of query tokens that are
              identifiable as named entities, codes, dates, or structured identifiers (detected by regex + high-surprisal lookup). Also checks a Syntactic Query Type flag <strong>SQT(q)</strong> that fires on
              section references, DOI/ISBN patterns, and field-value lookups. If D(q) &gt; θ2 (0.15) or SQT
              fires → Vectorless. Otherwise → Vector.
            </p>
          </div>
          {/* Three routes */}
          <div className="p-4 bg-slate-50 rounded-xl border border-[var(--color-border)]">
            <span className="text-[var(--color-vectorless)] font-mono text-lg font-bold">03.</span>
            <h4 className="font-bold my-2 text-[var(--color-primary)]">Three Possible Outcomes</h4>
            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              Every query lands on exactly one path:{' '}
              <span className="text-[#E6A817] font-semibold">Parametric</span> (S(q) below threshold — model
              answers from memory),{' '}
              <span className="text-[#1A6B8A] font-semibold">Vector</span> (high surprisal, low entity
              density — semantic embedding search via pgvector), or{' '}
              <span className="text-[#2D6A4F] font-semibold">Vectorless</span> (high surprisal, high entity
              density or structural pattern — LLM navigates the document section tree directly).
            </p>
          </div>
        </div>
      </motion.div>

      {/* Footer Info */}
      <motion.div variants={itemVariants} className="flex justify-center items-center gap-6 py-6 text-slate-500 text-sm">
        <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-slate-400" /> MIT Licensed</span>
        <span>·</span>
        <span className="flex items-center gap-1.5"><Award className="w-4 h-4 text-slate-400" /> Academic Portfolio</span>
      </motion.div>
    </motion.div>
  )
}
