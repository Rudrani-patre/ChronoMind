/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import Dashboard from './components/Dashboard';
import TaskDetails from './components/TaskDetails';
import TaskHistory from './components/TaskHistory';
import Profile from './components/Profile';
import { Task } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Brain, Hourglass, ShieldAlert, Award, User, LogOut, Menu, X, Loader 
} from 'lucide-react';

function NavigationShell() {
  const { profile, logOut } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logOut();
  };

  const selectTaskAndNavigate = (task: Task) => {
    setSelectedTask(task);
    setCurrentPage('task-details');
    setMobileSidebarOpen(false);
  };

  const handleSidebarNavigate = (page: string) => {
    setCurrentPage(page);
    setSelectedTask(null);
    setMobileSidebarOpen(false);
  };

  const renderActivePage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onSelectTask={selectTaskAndNavigate} onNavigate={setCurrentPage} />;
      case 'task-details':
        return selectedTask ? (
          <TaskDetails task={selectedTask} onBack={() => handleSidebarNavigate('dashboard')} />
        ) : (
          <Dashboard onSelectTask={selectTaskAndNavigate} onNavigate={setCurrentPage} />
        );
      case 'history':
        return <TaskHistory onSelectTask={selectTaskAndNavigate} />;
      case 'profile':
        return <Profile onLogout={() => {}} />;
      default:
        return <Dashboard onSelectTask={selectTaskAndNavigate} onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#050608] text-slate-100 flex relative">
      {/* Background radial effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-900/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[150px] pointer-events-none" />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-black/40 border-r border-white/10 px-5 py-8 relative z-25">
        <div className="space-y-8">
          {/* Logo Brand with Cyan Immersive container */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              <Brain className="w-4 h-4 text-black" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">ChronoMind</span>
          </div>

          {/* Nav List */}
          <nav className="space-y-2 font-mono text-xs">
            <p className="px-2.5 text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Intelligence Terminal</p>
            
            <button
              onClick={() => handleSidebarNavigate('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all cursor-pointer border ${
                currentPage === 'dashboard' || currentPage === 'task-details'
                  ? 'bg-white/5 border-white/10 text-cyan-400 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full transition-all shrink-0 ${
                currentPage === 'dashboard' || currentPage === 'task-details'
                  ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                  : 'bg-transparent'
              }`} />
              <Hourglass className="w-4 h-4 shrink-0" />
              <span>COMMAND CENTER</span>
            </button>

            <button
              onClick={() => handleSidebarNavigate('history')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all cursor-pointer border ${
                currentPage === 'history'
                  ? 'bg-white/5 border-white/10 text-cyan-400 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full transition-all shrink-0 ${
                currentPage === 'history'
                  ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                  : 'bg-transparent'
              }`} />
              <Award className="w-4 h-4 shrink-0" />
              <span>SURVIVAL ARCHIVE</span>
            </button>

            <button
              onClick={() => handleSidebarNavigate('profile')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all cursor-pointer border ${
                currentPage === 'profile'
                  ? 'bg-white/5 border-white/10 text-cyan-400 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full transition-all shrink-0 ${
                currentPage === 'profile'
                  ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                  : 'bg-transparent'
              }`} />
              <User className="w-4 h-4 shrink-0" />
              <span>OPERATOR PROFILE</span>
            </button>
          </nav>
        </div>

        {/* Footer info & log out with Cyan/Indigo gradient avatars */}
        <div className="space-y-4">
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 border border-white/20 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="truncate">
              <p className="text-sm font-medium text-slate-100 truncate">{profile?.name || 'Operator'}</p>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest truncate">{profile?.tier || 'Verified Operator'}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-3 bg-transparent hover:bg-white/5 text-xs font-mono text-slate-400 hover:text-rose-400 rounded-xl transition-all flex items-center gap-2.5 justify-center cursor-pointer border border-transparent"
          >
            <LogOut className="w-4 h-4" />
            SHUTDOWN SESSION
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-black/80 backdrop-blur border-b border-white/10 flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-cyan-500 rounded flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.5)]">
            <Brain className="w-3.5 h-3.5 text-black" />
          </div>
          <span className="font-display font-bold text-base text-white">ChronoMind</span>
        </div>
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="p-1.5 bg-white/5 border border-white/10 rounded-lg text-slate-300"
        >
          {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Sidebar overlay Drawer */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed inset-y-0 left-0 w-64 bg-black border-r border-white/10 p-5 flex flex-col justify-between z-30"
          >
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                    <Brain className="w-4 h-4 text-black" />
                  </div>
                  <span className="font-display font-bold text-base text-white">ChronoMind</span>
                </div>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Nav Menu */}
              <nav className="space-y-2 font-mono text-xs">
                <button
                  onClick={() => handleSidebarNavigate('dashboard')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                    currentPage === 'dashboard' || currentPage === 'task-details'
                      ? 'bg-white/5 border-white/10 text-cyan-400'
                      : 'text-slate-400 hover:bg-white/5 border-transparent'
                  }`}
                >
                  <Hourglass className="w-4 h-4" />
                  DASHBOARD
                </button>

                <button
                  onClick={() => handleSidebarNavigate('history')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                    currentPage === 'history'
                      ? 'bg-white/5 border-white/10 text-cyan-400'
                      : 'text-slate-400 hover:bg-white/5 border-transparent'
                  }`}
                >
                  <Award className="w-4 h-4" />
                  SURVIVAL ARCHIVE
                </button>

                <button
                  onClick={() => handleSidebarNavigate('profile')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                    currentPage === 'profile'
                      ? 'bg-white/5 border-white/10 text-cyan-400'
                      : 'text-slate-400 hover:bg-white/5 border-transparent'
                  }`}
                >
                  <User className="w-4 h-4" />
                  OPERATOR PROFILE
                </button>
              </nav>
            </div>

            <div className="space-y-4">
              <button
                onClick={handleLogout}
                className="w-full py-2 bg-white/5 hover:bg-rose-500/10 text-xs font-mono text-rose-400 hover:text-rose-300 rounded-xl transition-all flex items-center gap-2 justify-center border border-white/10"
              >
                <LogOut className="w-4 h-4" />
                LOGOUT SESSION
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Pane with ambient glow background from design */}
      <main className="flex-1 w-full px-6 md:px-10 py-6 md:py-8 mt-16 md:mt-0 relative overflow-y-auto z-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/10 via-transparent to-transparent">
        {renderActivePage()}
      </main>
    </div>
  );
}

function MainApp() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('landing');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050608] flex flex-col items-center justify-center text-center">
        <Loader className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-mono tracking-wider">CHRONOMIND ENGINES CALIBRATING...</p>
      </div>
    );
  }

  // If user is authenticated, route them to the central console navigation shell
  if (user) {
    return <NavigationShell />;
  }

  // Otherwise, allow landing, login, and signup routing
  return (
    <div className="min-h-screen bg-[#050608] text-slate-100 relative">
      <AnimatePresence mode="wait">
        {currentPage === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <LandingPage 
              onNavigate={setCurrentPage} 
              onEnterSystem={() => setCurrentPage('login')} 
            />
          </motion.div>
        )}

        {currentPage === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <LoginPage 
              onNavigate={setCurrentPage} 
              onLoginSuccess={() => setCurrentPage('dashboard')} 
            />
          </motion.div>
        )}

        {currentPage === 'signup' && (
          <motion.div
            key="signup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <SignupPage 
              onNavigate={setCurrentPage} 
              onSignupSuccess={() => setCurrentPage('dashboard')} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
