/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Brain, Lock, Mail, AlertCircle, ArrowRight, Loader, ExternalLink, ShieldAlert, Check } from 'lucide-react';

interface LoginPageProps {
  onNavigate: (page: string) => void;
  onLoginSuccess: () => void;
}

export default function LoginPage({ onNavigate, onLoginSuccess }: LoginPageProps) {
  const { logIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAuthInstructions, setShowAuthInstructions] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all credentials.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await logIn(email, password);
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password combination.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message || 'An error occurred during authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onLoginSuccess();
    } catch (err: any) {
      console.error("Google Login error:", err);
      if (err.code === 'auth/operation-not-allowed' || (err.message && err.message.includes('operation-not-allowed'))) {
        setShowAuthInstructions(true);
      } else {
        setError(err.message || 'Failed to authenticate via Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Absolute ambient grid/circle backgrounds */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(6,182,212,0.07),transparent_50%)] pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)] mb-4 cursor-pointer" onClick={() => onNavigate('landing')}>
            <Brain className="w-8 h-8 text-cyan-400" />
          </div>
          <h2 className="font-display text-2xl font-bold text-white tracking-tight">ChronoMind Console</h2>
          <p className="text-slate-500 text-[10px] font-mono mt-1.5 uppercase tracking-widest">SECURE PORTAL ACCESS</p>
        </div>

        {/* Card */}
        <div className="glass-panel p-8 rounded-3xl border-white/10 relative">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5 text-xs text-rose-400 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-widest mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs rounded-full transition-all shadow-[0_4px_15px_rgba(6,182,212,0.3)] inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 uppercase tracking-widest"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin text-black" />
                  AUTHENTICATING...
                </>
              ) : (
                <>
                  AUTHENTICATE CONSOLE
                  <ArrowRight className="w-4 h-4 text-black" />
                </>
              )}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink mx-4 text-[9px] font-mono text-slate-500 uppercase tracking-widest">OR</span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-white/5 hover:bg-white/10 text-slate-200 font-mono font-bold text-xs rounded-full transition-all border border-white/10 inline-flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 uppercase tracking-wider"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              AUTHENTICATE WITH GOOGLE
            </button>
          </form>
        </div>

        {/* Redirection link */}
        <p className="text-center text-xs text-slate-500 mt-6">
          Need access credentials?{' '}
          <button
            onClick={() => onNavigate('signup')}
            className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors cursor-pointer"
          >
            Create account
          </button>
        </p>
      </div>

      {/* ⚙️ Google Authentication Configuration Guide */}
      {showAuthInstructions && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0a0c10] border border-cyan-500/30 rounded-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.15)] text-left">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-cyan-500"></div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">Firebase Configuration Required</p>
                <h3 className="font-display font-bold text-lg text-white">Google Auth Provider Disabled</h3>
              </div>
            </div>

            <div className="p-4 bg-rose-500/5 border border-rose-500/15 rounded-xl space-y-2">
              <p className="text-xs text-rose-300 leading-relaxed font-light">
                Your Firebase project has thrown an <strong className="font-mono text-rose-400">auth/operation-not-allowed</strong> response. This indicates that Google Sign-In is not currently enabled under Authentication in your Firebase Console.
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">How to Resolve This:</p>
              
              <ul className="space-y-3.5 text-xs text-slate-300">
                <li className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-[10px] font-mono text-cyan-400 shrink-0 mt-0.5">1</div>
                  <span className="leading-relaxed">
                    Open your <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline inline-flex items-center gap-1">Firebase Console <ExternalLink className="w-3.5 h-3.5 inline" /></a> and select this project.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-[10px] font-mono text-cyan-400 shrink-0 mt-0.5">2</div>
                  <span className="leading-relaxed">
                    Go to <strong>Build &gt; Authentication &gt; Sign-in method</strong>. Click <strong>Add new provider</strong>, select <strong>Google</strong>, enable the toggle, and click <strong>Save</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-[10px] font-mono text-cyan-400 shrink-0 mt-0.5">3</div>
                  <span className="leading-relaxed">
                    Under the <strong>Settings</strong> tab in Authentication, verify that your active domain <code className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded font-mono text-cyan-400 text-[11px]">{window.location.hostname}</code> is added to the <strong>Authorized Domains</strong> list.
                  </span>
                </li>
              </ul>
            </div>

            <div className="pt-2 border-t border-white/5 space-y-3">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <strong>💡 Quick Tip:</strong> You can sign up or log in using the <strong>Email &amp; Password</strong> form right now, and activate <strong>Demo Calendar Mode</strong> to preview the entire scheduling suite immediately!
              </p>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAuthInstructions(false)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-mono font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                >
                  Close Guide
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
