/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Task, Subtask, Goal, HabitLog } from '../types';
import ChronoVoice from './ChronoVoice';
import { 
  Brain, Hourglass, ShieldAlert, Sparkles, Plus, Calendar, AlertCircle, 
  Trash2, ArrowUpRight, Flame, CheckCircle, Activity, Loader, Edit3,
  Trophy, Target, CheckSquare, Square, TrendingUp, User
} from 'lucide-react';

interface DashboardProps {
  onSelectTask: (task: Task) => void;
  onNavigate: (page: string) => void;
}

export default function Dashboard({ onSelectTask, onNavigate }: DashboardProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // New task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [manualTotalSubtasks, setManualTotalSubtasks] = useState('');
  const [manualCompletedSubtasks, setManualCompletedSubtasks] = useState('');
  const [generating, setGenerating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Impossible task actions state
  const [reschedulingTaskId, setReschedulingTaskId] = useState<string | null>(null);
  const [newDeadline, setNewDeadline] = useState<string>('');
  const [editingTaskTitleId, setEditingTaskTitleId] = useState<string | null>(null);
  const [tempTaskTitle, setTempTaskTitle] = useState<string>('');
  const [performingActionId, setPerformingActionId] = useState<string | null>(null);

  // Upgraded Goals & Habits States
  const [activeTab, setActiveTab] = useState<'terminal' | 'goals'>('terminal');
  const [cognitiveSubTab, setCognitiveSubTab] = useState<'future_self' | 'triage' | 'habits'>('future_self');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalType, setNewGoalType] = useState<'long-term' | 'weekly' | 'daily'>('daily');

  // Streak & User Profile stats
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [consistencyScore, setConsistencyScore] = useState(75);

  // Master habits list
  const [habits, setHabits] = useState<{ id: string; name: string; completed: boolean; logId?: string }[]>([
    { id: 'h1', name: 'Sleep Schedule Sync', completed: false },
    { id: 'h2', name: 'Continuous Focus Block', completed: false },
    { id: 'h3', name: 'Tactical Mindfulness Break', completed: false },
    { id: 'h4', name: 'Aerobic Recharge', completed: false },
    { id: 'h5', name: 'Deep Work Session', completed: false },
  ]);

  // Load user's tasks from Firestore in real-time
  useEffect(() => {
    if (!user) return;

    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef, where('userId', '==', user.uid));

    setLoadingTasks(true);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksList: Task[] = [];
      snapshot.forEach((doc) => {
        tasksList.push({ id: doc.id, ...doc.data() } as Task);
      });
      // Sort tasks by updated/created date descending
      tasksList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTasks(tasksList);
      setLoadingTasks(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
      setLoadingTasks(false);
    });

    return unsubscribe;
  }, [user]);

  // Load User Profile stats, Goals, and Habit Logs in real-time
  useEffect(() => {
    if (!user) return;

    // 1. User Profile Listener
    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStreak(data.streak || 0);
        setLongestStreak(data.longestStreak || 0);
        setConsistencyScore(data.consistencyScore || 75);
      }
    });

    // 2. Goals Listener
    const goalsRef = collection(db, 'goals');
    const goalsQuery = query(goalsRef, where('userId', '==', user.uid));
    setLoadingGoals(true);
    const unsubGoals = onSnapshot(goalsQuery, (snapshot) => {
      const goalsList: Goal[] = [];
      snapshot.forEach((docSnap) => {
        goalsList.push({ id: docSnap.id, ...docSnap.data() } as Goal);
      });
      // Sort goals by date
      goalsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setGoals(goalsList);
      setLoadingGoals(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'goals');
      setLoadingGoals(false);
    });

    // 3. Habit Logs Listener for Today
    const todayStr = new Date().toISOString().split('T')[0];
    const habitLogsRef = collection(db, 'habit_logs');
    const habitLogsQuery = query(
      habitLogsRef, 
      where('userId', '==', user.uid),
      where('date', '==', todayStr)
    );

    const unsubHabits = onSnapshot(habitLogsQuery, (snapshot) => {
      const logsMap: { [habitName: string]: string } = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        logsMap[data.habitName] = docSnap.id;
      });

      setHabits(prev => prev.map(h => ({
        ...h,
        completed: !!logsMap[h.name],
        logId: logsMap[h.name] || undefined
      })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'habit_logs');
    });

    return () => {
      unsubUser();
      unsubGoals();
      unsubHabits();
    };
  }, [user]);

  // Goals & Habits Handlers
  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newGoalTitle.trim()) return;

    try {
      const goalsRef = collection(db, 'goals');
      await addDoc(goalsRef, {
        userId: user.uid,
        title: newGoalTitle.trim(),
        type: newGoalType,
        targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 week default
        completed: false,
        createdAt: new Date().toISOString(),
      });
      setNewGoalTitle('');
    } catch (err) {
      console.error("Failed to add goal:", err);
    }
  };

  const handleToggleGoal = async (goalId: string, currentCompleted: boolean) => {
    if (!user) return;
    try {
      const goalRef = doc(db, 'goals', goalId);
      await updateDoc(goalRef, {
        completed: !currentCompleted
      });

      // Update User Streak upon completion if not already updated today
      if (!currentCompleted) {
        await handleTriggerStreakIncrement();
      }
    } catch (err) {
      console.error("Failed to toggle goal:", err);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!user) return;
    try {
      const goalRef = doc(db, 'goals', goalId);
      await deleteDoc(goalRef);
    } catch (err) {
      console.error("Failed to delete goal:", err);
    }
  };

  const handleToggleHabit = async (habitName: string, currentCompleted: boolean, logId?: string) => {
    if (!user) return;
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      if (currentCompleted && logId) {
        const logRef = doc(db, 'habit_logs', logId);
        await deleteDoc(logRef);
      } else {
        const habitLogsRef = collection(db, 'habit_logs');
        await addDoc(habitLogsRef, {
          userId: user.uid,
          habitName,
          date: todayStr,
          completed: true,
          timestamp: new Date().toISOString()
        });

        // Trigger streak increment
        await handleTriggerStreakIncrement();
      }
    } catch (err) {
      console.error("Failed to toggle habit:", err);
    }
  };

  const handleTriggerStreakIncrement = async () => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const newStreak = streak + 1;
    const newLongest = Math.max(longestStreak, newStreak);

    // Calculate dynamic consistency score
    const totalItems = goals.length + habits.length;
    const completedItems = goals.filter(g => g.completed).length + habits.filter(h => h.completed).length + 1;
    const score = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 75;

    try {
      await updateDoc(userRef, {
        streak: newStreak,
        longestStreak: newLongest,
        consistencyScore: score
      });
    } catch (err) {
      console.error("Failed to update user profile streak:", err);
    }
  };

  // Create task and decompose via Gemini
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !deadline) {
      setFormError('Please enter a task description and specific deadline.');
      return;
    }

    // Verify deadline is in the future
    const deadlineDate = new Date(deadline);
    if (deadlineDate.getTime() <= Date.now()) {
      setFormError('Deadline must be a future date and time.');
      return;
    }

    setFormError(null);
    setGenerating(true);

    try {
      // Call Gemini API to decompose task
      const response = await fetch('/api/planning/decompose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: taskTitle,
          deadline: deadline,
        }),
      });

      if (!response.ok) {
        throw new Error('AI Decomposition Service failed.');
      }

      const planData = await response.json();

      let finalSubtasks = planData.subtasks || [];
      let totalCount = finalSubtasks.length;
      let completedCount = 0;

      const manualTotal = parseInt(manualTotalSubtasks);
      if (!isNaN(manualTotal) && manualTotal > 0) {
        const manualCompleted = Math.min(manualTotal, Math.max(0, parseInt(manualCompletedSubtasks) || 0));
        const customSubtasks: Subtask[] = [];
        for (let i = 0; i < manualTotal; i++) {
          // If we have AI subtasks available, use their names and priorities as templates
          const aiSub = planData.subtasks && planData.subtasks[i];
          customSubtasks.push({
            id: `subtask_manual_${Date.now()}_${i}`,
            title: aiSub ? aiSub.title : `Milestone Task ${i + 1}`,
            priority: aiSub ? aiSub.priority : ('medium' as const),
            estimatedMinutes: aiSub ? aiSub.estimatedMinutes : 30,
            completed: i < manualCompleted,
            order: i + 1,
          });
        }
        finalSubtasks = customSubtasks;
        totalCount = manualTotal;
        completedCount = manualCompleted;
      }

      // Formulate Task object for Firestore
      const newTaskData = {
        userId: user!.uid,
        task: planData.task || taskTitle,
        deadline: new Date(deadline).toISOString(),
        subtasks: finalSubtasks,
        generatedPlan: planData.roadmap || 'No roadmap generated.',
        totalSubtasks: totalCount,
        completedSubtasks: completedCount,
        progressPercentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 1000) / 10 : 0,
        scheduleStatus: planData.isImpossible ? 'normal' as const : 'normal' as const,
        futurePrediction: planData.initialPrediction || 'Prediction pending simulation.',
        isImpossible: planData.isImpossible || false,
        impossibleReason: planData.impossibleReason || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'pending' as const,
      };

      // Save to Firestore
      const path = 'tasks';
      try {
        await addDoc(collection(db, 'tasks'), newTaskData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }

      // Reset Form
      setTaskTitle('');
      setDeadline('');
      setManualTotalSubtasks('');
      setManualCompletedSubtasks('');
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to decompose task. Ensure your API connection is online.');
    } finally {
      setGenerating(false);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to abort this deadline track?')) return;

    const path = `tasks/${taskId}`;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Reschedule task's deadline inline
  const handleSaveRescheduledDeadline = async (taskId: string) => {
    if (!newDeadline) return;
    setPerformingActionId(taskId);
    try {
      const taskRef = doc(db, 'tasks', taskId);
      const targetTask = tasks.find(t => t.id === taskId);
      if (!targetTask) return;

      // Re-evaluate feasibility
      const totalMinutesNeeded = targetTask.subtasks.reduce((sum, s) => sum + (s.estimatedMinutes || 30), 0);
      const newTimeAvailableMs = new Date(newDeadline).getTime() - Date.now();
      const newMinutesAvailable = newTimeAvailableMs / (1000 * 60);
      const stillImpossible = totalMinutesNeeded > newMinutesAvailable;

      await updateDoc(taskRef, {
        deadline: new Date(newDeadline).toISOString(),
        isImpossible: stillImpossible,
        impossibleReason: stillImpossible ? targetTask.impossibleReason : '',
        updatedAt: new Date().toISOString(),
      });
      setReschedulingTaskId(null);
    } catch (err) {
      console.error("Reschedule failed:", err);
    } finally {
      setPerformingActionId(null);
    }
  };

  // Reduce task scope (keep high priority/essential, compress subtask times)
  const handleReduceScope = async (task: Task) => {
    setPerformingActionId(task.id);
    try {
      const sortedSubtasks = [...task.subtasks];
      const reducedSubtasks = sortedSubtasks
        .filter(s => s.priority === 'high' || s.order <= 3)
        .map((s, idx) => ({
          ...s,
          estimatedMinutes: Math.max(15, Math.round((s.estimatedMinutes || 30) * 0.6)), // Compress by 40%
          order: idx + 1
        }));

      const totalMinutesNeeded = reducedSubtasks.reduce((sum, s) => sum + (s.estimatedMinutes || 30), 0);
      const timeAvailableMs = new Date(task.deadline).getTime() - Date.now();
      const minutesAvailable = timeAvailableMs / (1000 * 60);
      const stillImpossible = totalMinutesNeeded > minutesAvailable;

      const totalCount = reducedSubtasks.length;
      const completedCount = reducedSubtasks.filter(s => s.completed).length;

      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, {
        subtasks: reducedSubtasks,
        totalSubtasks: totalCount,
        completedSubtasks: completedCount,
        progressPercentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 1000) / 10 : 0,
        isImpossible: stillImpossible,
        impossibleReason: stillImpossible ? "Even with a compressed scope, the current deadline is still too tight." : "",
        updatedAt: new Date().toISOString(),
      });
      alert('Scope successfully reduced. Subtasks compressed to high-priority critical path.');
    } catch (err) {
      console.error("Scope reduction failed:", err);
    } finally {
      setPerformingActionId(null);
    }
  };

  // Activate Rescue Mode directly from the Dashboard card
  const handleActivateRescueFromDashboard = async (task: Task) => {
    setPerformingActionId(task.id);
    try {
      const response = await fetch('/api/planning/rescue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: task.task,
          deadline: task.deadline,
          subtasks: task.subtasks,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        const updatedData = {
          subtasks: data.essentialSubtasks,
          totalSubtasks: data.essentialSubtasks.length,
          completedSubtasks: 0,
          progressPercentage: 0,
          scheduleStatus: 'rescue' as const,
          status: 'rescued' as const,
          generatedPlan: `### 🚨 EMERGENCY SURVIVAL ROADMAP\n\n${data.compressedPlan}`,
          rescuePlan: data.compressedPlan,
          isImpossible: false,
          impossibleReason: '',
          updatedAt: new Date().toISOString(),
        };

        const taskRef = doc(db, 'tasks', task.id);
        await updateDoc(taskRef, updatedData);
        alert('Rescue Mode activated! The plan has been compressed to essential high-priority steps to fit your deadline.');
      } else {
        alert('Decomposition service failed to generate emergency rescue roadmap.');
      }
    } catch (err) {
      console.error("Rescue failed:", err);
    } finally {
      setPerformingActionId(null);
    }
  };

  // Edit task title inline
  const handleSaveEditedTitle = async (taskId: string) => {
    if (!tempTaskTitle.trim()) return;
    setPerformingActionId(taskId);
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        task: tempTaskTitle,
        updatedAt: new Date().toISOString(),
      });
      setEditingTaskTitleId(null);
    } catch (err) {
      console.error("Title update failed:", err);
    } finally {
      setPerformingActionId(null);
    }
  };

  // Calculations for dashboard counters
  const incompleteTasks = tasks.filter(t => t.progressPercentage < 100);
  const completedTasksCount = tasks.filter(t => t.progressPercentage === 100).length;
  const activeAtRiskCount = tasks.filter(t => t.progressPercentage < 100 && (t.scheduleStatus === 'at_risk' || t.scheduleStatus === 'rescue')).length;
  
  const averageSurvivalRate = tasks.length > 0 
    ? Math.round(tasks.reduce((sum, t) => sum + t.progressPercentage, 0) / tasks.length)
    : 0;

  const progressRiskVal = incompleteTasks.length > 0 
    ? Math.round(incompleteTasks.reduce((sum, t) => sum + (100 - t.progressPercentage), 0) / incompleteTasks.length)
    : 0;

  const deadlinePressureVal = incompleteTasks.length > 0
    ? (() => {
        const pressures = incompleteTasks.map(t => {
          const timeAvailableMs = new Date(t.deadline).getTime() - Date.now();
          const totalMinutesNeeded = t.subtasks ? t.subtasks.reduce((sum, s) => sum + (s.estimatedMinutes || 30), 0) : 120;
          const minutesAvailable = timeAvailableMs / (1000 * 60);
          if (minutesAvailable <= 0) return 100;
          const ratio = totalMinutesNeeded / minutesAvailable;
          return Math.min(100, Math.round(ratio * 100));
        });
        return Math.max(...pressures);
      })()
    : 0;

  const inactivityRiskVal = incompleteTasks.length > 0
    ? Math.min(100, Math.round((incompleteTasks.filter(t => !t.status || t.status === 'paused' || t.progressPercentage === 0).length / incompleteTasks.length) * 100))
    : 0;

  const overallCollapseRiskVal = incompleteTasks.length > 0
    ? Math.round((progressRiskVal + deadlinePressureVal + inactivityRiskVal) / 3)
    : 0;

  // Format countdown text helper
  const getCountdownText = (deadlineStr: string, progress: number) => {
    if (progress === 100) return 'Deadline Survived';
    const diff = new Date(deadlineStr).getTime() - Date.now();
    if (diff <= 0) return 'Deadline Breached';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    if (hours > 0) return `${hours}h ${Math.floor((diff / (1000 * 60)) % 60)}m remaining`;
    return `${Math.floor(diff / (1000 * 60))}m remaining`;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner Greetings (Immersive UI style header) */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Execution Dashboard</h2>
          <p className="text-sm text-slate-400">System online. {incompleteTasks.length} critical {incompleteTasks.length === 1 ? 'deadline' : 'deadlines'} detected.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-mono text-cyan-400">
            SYS_STATUS: {incompleteTasks.length > 0 ? 'COMPRESSION_READY' : 'STABLE_ORBIT'}
          </div>
          <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full border border-white/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
          </div>
        </div>
      </header>

      {/* Top Section: Real-Time Command & Control Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Risk Triage & Progress rings */}
        <div className="lg:col-span-5 glass-panel p-5 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/10 border-white/5 relative overflow-hidden flex flex-col justify-between rounded-2xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-[30px] rounded-full"></div>
          <div className="relative space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h3 className="font-mono text-xs uppercase tracking-widest text-cyan-400 font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span>Execution Analytics</span>
              </h3>
              <span className="text-[9px] font-mono text-slate-500">LIVE SENSORS</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 pt-1 items-center">
              {/* Circular Overall Risk Gauge */}
              <div className="sm:col-span-5 flex flex-col items-center justify-center p-3 bg-white/5 border border-white/5 rounded-2xl text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-rose-500/5 to-transparent"></div>
                <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest mb-2 block font-semibold">Collapse Risk</span>
                <div className="relative flex items-center justify-center">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle cx="40" cy="40" r="34" className="stroke-white/5" strokeWidth="5" fill="transparent" />
                    <circle 
                      cx="40" 
                      cy="40" 
                      r="34" 
                      className={`${overallCollapseRiskVal >= 65 ? 'stroke-rose-500' : overallCollapseRiskVal >= 45 ? 'stroke-yellow-500' : 'stroke-emerald-500'} transition-all duration-500`} 
                      strokeWidth="5" 
                      fill="transparent" 
                      strokeDasharray={2 * Math.PI * 34}
                      strokeDashoffset={2 * Math.PI * 34 * (1 - overallCollapseRiskVal / 100)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className={`text-xl font-display font-extrabold ${overallCollapseRiskVal >= 65 ? 'text-rose-400' : overallCollapseRiskVal >= 45 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {overallCollapseRiskVal}%
                    </span>
                    <span className="text-[7px] font-mono text-slate-500 block uppercase tracking-wider">
                      {overallCollapseRiskVal >= 65 ? 'CRITICAL' : overallCollapseRiskVal >= 45 ? 'WARNING' : 'STABLE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Linear Sub-metrics breakdown */}
              <div className="sm:col-span-7 space-y-3 font-mono text-[9px] uppercase tracking-wider">
                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Progress Lag:</span>
                    <span className="text-rose-400 font-bold">{progressRiskVal}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${progressRiskVal}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Deadline Weight:</span>
                    <span className="text-orange-400 font-bold">{deadlinePressureVal}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${deadlinePressureVal}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Focus Stagnation:</span>
                    <span className="text-yellow-400 font-bold">{inactivityRiskVal}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500 rounded-full transition-all duration-500" style={{ width: `${inactivityRiskVal}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="lg:col-span-7 grid grid-cols-2 gap-4">
          {/* Stat 1: Active Deadlines */}
          <div className="glass-panel p-5 flex items-center gap-4 hover:border-cyan-500/30 transition-all duration-300">
            <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <Hourglass className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">Active Tracks</p>
              <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">{incompleteTasks.length}</h3>
            </div>
          </div>

          {/* Stat 2: Survivals */}
          <div className="glass-panel p-5 flex items-center gap-4 hover:border-green-500/30 transition-all duration-300">
            <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">Done / Survived</p>
              <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">{completedTasksCount}</h3>
            </div>
          </div>

          {/* Stat 3: Average Progress */}
          <div className="glass-panel p-5 flex items-center gap-4 hover:border-indigo-500/30 transition-all duration-300">
            <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <Flame className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">Survival Rate</p>
              <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">{averageSurvivalRate}%</h3>
            </div>
          </div>

          {/* Stat 4: Risk Alert */}
          <div className={`glass-panel p-5 flex items-center gap-4 transition-all duration-300 hover:border-orange-500/30 ${activeAtRiskCount > 0 ? 'border-orange-500/40 bg-orange-950/10 shadow-[0_0_15px_rgba(249,115,22,0.15)]' : ''}`}>
            <div className={`p-3 rounded-xl border ${activeAtRiskCount > 0 ? 'bg-orange-500/20 border-orange-500/30' : 'bg-white/5 border-white/10'}`}>
              <ShieldAlert className={`w-5 h-5 ${activeAtRiskCount > 0 ? 'text-orange-400 animate-pulse' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">Triage Danger</p>
              <h3 className={`text-xl sm:text-2xl font-bold mt-1 ${activeAtRiskCount > 0 ? 'text-orange-400' : 'text-white'}`}>{activeAtRiskCount}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Immersive Tab Selector Bar */}
      <div className="flex border-b border-white/5 pb-0.5 gap-6">
        <button
          onClick={() => setActiveTab('terminal')}
          className={`pb-3 text-xs font-mono uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
            activeTab === 'terminal'
              ? 'border-cyan-400 text-cyan-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          ● AI PLANNING TERMINAL
        </button>
        <button
          onClick={() => setActiveTab('goals')}
          className={`pb-3 text-xs font-mono uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'goals'
              ? 'border-cyan-400 text-cyan-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Flame className={`w-3.5 h-3.5 ${activeTab === 'goals' ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
          <span>● GOALS & HABITS HUB</span>
        </button>
      </div>

      {activeTab === 'terminal' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Side: Create Plan Form (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-panel p-5 relative overflow-hidden">
              {/* Ambient glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[30px] rounded-full -mr-6 -mt-6"></div>
              
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <h2 className="font-display font-semibold text-base text-white">Initialize Execution Plan</h2>
                </div>
  
                <form onSubmit={handleCreateTask} className="space-y-4">
                  {formError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-xs text-rose-400">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}
  
                  <div>
                    <label className="block text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Goal or Task Description</label>
                    <input
                      type="text"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="e.g. Complete MVP Integrations"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:bg-white/10 transition-all"
                      disabled={generating}
                    />
                  </div>
  
                  <div>
                    <label className="block text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Absolute Deadline</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="datetime-local"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 focus:bg-white/10 transition-all"
                        disabled={generating}
                      />
                    </div>
                  </div>
  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Subtasks (Opt)</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={manualTotalSubtasks}
                        onChange={(e) => setManualTotalSubtasks(e.target.value)}
                        placeholder="e.g. 6"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:bg-white/10 transition-all"
                        disabled={generating}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Done (Opt)</label>
                      <input
                        type="number"
                        min="0"
                        max={manualTotalSubtasks || "30"}
                        value={manualCompletedSubtasks}
                        onChange={(e) => setManualCompletedSubtasks(e.target.value)}
                        placeholder="e.g. 2"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:bg-white/10 transition-all"
                        disabled={generating}
                      />
                    </div>
                  </div>
  
                  <button
                    type="submit"
                    disabled={generating}
                    className="w-full py-2 px-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-[0_4px_15px_rgba(6,182,212,0.25)] inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {generating ? (
                      <>
                        <Loader className="w-3.5 h-3.5 animate-spin text-black" />
                        Analyzing via ChronoMind...
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 text-black font-extrabold" />
                        Initialize Plan
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
  
          {/* Middle: Active Deadlines (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-display font-semibold text-base text-white">Active Timeline Tracks</h2>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{incompleteTasks.length} active</span>
            </div>
  
            {loadingTasks ? (
              <div className="glass-panel p-10 flex flex-col items-center justify-center text-center">
                <Loader className="w-8 h-8 text-cyan-400 animate-spin" />
                <p className="text-slate-400 text-xs mt-3 font-mono">Syncing deadline trackers...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="glass-panel p-8 text-center border-dashed">
                <div className="w-10 h-10 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <Brain className="w-5 h-5 text-cyan-400" />
                </div>
                <p className="text-slate-300 text-sm font-medium">No active tracks.</p>
                <p className="text-slate-500 text-[11px] mt-1 max-w-xs mx-auto leading-relaxed">
                  Enter a goal and time limit to start.
                </p>
              </div>
            ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {tasks.map((task) => {
                const totalMinutesNeeded = task.subtasks ? task.subtasks.reduce((sum, s) => sum + (s.estimatedMinutes || 30), 0) : 0;
                const timeAvailableMs = new Date(task.deadline).getTime() - Date.now();
                const minutesAvailable = timeAvailableMs / (1000 * 60);
                const isImpossible = task.isImpossible === true || (totalMinutesNeeded > minutesAvailable);

                const countdown = getCountdownText(task.deadline, task.progressPercentage);
                const isRescue = task.scheduleStatus === 'rescue';
                const isAtRisk = task.scheduleStatus === 'at_risk';
                const isDone = task.progressPercentage === 100;

                const isCurrentlyActioning = performingActionId === task.id;

                return (
                  <div
                    key={task.id}
                    onClick={(e) => {
                      if (isImpossible) {
                        e.stopPropagation();
                        return; // Disable inspect / navigation
                      }
                      onSelectTask(task);
                    }}
                    className={`glass-panel p-5 flex flex-col justify-between gap-4 relative overflow-hidden group border transition-all ${
                      isImpossible ? 'border-rose-500/40 bg-rose-950/5 shadow-[0_0_15px_rgba(244,63,94,0.1)]' :
                      isRescue ? 'border-orange-500/50 bg-gradient-to-r from-orange-600/10 to-orange-950/20 shadow-[0_0_20px_rgba(249,115,22,0.1)] cursor-pointer glass-panel-hover' :
                      isAtRisk ? 'border-yellow-500/30 cursor-pointer glass-panel-hover' : 'border-white/10 cursor-pointer glass-panel-hover'
                    }`}
                  >
                    {/* Left details */}
                    <div className="space-y-2.5 flex-1 w-full">
                      <div className="flex items-start justify-between md:justify-start md:items-center gap-2.5">
                        {editingTaskTitleId === task.id ? (
                          <div className="flex items-center gap-2 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={tempTaskTitle}
                              onChange={(e) => setTempTaskTitle(e.target.value)}
                              className="px-2 py-1 bg-white/5 border border-white/20 rounded text-sm text-white focus:outline-none focus:border-cyan-500 font-sans flex-1"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEditedTitle(task.id)}
                              className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-mono uppercase rounded transition-all"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingTaskTitleId(null)}
                              className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-mono uppercase rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <h3 className="font-display font-semibold text-base text-white group-hover:text-cyan-400 transition-colors line-clamp-1 flex items-center gap-2">
                            {task.task}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTaskTitleId(task.id);
                                setTempTaskTitle(task.task);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-cyan-400 transition-all rounded"
                              title="Edit Title"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </h3>
                        )}

                        {/* Status Badge */}
                        {isImpossible ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono shrink-0 uppercase tracking-widest border bg-rose-500/10 text-rose-400 border-rose-500/20 flex items-center gap-1">
                            ⚠️ FEASIBILITY FAIL
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest border ${
                              isDone ? 'bg-green-500/10 text-green-500 border-green-500/30' :
                              isRescue ? 'bg-orange-500/20 text-orange-400 border-orange-500/50 animate-pulse' :
                              isAtRisk ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' :
                              'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                            }`}>
                              {task.scheduleStatus} Mode
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest border ${
                              task.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/40 animate-pulse font-bold' :
                              task.status === 'paused' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                              task.status === 'delayed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                              task.status === 'rescued' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30 font-bold' :
                              'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            }`}>
                              ● {task.status || 'pending'}
                            </span>
                          </div>
                        )}
                      </div>

                      {isImpossible ? (
                        <div className="space-y-3 bg-rose-500/5 border border-rose-500/10 p-4 rounded-xl mt-3">
                          <p className="text-xs text-rose-400 font-mono leading-relaxed">
                            <strong>This task cannot be completed within the given deadline.</strong>
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                            {task.impossibleReason || `The estimated total required time (${totalMinutesNeeded} mins) exceeds the available remaining time (${Math.max(0, Math.round(minutesAvailable))} mins).`}
                          </p>

                          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest pt-1">
                            CRITICAL PATH FEASIBLE ALTERNATIVES:
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReschedulingTaskId(task.id);
                                setNewDeadline(task.deadline);
                              }}
                              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-mono uppercase tracking-wider text-cyan-400 transition-all flex items-center gap-1"
                              disabled={isCurrentlyActioning}
                            >
                              Extend Deadline (Reschedule)
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReduceScope(task);
                              }}
                              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-mono uppercase tracking-wider text-yellow-400 transition-all flex items-center gap-1"
                              disabled={isCurrentlyActioning}
                            >
                              Reduce Scope
                            </button>
                          </div>

                          {reschedulingTaskId === task.id && (
                            <div className="bg-black/50 border border-white/10 p-3 rounded-lg space-y-2 mt-2" onClick={(e) => e.stopPropagation()}>
                              <label className="block text-[9px] font-mono text-slate-400 uppercase tracking-widest">Select New Feasible Deadline</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="datetime-local"
                                  value={newDeadline}
                                  onChange={(e) => setNewDeadline(e.target.value)}
                                  className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-cyan-500 font-mono flex-1"
                                />
                                <button
                                  onClick={() => handleSaveRescheduledDeadline(task.id)}
                                  className="px-3 py-1 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded text-[10px] font-mono uppercase transition-all"
                                  disabled={isCurrentlyActioning}
                                >
                                  {isCurrentlyActioning ? 'Saving...' : 'Confirm'}
                                </button>
                                <button
                                  onClick={() => setReschedulingTaskId(null)}
                                  className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] font-mono uppercase text-slate-400"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-mono">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {new Date(task.deadline).toLocaleDateString()} {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={`font-semibold ${isRescue ? 'text-orange-400' : isAtRisk ? 'text-yellow-500' : 'text-cyan-400'}`}>
                            {countdown}
                          </span>
                        </div>
                      )}

                      {/* Progress Bar (hidden for impossible tasks) */}
                      {!isImpossible && (
                        <div className="space-y-1 w-full">
                          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                            <span>PROGRESS: {task.progressPercentage}%</span>
                            <span>{task.completedSubtasks}/{task.totalSubtasks} SUBTASKS</span>
                          </div>
                          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isDone ? 'bg-green-500' :
                                isRescue ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]' :
                                isAtRisk ? 'bg-yellow-500' :
                                'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                              }`}
                              style={{ width: `${task.progressPercentage}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right action block */}
                    <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-end border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                      <button
                        onClick={(e) => handleDeleteTask(task.id, e)}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-white/5 rounded-full transition-all"
                        title="Abort Deadline Track"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {!isImpossible && (
                        <button 
                          className="px-4 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full text-[11px] font-medium transition-all text-slate-200 flex items-center gap-1"
                        >
                          Inspect
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Cognitive Intelligence Core (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-panel p-5 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/10 border-cyan-500/10 relative overflow-hidden rounded-2xl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-2xl rounded-full"></div>
            
            <div className="relative space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <h4 className="font-mono text-[10px] uppercase tracking-widest text-cyan-400 font-bold flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span>Cognitive Intelligence</span>
                </h4>
                <span className="text-[8px] font-mono text-slate-500">LIVE COGNITIVE</span>
              </div>

              {/* Mini Tabs Selector */}
              <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => setCognitiveSubTab('future_self')}
                  className={`flex-1 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center ${
                    cognitiveSubTab === 'future_self'
                      ? 'bg-cyan-500 text-black shadow-[0_0_8px_rgba(6,182,212,0.3)] font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Future Self
                </button>
                <button
                  onClick={() => setCognitiveSubTab('triage')}
                  className={`flex-1 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center ${
                    cognitiveSubTab === 'triage'
                      ? 'bg-orange-500 text-black shadow-[0_0_8px_rgba(249,115,22,0.3)] font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Emergency
                </button>
                <button
                  onClick={() => setCognitiveSubTab('habits')}
                  className={`flex-1 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center ${
                    cognitiveSubTab === 'habits'
                      ? 'bg-green-500 text-black shadow-[0_0_8px_rgba(34,197,94,0.3)] font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Habits
                </button>
              </div>

              {/* Subtab Contents */}
              {cognitiveSubTab === 'future_self' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                    Our automated behavioral engine constantly runs predictive simulations to analyze your probability of completion.
                  </p>
                  <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-wider font-semibold font-bold font-mono">Simulation</span>
                      <span className="text-[9px] font-mono text-slate-400 font-bold font-mono">
                        {overallCollapseRiskVal > 50 ? "⚠️ DECAY" : "✅ STABLE"}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans leading-normal">
                      {overallCollapseRiskVal > 50 
                        ? "At-risk trajectories detected. ChronoMind is calculating optimized fallback sequences to maintain deadline integrity."
                        : "Excellent pace. Simulated future self reports highly positive focus and low psychological friction."}
                    </p>
                  </div>
                </div>
              )}

              {cognitiveSubTab === 'triage' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                    Emergency Survival mode automatically triggers on high-stress timelines to compress non-essential details.
                  </p>
                  <div className="p-3 bg-orange-950/20 border border-orange-500/20 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono text-orange-400 uppercase tracking-wider font-semibold font-bold font-mono">Triage Level</span>
                      <span className="text-[9px] font-mono text-slate-400 font-bold font-mono">
                        {activeAtRiskCount > 0 ? "🚨 TRIGGERED" : "🔋 STANDBY"}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans leading-normal">
                      {activeAtRiskCount > 0 
                        ? "At-risk track identified. Triage engine has automatically compressed detailed subtasks into immediate actionable roadmaps."
                        : "Monitoring active deadlines. Triage will auto-engage to strip psychological weight if completion risks spike."}
                    </p>
                  </div>
                </div>
              )}

              {cognitiveSubTab === 'habits' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                    Daily habit completions insulate your focus and permanently shield active deadlines from cognitive decay.
                  </p>
                  <div className="p-3 bg-green-950/20 border border-green-500/20 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono text-green-400 uppercase tracking-wider font-semibold font-bold font-mono">Momentum</span>
                      <span className="text-[9px] font-mono text-green-400 font-bold font-mono">{streak}d Streak</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans leading-normal">
                      {streak > 0 
                        ? `Keep going! Your active ${streak}-day habit streak adds a consistent progress buffer, lowering inactivity and collapse risks.`
                        : "No active streak today. Navigate to the Goals & Habits Hub to check in and secure your consistency score against decay."}
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
      ) : (
        /* Goals & Habits Hub Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Side: Stats and Habits Tracker */}
          <div className="lg:col-span-5 space-y-6">
            {/* Dynamic Streaks & Consistency Bento block */}
            <div className="glass-panel p-6 sm:p-8 bg-gradient-to-br from-slate-950 via-cyan-950/10 to-indigo-950/10 border-cyan-500/10 relative overflow-hidden rounded-2xl">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-[30px] rounded-full"></div>
              <div className="relative space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <h3 className="font-display font-semibold text-base text-white">Streak & Consistency Center</h3>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">Current Streak</p>
                    <div className="flex items-center justify-center gap-1">
                      <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
                      <span className="text-lg font-bold text-white font-mono">{streak}d</span>
                    </div>
                  </div>

                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">Personal Best</p>
                    <span className="text-lg font-bold text-white font-mono">{longestStreak}d</span>
                  </div>

                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">Consistency</p>
                    <span className="text-lg font-bold text-cyan-400 font-mono">{consistencyScore}%</span>
                  </div>
                </div>

                {/* Progress bar representing consistency score */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                    <span>RELIABILITY RATING</span>
                    <span>{consistencyScore >= 80 ? 'EXCELLENT' : consistencyScore >= 50 ? 'STABLE' : 'CRITICAL'}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        consistencyScore >= 80 ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]' :
                        consistencyScore >= 50 ? 'bg-yellow-500' : 'bg-rose-500 animate-pulse'
                      }`}
                      style={{ width: `${consistencyScore}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Habits list checkbox bento block */}
            <div className="glass-panel p-6 sm:p-8 rounded-2xl">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/5">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <h3 className="font-display font-semibold text-base text-white">Daily Habit Trackers</h3>
              </div>

              <div className="space-y-3">
                {habits.map((habit) => (
                  <div
                    key={habit.id}
                    onClick={() => handleToggleHabit(habit.name, habit.completed, habit.logId)}
                    className={`p-4 rounded-xl border flex items-center justify-between gap-4 cursor-pointer transition-all ${
                      habit.completed 
                        ? 'bg-cyan-500/5 border-cyan-500/20 shadow-[inset_0_0_10px_rgba(6,182,212,0.03)]' 
                        : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {habit.completed ? (
                        <CheckCircle className="w-5 h-5 text-cyan-400 shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-white/30 shrink-0" />
                      )}
                      <span className={`text-sm text-slate-300 font-medium ${habit.completed ? 'line-through text-slate-500' : ''}`}>
                        {habit.name}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono shrink-0 uppercase tracking-wider border ${
                      habit.completed ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-white/5 text-slate-500 border-white/5'
                    }`}>
                      {habit.completed ? 'COMPLETED' : 'PENDING'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side: Goals board */}
          <div className="lg:col-span-7 space-y-6">
            {/* Form to create a new goal */}
            <div className="glass-panel p-6 sm:p-8 relative overflow-hidden rounded-2xl">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-[30px] rounded-full"></div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-6">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-display font-semibold text-base text-white">Establish a New Objective</h3>
                </div>

                <form onSubmit={handleAddGoal} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-8">
                      <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Goal Description</label>
                      <input
                        type="text"
                        value={newGoalTitle}
                        onChange={(e) => setNewGoalTitle(e.target.value)}
                        placeholder="e.g. Master React-Native design paradigms"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:bg-white/10 transition-all"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Horizon</label>
                      <select
                        value={newGoalType}
                        onChange={(e) => setNewGoalType(e.target.value as any)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 focus:bg-white/10 transition-all cursor-pointer"
                      >
                        <option value="daily" className="bg-slate-950 text-white">Daily</option>
                        <option value="weekly" className="bg-slate-950 text-white">Weekly</option>
                        <option value="long-term" className="bg-slate-950 text-white">Long-term</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase tracking-widest text-xs rounded-xl transition-all shadow-[0_4px_15px_rgba(6,182,212,0.2)] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-black" />
                    <span>Deploy Goal</span>
                  </button>
                </form>
              </div>
            </div>

            {/* List of active goals */}
            <div className="glass-panel p-6 sm:p-8 rounded-2xl">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-display font-semibold text-base text-white">Strategic Goals</h3>
                </div>
                <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">{goals.length} total</span>
              </div>

              {loadingGoals ? (
                <div className="p-12 flex flex-col items-center justify-center text-center">
                  <Loader className="w-6 h-6 text-cyan-400 animate-spin" />
                  <p className="text-slate-400 text-xs mt-2 font-mono">Syncing goals board...</p>
                </div>
              ) : goals.length === 0 ? (
                <div className="p-12 text-center border-dashed border border-white/5 rounded-2xl">
                  <p className="text-slate-400 font-medium text-sm">No strategic goals created yet.</p>
                  <p className="text-slate-500 text-xs mt-1">Specify an objective above to schedule your roadmap.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                  {goals.map((goal) => (
                    <div
                      key={goal.id}
                      className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                        goal.completed 
                          ? 'bg-green-500/5 border-green-500/20 opacity-60' 
                          : 'bg-white/5 border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleGoal(goal.id, goal.completed)}
                          className="text-slate-400 hover:text-cyan-400 transition-all cursor-pointer"
                        >
                          {goal.completed ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : (
                            <div className="w-5 h-5 rounded border border-white/30" />
                          )}
                        </button>
                        <div>
                          <span className={`text-sm text-slate-200 font-medium block ${goal.completed ? 'line-through text-slate-500' : ''}`}>
                            {goal.title}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5 uppercase tracking-wider">
                            Type: {goal.type}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-white/5 rounded transition-all cursor-pointer"
                        title="Delete Goal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <ChronoVoice tasks={tasks} />
    </div>
  );
}
