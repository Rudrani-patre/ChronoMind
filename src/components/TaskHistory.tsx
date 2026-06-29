/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Task } from '../types';
import { Trophy, Calendar, CheckCircle2, Award, Clock, ArrowUpRight, Loader, Brain } from 'lucide-react';

interface TaskHistoryProps {
  onSelectTask: (task: Task) => void;
}

export default function TaskHistory({ onSelectTask }: TaskHistoryProps) {
  const { user } = useAuth();
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const tasksRef = collection(db, 'tasks');
    const q = query(
      tasksRef, 
      where('userId', '==', user.uid), 
      where('progressPercentage', '==', 100)
    );

    setLoading(true);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Task[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Task);
      });
      // Sort by completion / update time descending
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setCompletedTasks(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header (Immersive UI style header) */}
      <header className="border-b border-white/5 pb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Time Survival Archive</h2>
        <p className="text-sm text-slate-400 mt-1">
          Review all completed deadline tracks where you successfully survived chronological constraints.
        </p>
      </header>

      {loading ? (
        <div className="glass-panel p-12 flex flex-col items-center justify-center text-center">
          <Loader className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-slate-400 text-sm mt-3 font-mono">Syncing archives...</p>
        </div>
      ) : completedTasks.length === 0 ? (
        <div className="glass-panel p-12 text-center border-dashed max-w-xl mx-auto mt-12">
          <div className="w-12 h-12 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center mx-auto mb-4">
            <Award className="w-6 h-6 text-cyan-400" />
          </div>
          <p className="text-slate-300 font-medium">No completed survivals yet.</p>
          <p className="text-slate-500 text-xs mt-1.5 leading-relaxed max-w-sm mx-auto">
            Successfully survive an active deadline by ticking off all AI-decomposed subtasks in your Command Center, and your triumph will be recorded here forever.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4 px-1">
            SURVIVED CAMPAIGNS ({completedTasks.length})
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {completedTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="glass-panel glass-panel-hover p-6 rounded-3xl cursor-pointer flex flex-col justify-between h-52 relative overflow-hidden group border border-green-500/10 transition-all hover:border-green-500/30"
              >
                {/* Visual badge top right */}
                <div className="absolute top-5 right-5 text-green-400 bg-green-500/10 p-2 rounded-lg border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.15)]">
                  <CheckCircle2 className="w-4 h-4" />
                </div>

                <div className="space-y-3">
                  <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded text-[9px] font-mono uppercase tracking-widest">
                    SURVIVED
                  </span>
                  <h3 className="font-display font-semibold text-base text-white group-hover:text-green-400 transition-colors line-clamp-2 pr-8 leading-snug">
                    {task.task}
                  </h3>
                </div>

                <div className="border-t border-white/5 pt-4 mt-4 flex items-center justify-between text-xs text-slate-500 font-mono">
                  <div className="space-y-1">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Saved: {new Date(task.updatedAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Steps: {task.totalSubtasks} items
                    </span>
                  </div>
                  <button className="p-2 bg-white/5 border border-white/10 rounded-full group-hover:bg-green-500 group-hover:border-green-400 group-hover:text-black transition-all text-slate-400">
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
