import React from 'react'
import { motion } from 'framer-motion'
import { GitBranch, Shield, Zap, Cpu, Award, BookOpen, ChevronRight, Layers, Sparkles, CheckCircle2 } from 'lucide-react'

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
      className="space-y-10 max-w-5xl mx-auto text-slate-200 animate-fade-in"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center space-y-3 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Research Foundations & Architecture</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
          About RAG-Arena
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
          An empirical side-by-side benchmarking platform evaluating dense Vector RAG vs. Vectorless Hierarchical Tree RAG under the Deterministic Dual-Axis Router (DDAR).
        </p>
      </motion.div>

      {/* Intro Section */}
      <motion.div
        variants={itemVariants}
        className="card p-7 sm:p-8 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md relative overflow-hidden"
      >
        <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2.5 text-white">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          The Research Hypothesis
        </h2>
        <div className="space-y-4 text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            Standard <strong className="text-sky-300">Vector RAG</strong> converts documents and queries into dense embeddings, retrieving top chunks via cosine similarity. While effective for broad associative questions, it wastes API calls and compute on queries the model already knows (open-domain common knowledge), and frequently loses structural context in nested documents.
          </p>
          <p>
            <strong className="text-emerald-300">Vectorless RAG</strong> extracts the document's true section hierarchy (headings, TOC, numbering) at ingest time. An LLM recursively navigates this tree branch by branch—eliminating vector database lookups and embedding costs completely while preserving hierarchical context.
          </p>
          <p>
            <strong className="text-amber-300">RAG-Arena</strong> introduces the <em>Deterministic Dual-Axis Router (DDAR)</em>: an upfront zero-neural-inference classifier that computes query token surprisal $S(q)$ and named entity density $D(q)$. It deterministically routes queries to <span className="text-amber-400 font-semibold">Parametric (No retrieval)</span>, <span className="text-sky-400 font-semibold">Vector RAG</span>, or <span className="text-emerald-400 font-semibold">Vectorless RAG</span>, enabling direct comparative evaluation and human preference benchmarking.
          </p>
        </div>
      </motion.div>

      {/* Pipelines side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vector RAG Column */}
        <motion.div
          variants={itemVariants}
          className="p-6 flex flex-col justify-between bg-slate-900/80 border border-sky-500/20 rounded-2xl shadow-lg backdrop-blur-md"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="badge-vector">Vector RAG</span>
              <Cpu className="w-5 h-5 text-sky-400" />
            </div>
            <h3 className="text-lg font-bold mb-3 text-white">Semantic & Dense Similarity</h3>
            <ul className="space-y-3 text-slate-300 text-sm">
              <li className="flex items-start gap-2.5">
                <ChevronRight className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span><strong className="text-slate-100">Chunking:</strong> Sliding-window splitting (512-token chunks, 64-token overlap).</span>
              </li>
              <li className="flex items-start gap-2.5">
                <ChevronRight className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span><strong className="text-slate-100">Indexing:</strong> Dense 768-dim embeddings via Google Gemini <code>text-embedding-004</code>.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <ChevronRight className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span><strong className="text-slate-100">Retrieval:</strong> Cosine similarity search using PostgreSQL <code>pgvector</code> HNSW indices.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <ChevronRight className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span><strong className="text-slate-100">Generation:</strong> LLM synthesizes an answer conditioned on top-k retrieved chunks.</span>
              </li>
            </ul>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-sky-300 font-medium">
            ⚡ Optimal for: Fuzzy semantic queries, keyword matches across disjoint text chunks.
          </div>
        </motion.div>

        {/* Vectorless RAG Column */}
        <motion.div
          variants={itemVariants}
          className="p-6 flex flex-col justify-between bg-slate-900/80 border border-emerald-500/20 rounded-2xl shadow-lg backdrop-blur-md"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="badge-vectorless">Vectorless RAG</span>
              <Layers className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold mb-3 text-white">Hierarchical Tree Navigation</h3>
            <ul className="space-y-3 text-slate-300 text-sm">
              <li className="flex items-start gap-2.5">
                <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-slate-100">Ingestion:</strong> Multi-pass hierarchy parsing (TOC bookmarks, font heuristics, numbering regex).</span>
              </li>
              <li className="flex items-start gap-2.5">
                <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-slate-100">Summarization:</strong> Bottom-up summary generation for each section tree node.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-slate-100">Navigation:</strong> LLM evaluates node summaries recursively, selecting branches to descend.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-slate-100">Synthesis:</strong> Final targeted leaf text is provided for high-precision answer synthesis.</span>
              </li>
            </ul>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-emerald-300 font-medium">
            🌲 Optimal for: Highly-structured documents, table-of-contents navigation, zero embedding overhead.
          </div>
        </motion.div>
      </div>

      {/* Architecture diagram Section */}
      <motion.div
        variants={itemVariants}
        className="card p-6 sm:p-8 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md"
      >
        <h2 className="text-xl sm:text-2xl font-bold mb-6 flex items-center gap-2.5 text-white">
          <GitBranch className="w-5 h-5 text-indigo-400" />
          Deterministic Dual-Axis Decision Tree
        </h2>

        {/* High-contrast dark decision flow */}
        <div className="w-full bg-slate-950/80 rounded-2xl p-6 sm:p-8 border border-slate-800 flex flex-col items-center justify-center space-y-4">
          <div className="flex flex-col items-center w-full">
            {/* Input Query */}
            <div className="px-5 py-2.5 border border-slate-700 bg-slate-900 rounded-xl shadow-lg text-center">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block">Query Ingestion</span>
              <span className="font-semibold text-sm text-white">Incoming User Query (q)</span>
            </div>
            
            {/* Arrow */}
            <div className="h-6 w-0.5 bg-slate-700 relative">
              <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-slate-700" />
            </div>
            
            {/* Axis 1 Box */}
            <div className="px-5 py-3 border border-slate-800 bg-slate-900 rounded-xl shadow-md text-center max-w-sm">
              <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400 font-bold block mb-1">
                Axis 1: Retrieval Necessity
              </span>
              <span className="text-xs text-slate-300 block">
                Mean Token Surprisal <strong className="text-amber-300">S(q)</strong> against the Google Trillion-Word corpus.
              </span>
            </div>
            
            {/* Arrow */}
            <div className="h-6 w-0.5 bg-slate-700 relative">
              <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-slate-700" />
            </div>
            
            {/* Decision Gate 1 */}
            <div className="px-5 py-2 border border-dashed border-amber-500/50 bg-amber-500/10 rounded-xl text-center font-mono text-xs font-bold text-amber-300 shadow-sm">
              Is S(q) &lt; 11.5 bits &amp; SQT = False?
            </div>
            
            {/* Yes/No Split */}
            <div className="w-full max-w-xl flex justify-between relative mt-2 px-6 sm:px-10">
              {/* Horizontal line connector */}
              <div className="absolute top-0 left-[20%] right-[20%] h-0.5 bg-slate-700" />
              
              {/* Left Branch (YES) */}
              <div className="flex flex-col items-center w-1/2">
                <div className="h-6 w-0.5 bg-slate-700 relative">
                  <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-slate-700" />
                </div>
                <div className="font-mono text-[11px] text-amber-400 font-bold mb-1">YES</div>
                <div className="px-4 py-2.5 bg-amber-500/15 border border-amber-500/40 text-amber-300 rounded-xl text-center font-semibold text-xs shadow-md max-w-[170px]">
                  PARAMETRIC
                  <span className="block text-[10px] font-normal text-amber-200/80 font-mono mt-0.5">Answer from weights (No RAG)</span>
                </div>
              </div>
              
              {/* Right Branch (NO) */}
              <div className="flex flex-col items-center w-1/2">
                <div className="h-6 w-0.5 bg-slate-700 relative">
                  <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-slate-700" />
                </div>
                <div className="font-mono text-[11px] text-sky-400 font-bold mb-1">NO</div>
                
                {/* Axis 2 Box */}
                <div className="px-5 py-3 border border-slate-800 bg-slate-900 rounded-xl shadow-md text-center max-w-xs">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-sky-400 font-bold block mb-1">
                    Axis 2: Retrieval Mode
                  </span>
                  <span className="text-xs text-slate-300 block">
                    Entity Density <strong className="text-sky-300">D(q)</strong> + Syntactic Pattern <strong className="text-sky-300">SQT</strong>
                  </span>
                </div>
                
                {/* Arrow */}
                <div className="h-6 w-0.5 bg-slate-700 relative">
                  <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-slate-700" />
                </div>
                
                {/* Decision Gate 2 */}
                <div className="px-5 py-2 border border-dashed border-sky-500/50 bg-sky-500/10 rounded-xl text-center font-mono text-xs font-bold text-sky-300 shadow-sm">
                  D(q) &gt; 0.15 or SQT = True?
                </div>
                
                {/* YES/NO branch Axis 2 */}
                <div className="w-full flex justify-between relative mt-2 px-2 sm:px-4">
                  {/* Connector line */}
                  <div className="absolute top-0 left-[25%] right-[25%] h-0.5 bg-slate-700" />
                  
                  {/* Left (YES -> Vectorless) */}
                  <div className="flex flex-col items-center w-1/2">
                    <div className="h-6 w-0.5 bg-slate-700 relative">
                      <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-slate-700" />
                    </div>
                    <div className="font-mono text-[10px] text-emerald-400 font-bold mb-1">YES</div>
                    <div className="px-3 py-2 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-xl text-center font-semibold text-xs shadow-md max-w-[130px]">
                      VECTORLESS
                      <span className="block text-[9px] font-normal text-emerald-200/70 font-mono mt-0.5">Section Tree</span>
                    </div>
                  </div>
                  
                  {/* Right (NO -> Vector) */}
                  <div className="flex flex-col items-center w-1/2">
                    <div className="h-6 w-0.5 bg-slate-700 relative">
                      <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-slate-700" />
                    </div>
                    <div className="font-mono text-[10px] text-sky-400 font-bold mb-1">NO</div>
                    <div className="px-3 py-2 bg-sky-500/15 border border-sky-500/40 text-sky-300 rounded-xl text-center font-semibold text-xs shadow-md max-w-[130px]">
                      VECTOR
                      <span className="block text-[9px] font-normal text-sky-200/70 font-mono mt-0.5">Dense HNSW</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Arena Benchmarking Evaluation */}
            <div className="w-full flex justify-center relative mt-8">
              <div className="flex flex-col items-center">
                <div className="h-8 w-0.5 bg-slate-700 relative">
                  <div className="absolute bottom-0 -left-1 border-4 border-transparent border-t-slate-700" />
                </div>
                <div className="px-6 py-3.5 border border-indigo-500/40 bg-indigo-950/80 text-white rounded-xl shadow-xl text-center max-w-sm backdrop-blur-md">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-indigo-300 block mb-1">Benchmarking Arena</span>
                  <span className="text-xs font-semibold block text-indigo-100">Parallel Arena Execution &amp; Human Voting</span>
                  <span className="block text-[9px] text-indigo-300/80 mt-0.5 font-mono">Telemetry &amp; Win-Rate Logging</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* DDAR Mathematical Specification */}
      <motion.div
        variants={itemVariants}
        className="card p-6 sm:p-8 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md"
      >
        <h2 className="text-xl sm:text-2xl font-bold mb-3 flex items-center gap-2.5 text-white">
          <Zap className="w-5 h-5 text-indigo-400" />
          The Dual-Axis Routing Mechanism
        </h2>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          Rather than blindly sending every query through expensive embeddings and vector searches, DDAR evaluates two deterministic linguistic properties with zero neural model latency:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Axis 1 */}
          <div className="p-5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2">
            <span className="text-amber-400 font-mono text-base font-bold">01.</span>
            <h4 className="font-bold text-white text-sm">Axis 1 — Retrieval Necessity</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Computes mean token surprisal <strong className="text-amber-300">S(q)</strong> against the Norvig 1/3-million English word-frequency corpus (representing 1.02T tokens from the Google Trillion-Word corpus). If $S(q) &lt; \theta_1$ (11.5 bits) and no deictic/structural pattern is present ($\text{SQT} = \text{False}$), the query consists of common vocabulary and is answered directly from model parametric knowledge.
            </p>
          </div>
          {/* Axis 2 */}
          <div className="p-5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2">
            <span className="text-sky-400 font-mono text-base font-bold">02.</span>
            <h4 className="font-bold text-white text-sm">Axis 2 — Retrieval Mode</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Computes Named Entity Density <strong className="text-sky-300">D(q)</strong>: the fraction of query tokens that are proper nouns, numeric codes, or dates. It also tests a Syntactic Query Type flag <strong className="text-sky-300">SQT(q)</strong> detecting section headers, field lookups, and deictic document references. If $D(q) &gt; \theta_2$ (0.15) or SQT fires, queries route to Vectorless tree navigation.
            </p>
          </div>
          {/* Three routes */}
          <div className="p-5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2">
            <span className="text-emerald-400 font-mono text-base font-bold">03.</span>
            <h4 className="font-bold text-white text-sm">Three Empirical Paths</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every query cleanly partitions into:
              <span className="text-amber-400 font-semibold block mt-1">• Parametric: Answers directly from weights.</span>
              <span className="text-sky-400 font-semibold block">• Vector: Broad associative cosine search.</span>
              <span className="text-emerald-400 font-semibold block">• Vectorless: Structured tree traversal.</span>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Footer Info */}
      <motion.div variants={itemVariants} className="flex justify-center items-center gap-6 py-4 text-slate-500 text-xs sm:text-sm">
        <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-slate-400" /> MIT Licensed</span>
        <span>·</span>
        <span className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-slate-400" /> Empirical QA Arena</span>
      </motion.div>
    </motion.div>
  )
}
