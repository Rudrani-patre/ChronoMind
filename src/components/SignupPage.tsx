/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Brain, Lock, Mail, User, AlertCircle, ArrowRight, Loader } from 'lucide-react';

interface SignupPageProps {
  onNavigate: (page: string) => void;
  onSignupSuccess: () => void;
}

export default function SignupPage({ onNavigate, onSignupSuccess }: SignupPageProps) {
  const { signUp, signInWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all requested fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await signUp(email, name, password);
      onSignupSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already in use by another terminal.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/weak-password') {
        setError('The password is too weak. Must be at least 6 characters.');
      } else {
        setError(err.message || 'An error occurred during profile registration.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onSignupSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to register via Google.');
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
          <h2 className="font-display text-2xl font-bold text-white tracking-tight">Create Console Account</h2>
          <p className="text-slate-500 text-[10px] font-mono mt-1.5 uppercase tracking-widest">INITIALIZE SURVIVAL CREDENTIALS</p>
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
              <label className="block text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  disabled={loading}
                />
              </div>
            </div>

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
              <p className="text-[10px] text-slate-500 mt-2 font-mono">Minimum 6 characters required</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs rounded-full transition-all shadow-[0_4px_15px_rgba(6,182,212,0.3)] inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 uppercase tracking-widest"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin text-black" />
                  CREATING PROFILE...
                </>
              ) : (
                <>
                  INITIALIZE ACCOUNT
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
              onClick={handleGoogleSignup}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-white/5 hover:bg-white/10 text-slate-200 font-mono font-bold text-xs rounded-full transition-all border border-white/10 inline-flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 uppercase tracking-wider"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              INITIALIZE WITH GOOGLE
            </button>
          </form>
        </div>

        {/* Redirection link */}
        <p className="text-center text-xs text-slate-500 mt-6">
          Already registered?{' '}
          <button
            onClick={() => onNavigate('login')}
            className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors cursor-pointer"
          >
            Access existing console
          </button>
        </p>
      </div>
    </div>
  );
}
