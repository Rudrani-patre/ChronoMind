/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { Brain, ShieldAlert, Zap, Hourglass, ArrowRight, CheckCircle2, Flame, CalendarRange } from 'lucide-react';

interface LandingPageProps {
  onNavigate: (page: string) => void;
  onEnterSystem: () => void;
}

export default function LandingPage({ onNavigate, onEnterSystem }: LandingPageProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between overflow-hidden">
      {/* Absolute ambient grid/circle backgrounds */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.08),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(244,63,94,0.06),transparent_50%)] pointer-events-none" />
      
      {/* Top Header Navigation */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <Brain className="w-6 h-6 text-cyan-400" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white">ChronoMind</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('login')}
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Sign In
          </button>
          <button 
            onClick={() => onNavigate('signup')}
            className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-full text-xs font-mono font-bold transition-all shadow-[0_4px_15px_rgba(6,182,212,0.35)] cursor-pointer"
          >
            Access Console
          </button>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10 w-full max-w-4xl mx-auto text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center"
        >
          <motion.div 
            variants={itemVariants} 
            className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full text-xs font-mono mb-6 uppercase tracking-wider"
          >
            <Flame className="w-3.5 h-3.5 animate-pulse" />
            <span>AI DEADLINE SURVIVAL SYSTEM</span>
          </motion.div>

          <motion.h1 
            variants={itemVariants}
            className="font-display text-4xl sm:text-6xl font-bold text-white tracking-tight leading-tight max-w-3xl"
          >
            Survive Your Deadlines with <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-orange-400 bg-clip-text text-transparent">Execution Intelligence</span>
          </motion.h1>

          <motion.p 
            variants={itemVariants}
            className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl font-light leading-relaxed"
          >
            Do not just track deadlines—survive them. ChronoMind plans, predicts failures, adapts dynamically to your pace, and triggers a hard-triage <strong>Rescue Mode</strong> when you fall behind.
          </motion.p>

          <motion.div variants={itemVariants} className="mt-10 flex flex-col sm:flex-row gap-4">
            <button 
              onClick={onEnterSystem}
              className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs rounded-full transition-all shadow-[0_4px_20px_rgba(6,182,212,0.4)] inline-flex items-center justify-center gap-2 cursor-pointer group uppercase tracking-wider"
            >
              Initialize ChronoMind
              <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => {
                const bento = document.getElementById('features-bento');
                bento?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-8 py-4 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-full font-mono font-bold text-xs transition-all uppercase tracking-wider cursor-pointer"
            >
              System Overview
            </button>
          </motion.div>
        </motion.div>

        {/* Bento Grid section anchor */}
        <section id="features-bento" className="w-full mt-32 text-left">
          <div className="mb-12 text-center border-b border-white/5 pb-8">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">Advanced Tactical Protocol</h2>
            <p className="text-slate-400 text-sm mt-2 font-light">Engineered modules specifically designed to prevent deadline-miss disaster</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Box 1: Smart Planner */}
            <div className="glass-panel p-8 rounded-3xl flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center border border-cyan-500/20 mb-6 shadow-[0_0_12px_rgba(6,182,212,0.1)]">
                  <Brain className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="font-display font-semibold text-lg text-white tracking-tight">Smart AI Planner</h3>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed font-light">
                  Enter your task and absolute deadline. The system decomposes it into a realistic subtask roadmap, assessing priority levels, sequence rules, and estimated durations.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-mono text-cyan-400 uppercase tracking-widest">
                <CheckCircle2 className="w-3.5 h-3.5" /> DECOMPOSITION CORE ONLINE
              </div>
            </div>

            {/* Box 2: Adaptive Scheduling */}
            <div className="glass-panel p-8 rounded-3xl flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 mb-6">
                  <Hourglass className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="font-display font-semibold text-lg text-white tracking-tight">Adaptive Live Rescheduling</h3>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed font-light">
                  Log completed milestones. The scheduling engine dynamically calculates remaining minutes, and redistributes upcoming urgency weights to keep you on schedule.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-mono text-indigo-400 uppercase tracking-widest">
                <CheckCircle2 className="w-3.5 h-3.5" /> RE-CALCULATION LOOPS ACTIVE
              </div>
            </div>

            {/* Box 3: Google Calendar Integration */}
            <div className="glass-panel p-8 rounded-3xl flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center border border-green-500/20 mb-6">
                  <CalendarRange className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="font-display font-semibold text-lg text-white tracking-tight">Google Calendar Sync</h3>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed font-light">
                  Directly connect your Google Calendar accounts. The system retrieves busy slots, allocates smart conflict-free times, and synchronizes milestones directly.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-mono text-green-400 uppercase tracking-widest">
                <CheckCircle2 className="w-3.5 h-3.5" /> CALENDAR INTEGRATION ACTIVE
              </div>
            </div>

            {/* Box 4: Deadline Rescue Mode */}
            <div className="glass-panel p-8 rounded-3xl flex flex-col justify-between border-orange-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 blur-[30px] rounded-full"></div>
              <div className="relative">
                <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20 mb-6">
                  <ShieldAlert className="w-6 h-6 text-orange-400" />
                </div>
                <h3 className="font-display font-semibold text-lg text-white tracking-tight">Deadline Rescue Mode</h3>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed font-light">
                  When progress stalls and time shrinks, trigger Survival Mode. Instantly compress task durations, drop low-priority fluff, and generate a razor-sharp critical path.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-mono text-orange-400 uppercase tracking-widest">
                <Zap className="w-3.5 h-3.5 text-orange-400 animate-bounce" /> EMERGENCY OVERRIDE READY
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 bg-black/40 py-6 relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center gap-1">
            <span>© 2026 ChronoMind Systems. Hackathon Edition.</span>
          </div>
          <div className="flex gap-4 font-mono">
            <span className="text-cyan-400">Survival Engine v1.0.4</span>
            <span>·</span>
            <span>Zero-Trust Persistence Verified</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
