/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { LogOut, User, Mail, Calendar, ShieldCheck, Flame, Hourglass, CheckCircle, Loader } from 'lucide-react';

interface ProfileProps {
  onLogout: () => void;
}

export default function Profile({ onLogout }: ProfileProps) {
  const { profile, logOut } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    active: 0,
    rescueModeCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const fetchStats = async () => {
      setLoading(true);
      const q = query(collection(db, 'tasks'), where('userId', '==', profile.uid));
      try {
        const snapshot = await getDocs(q);
        let total = 0;
        let completed = 0;
        let active = 0;
        let rescueModeCount = 0;

        snapshot.forEach((doc) => {
          total++;
          const data = doc.data();
          if (data.progressPercentage === 100) {
            completed++;
          } else {
            active++;
          }
          if (data.scheduleStatus === 'rescue') {
            rescueModeCount++;
          }
        });

        setStats({ total, completed, active, rescueModeCount });
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [profile]);

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to shut down this terminal session?')) {
      await logOut();
      onLogout();
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-8 pb-12 max-w-4xl">
      {/* Page Header (Immersive UI style header) */}
      <header className="border-b border-white/5 pb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">System Operator Profile</h2>
        <p className="text-sm text-slate-400 mt-1">
          Manage your operator credentials and review total timeline achievements.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Card: Basic info */}
        <div className="md:col-span-5 space-y-6">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 shadow-[0_1px_10px_rgba(6,182,212,0.4)]" />
            
            <div className="w-16 h-16 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-full border border-white/20 flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-white" />
            </div>

            <h2 className="font-display font-bold text-lg text-white">{profile.name}</h2>
            <p className="text-[10px] font-mono text-cyan-400 mt-1 uppercase tracking-widest">Operator Verified</p>

            <div className="border-t border-white/5 mt-6 pt-6 text-left space-y-4 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="truncate">{profile.email}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Joined: {new Date(profile.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2.5 text-cyan-400">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Zero-Trust Database Linked</span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full mt-8 py-2.5 px-4 bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 text-xs font-mono border border-white/10 hover:border-rose-500/30 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              TERMINATE TERMINAL SESSION
            </button>
          </div>
        </div>

        {/* Right Card: Statistics */}
        <div className="md:col-span-7">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6 h-full flex flex-col justify-between">
            <div>
              <h3 className="font-display font-semibold text-lg text-white mb-6">System Analytics</h3>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <Loader className="w-6 h-6 text-cyan-400 animate-spin" />
                  <p className="text-slate-500 text-xs mt-2 font-mono uppercase tracking-widest">Calculating metrics...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {/* Metric 1 */}
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20 shadow-[0_0_8px_rgba(6,182,212,0.15)]">
                      <Hourglass className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Tracked</p>
                      <h4 className="text-lg font-bold text-white mt-0.5">{stats.total}</h4>
                    </div>
                  </div>

                  {/* Metric 2 */}
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Survived</p>
                      <h4 className="text-lg font-bold text-white mt-0.5">{stats.completed}</h4>
                    </div>
                  </div>

                  {/* Metric 3 */}
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                      <Flame className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">In Flight</p>
                      <h4 className="text-lg font-bold text-white mt-0.5">{stats.active}</h4>
                    </div>
                  </div>

                  {/* Metric 4 */}
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                      <ShieldCheck className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Rescue Mode</p>
                      <h4 className="text-lg font-bold text-white mt-0.5">{stats.rescueModeCount}</h4>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-xs text-slate-400 leading-relaxed font-light mt-6">
              <strong className="text-cyan-400">Terminal Status Note:</strong> ChronoMind relies on client-side state combined with deep server proxy layers. No personal keys or secrets are exposed, maintaining zero-trust client integrity.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
