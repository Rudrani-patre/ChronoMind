/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Task, Subtask, SimulationResult, RescueResult } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, getDoc, collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import TimelineView from './TimelineView';
import confetti from 'canvas-confetti';
import { 
  logProgress, 
  logRisk, 
  logFutureSimulation, 
  logRescueActivation, 
  logActivity,
  logFutureBehavior
} from '../utils/dbLogger';
import { 
  ArrowLeft, Calendar, ShieldAlert, Sparkles, CheckSquare, Square, 
  Flame, HelpCircle, RefreshCw, Zap, Trophy, Play, CheckCircle2, 
  Loader, Info, Compass, AlertTriangle, AlertCircle, Sparkle,
  Brain, Activity
} from 'lucide-react';

interface TaskDetailsProps {
  task: Task;
  onBack: () => void;
}

export default function TaskDetails({ task: initialTask, onBack }: TaskDetailsProps) {
  const { user, profile } = useAuth();
  const [task, setTask] = useState<Task>(initialTask);
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [savingInBg, setSavingInBg] = useState(false);
  
  // Active Reminder and Completion statistics states
  const [activeReminder, setActiveReminder] = useState<{
    id: string;
    message: string;
    type: 'inactivity' | 'deadline' | 'behind' | 'progressing' | 'rescue_near';
    timestamp: number;
  } | null>(null);
  const [isExitingReminder, setIsExitingReminder] = useState(false);

  const [completionStats, setCompletionStats] = useState<{
    totalTimeSpent: string;
    completionEfficiency: number;
    riskAvoided: number;
    streakUpdated: number;
  } | null>(null);

  // Context-Aware Reminder System Smart Refs
  const lastReminderTimeRef = useRef<number>(0);
  const lastReminderTypeRef = useRef<string>("");
  const hasTriggeredInactivityInCurrentSessionRef = useRef<boolean>(false);
  const activeReminderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Rotate index trackers for dynamic messaging
  const categoryRotationsRef = useRef<{ [key: string]: number }>({
    inactivity: 0,
    behind: 0,
    deadline: 0,
    progressing: 0,
    rescue_near: 0,
    future_self: 0
  });
  
  // Task state system states
  const [taskStatus, setTaskStatus] = useState<'pending' | 'active' | 'paused' | 'completed' | 'delayed' | 'rescued'>(initialTask.status || 'pending');
  const [idleSeconds, setIdleSeconds] = useState(35);

  // Manual subtask tracker inputs
  const [manualTotalInput, setManualTotalInput] = useState<string>(initialTask.totalSubtasks.toString());
  const [manualCompletedInput, setManualCompletedInput] = useState<string>(initialTask.completedSubtasks.toString());

  // Future Self Simulator state
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  
  // Rescue Mode state
  const [rescuing, setRescuing] = useState(false);
  const [rescueResult, setRescueResult] = useState<RescueResult | null>(null);
  const [activeRescuePlan, setActiveRescuePlan] = useState<string | null>(task.rescuePlan || null);

  // New feedback and overlay states
  const [futureSelfFeedback, setFutureSelfFeedback] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null);
  const [showRescueAlert, setShowRescueAlert] = useState(false);
  const [showCongratsModal, setShowCongratsModal] = useState(false);

  // Sync state if initialTask changes (e.g. from real-time database)
  useEffect(() => {
    setTask(initialTask);
    setTaskStatus(initialTask.status || 'pending');
    setManualTotalInput(initialTask.totalSubtasks.toString());
    setManualCompletedInput(initialTask.completedSubtasks.toString());
    if (initialTask.rescuePlan) {
      setActiveRescuePlan(initialTask.rescuePlan);
    }
  }, [initialTask]);

  // Dynamic message template generator and rotation
  const getDynamicReminderMessage = (
    type: 'inactivity' | 'deadline' | 'behind' | 'progressing' | 'rescue_near' | 'future_self',
    currentTask: Task
  ): string => {
    const diff = new Date(currentTask.deadline).getTime() - Date.now();
    const hoursRemaining = Math.max(1, Math.round(diff / (1000 * 60 * 60)));
    const risk = currentTask.riskScore || 0;
    const completed = currentTask.completedSubtasks;
    const total = currentTask.totalSubtasks;
    const remaining = total - completed;
    
    // Inactivity weight representing minutes
    const inactivityMinutes = currentTask.inactivityWeight || 18;

    // Next subtask number and name helper
    const nextSubIdx = currentTask.subtasks.findIndex(s => !s.completed);
    const subNum = nextSubIdx !== -1 ? nextSubIdx + 1 : 1;
    const nextSubName = nextSubIdx !== -1 ? `"${currentTask.subtasks[nextSubIdx].title}"` : "your next milestone";

    // Expected progress based on time elapsed
    const elapsedMs = Date.now() - new Date(currentTask.createdAt || Date.now()).getTime();
    const totalDuration = new Date(currentTask.deadline).getTime() - new Date(currentTask.createdAt || Date.now()).getTime();
    const expectedProgress = totalDuration > 0 ? Math.min(100, (elapsedMs / totalDuration) * 100) : 50;
    const expectedCompleted = Math.round((expectedProgress / 100) * total);
    const lagSubtasks = Math.max(1, expectedCompleted - completed);
    
    const riskReduction = Math.round(100 / Math.max(1, total));
    const progressAhead = Math.max(5, Math.round(currentTask.progressPercentage - expectedProgress));

    const templates: { [key: string]: string[] } = {
      inactivity: [
        `You’ve paused for ${inactivityMinutes} minutes. Momentum drops fastest in the first break.`,
        `Your flow state is cooling down. Resume now to avoid delay accumulation.`,
        `Flow stagnation detected. A quick 1-minute step on subtask ${subNum} gets you back in the groove.`
      ],
      behind: [
        `You are ${lagSubtasks} subtasks behind the projected pace. Let's regain the lead.`,
        `One more completed subtask will lower risk by ${riskReduction}%.`,
        `Lag identified. Complete ${nextSubName} to recover ${riskReduction}% of your timeline safety buffer.`
      ],
      deadline: [
        `Only ${hoursRemaining} hours remain. Prioritize high-impact tasks first.`,
        `Deadline compression increasing. Focus on critical execution.`,
        `Time compression warning. Only ${hoursRemaining} hours left. Ensure your cognitive energy is directed to ${nextSubName}.`
      ],
      progressing: [
        `You’re ahead of schedule by ${progressAhead}%. Outstanding work!`,
        `Current pace is stable. Maintain this rhythm.`,
        `Outstanding cadence. Finishing subtask ${subNum} now secures tomorrow's buffer.`
      ],
      rescue_near: [
        `Risk approaching critical threshold (${risk}%). Maintain activity to avoid automatic Rescue Mode.`,
        `Maintain momentum to avoid Rescue Mode. Let's finish ${nextSubName} to secure your safety buffer!`,
        `System stabilization recommended. Overall risk is ${risk}%. One subtask completion keeps rescue protocols offline.`
      ],
      future_self: [
        `Future-you will thank you for finishing this now.`,
        `Completing this now reduces tomorrow’s pressure.`,
        `Sending a buffer to your future self. Let's check off ${nextSubName} to ease tomorrow's cognitive load.`
      ]
    };

    const categoryTemplates = templates[type] || templates['progressing'];
    const currentIndex = categoryRotationsRef.current[type] || 0;
    const template = categoryTemplates[currentIndex % categoryTemplates.length];
    
    // Increment rotation index
    categoryRotationsRef.current[type] = (currentIndex + 1) % categoryTemplates.length;

    return template;
  };

  const dismissReminderSmoothly = () => {
    setIsExitingReminder(true);
    setTimeout(() => {
      setActiveReminder(null);
      setIsExitingReminder(false);
    }, 300);
  };

  // Recalculate dynamic context-aware reminder helper
  const recalculateDynamicReminder = async (currentTask: Task, status: string, idleSecs: number, forceTrigger: boolean = false) => {
    if (currentTask.progressPercentage === 100) {
      setActiveReminder(null);
      return;
    }

    const now = Date.now();
    
    // Cooldown check: 2 minutes (120,000 ms), unless bypassed by manual action (forceTrigger = true)
    if (!forceTrigger && (now - lastReminderTimeRef.current < 120000)) {
      return;
    }

    const diff = new Date(currentTask.deadline).getTime() - Date.now();
    const hoursRemaining = diff / (1000 * 60 * 60);
    const risk = currentTask.riskScore || 0;
    
    let triggerType: 'inactivity' | 'deadline' | 'behind' | 'progressing' | 'rescue_near' | 'future_self' = 'progressing';
    
    // Determine the most critical category based on context
    if (status === 'active' && idleSecs < 25) {
      triggerType = 'inactivity';
    } else if (risk >= 50 && risk < 65 && currentTask.scheduleStatus !== 'rescue') {
      triggerType = 'rescue_near';
    } else if (hoursRemaining > 0 && hoursRemaining <= 4) {
      triggerType = 'deadline';
    } else if (risk >= 45) {
      triggerType = 'behind';
    } else {
      // Rotate standard progressing and future self styles
      triggerType = Math.random() > 0.45 ? 'future_self' : 'progressing';
    }

    // Avoid consecutive repeat of same reminder category to keep it fresh
    if (triggerType === lastReminderTypeRef.current && !forceTrigger) {
      return;
    }

    const reminderText = getDynamicReminderMessage(triggerType, currentTask);

    if (reminderText) {
      lastReminderTimeRef.current = now;
      lastReminderTypeRef.current = triggerType;

      // Clear any active auto-dismiss timeout first to prevent overlap
      if (activeReminderTimeoutRef.current) {
        clearTimeout(activeReminderTimeoutRef.current);
      }
      setIsExitingReminder(false);

      setActiveReminder({
        id: Math.random().toString(36).substring(7),
        message: reminderText,
        type: triggerType === 'future_self' ? 'progressing' : triggerType,
        timestamp: now
      });

      // Auto-disappear after 5.5 seconds
      activeReminderTimeoutRef.current = setTimeout(() => {
        dismissReminderSmoothly();
      }, 5500);

      if (user) {
        try {
          await addDoc(collection(db, 'behavior_logs'), {
            userId: user.uid,
            taskId: currentTask.id,
            triggerType,
            message: reminderText,
            createdAt: new Date().toISOString(),
            riskScore: risk
          });
        } catch (err) {
          console.error("Failed to store behavior log:", err);
        }
      }
    }
  };

  // Track previous task fields to detect meaningful context shifts
  const prevCompletedRef = useRef<number>(initialTask.completedSubtasks);
  const prevTotalRef = useRef<number>(initialTask.totalSubtasks);
  const prevStatusRef = useRef<string>(initialTask.status || 'pending');
  const prevRiskRef = useRef<number>(initialTask.riskScore || 0);

  useEffect(() => {
    // Reset inactivity state on idle reset
    if (idleSeconds >= 34) {
      hasTriggeredInactivityInCurrentSessionRef.current = false;
    }

    let shouldTrigger = false;
    let forceTrigger = false;

    // Detect manual checkbox complete/incomplete
    if (task.completedSubtasks !== prevCompletedRef.current || task.totalSubtasks !== prevTotalRef.current) {
      prevCompletedRef.current = task.completedSubtasks;
      prevTotalRef.current = task.totalSubtasks;
      shouldTrigger = true;
      forceTrigger = true;
    }

    // Detect status shift
    if (taskStatus !== prevStatusRef.current) {
      prevStatusRef.current = taskStatus;
      shouldTrigger = true;
      forceTrigger = true;
    }

    // Detect major risk shift
    if (Math.abs((task.riskScore || 0) - prevRiskRef.current) >= 5) {
      prevRiskRef.current = task.riskScore || 0;
      shouldTrigger = true;
    }

    // Detect first entry into idle warning
    if (taskStatus === 'active' && idleSeconds < 25 && !hasTriggeredInactivityInCurrentSessionRef.current) {
      hasTriggeredInactivityInCurrentSessionRef.current = true;
      shouldTrigger = true;
    }

    if (shouldTrigger) {
      recalculateDynamicReminder(task, taskStatus, idleSeconds, forceTrigger);
    }
  }, [task, taskStatus, idleSeconds]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (activeReminderTimeoutRef.current) {
        clearTimeout(activeReminderTimeoutRef.current);
      }
    };
  }, []);

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

  const timeRemainingText = getCountdownText(task.deadline, task.progressPercentage);

  // Helper to calculate task metrics locally (FAST & OPTIMISTIC)
  const calculateTaskMetrics = (updatedSubtasks: Subtask[]) => {
    const completed = updatedSubtasks.filter(s => s.completed).length;
    const total = updatedSubtasks.length;
    const progress = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;

    const diff = new Date(task.deadline).getTime() - Date.now();
    const hoursRemaining = diff / (1000 * 60 * 60);

    let scheduleMode: 'normal' | 'at_risk' | 'rescue' = task.scheduleStatus;

    if (progress === 100) {
      scheduleMode = 'normal';
    } else if (task.scheduleStatus !== 'rescue') {
      if (hoursRemaining < 6 && progress < 40) {
        scheduleMode = 'rescue';
      } else if (hoursRemaining < 24 && progress < 60) {
        scheduleMode = 'at_risk';
      } else {
        scheduleMode = 'normal';
      }
    }

    const timeElapsed = Date.now() - new Date(task.createdAt || Date.now()).getTime();
    const totalTime = new Date(task.deadline).getTime() - new Date(task.createdAt || Date.now()).getTime();
    const expectedProgress = totalTime > 0 ? Math.min(100, Math.max(0, (timeElapsed / totalTime) * 100)) : 50;
    const progressLag = Math.max(0, expectedProgress - progress);
    const urgency = hoursRemaining <= 0 ? 50 : Math.max(0, 30 - hoursRemaining * 1.5);
    const inactivityWeight = task.inactivityWeight || 10;
    
    // Risk formula: Risk = progress lag + deadline urgency + inactivity weight
    const calculatedRisk = progress === 100 ? 0 : Math.min(100, Math.round(progressLag + urgency + inactivityWeight));

    return {
      subtasks: updatedSubtasks,
      completedSubtasks: completed,
      totalSubtasks: total,
      progressPercentage: progress,
      scheduleStatus: calculatedRisk >= 65 ? 'rescue' as const : (calculatedRisk >= 45 ? 'at_risk' as const : scheduleMode),
      riskScore: calculatedRisk,
    };
  };

  const updateTaskStateLocal = (updatedSubtasks: Subtask[]) => {
    const metrics = calculateTaskMetrics(updatedSubtasks);
    const isNowDone = metrics.progressPercentage === 100;
    const wasPreviouslyDone = task.progressPercentage === 100;
    const nextStatus = isNowDone ? ('completed' as const) : (metrics.scheduleStatus === 'rescue' ? ('rescued' as const) : taskStatus);
    
    if (isNowDone && !wasPreviouslyDone) {
      const elapsedMs = Date.now() - new Date(task.createdAt || Date.now()).getTime();
      const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
      const elapsedMins = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
      const timeSpentString = `${elapsedHours > 0 ? `${elapsedHours}h ` : ''}${elapsedMins}m`;

      const totalDuration = new Date(task.deadline).getTime() - new Date(task.createdAt || Date.now()).getTime();
      const timeLeft = new Date(task.deadline).getTime() - Date.now();
      const efficiency = timeLeft > 0 
        ? Math.min(100, Math.max(60, Math.round((timeLeft / Math.max(1, totalDuration)) * 100)))
        : 50;

      const riskAvoided = task.riskScore || 68;
      const streakUpdated = (profile?.streak || 0) + 1;

      const stats = {
        totalTimeSpent: timeSpentString,
        completionEfficiency: efficiency,
        riskAvoided,
        streakUpdated
      };

      setCompletionStats(stats);
      setShowCongratsModal(true);

      try {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (err) {
        console.error("Confetti failed to explode:", err);
      }

      if (user) {
        addDoc(collection(db, 'completion_logs'), {
          userId: user.uid,
          taskId: task.id,
          taskName: task.task,
          completedAt: new Date().toISOString(),
          ...stats
        }).then(() => {
          console.log("Logged completion successfully.");
        }).catch(err => {
          console.error("Failed to write completion log:", err);
        });
      }
    }
    
    const updated = {
      ...task,
      ...metrics,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    
    setTask(updated);
    setTaskStatus(nextStatus);
    setManualTotalInput(updated.totalSubtasks.toString());
    setManualCompletedInput(updated.completedSubtasks.toString());
    return updated;
  };

  const saveTaskStateBackground = async (updatedTask: Task, subtaskId?: string, wasCompleted?: boolean) => {
    setSavingInBg(true);
    const { subtasks, completedSubtasks, totalSubtasks, progressPercentage, scheduleStatus, riskScore, status } = updatedTask;
    const updatedData = {
      subtasks,
      completedSubtasks,
      totalSubtasks,
      progressPercentage,
      scheduleStatus,
      riskScore,
      status,
      updatedAt: new Date().toISOString(),
    };

    try {
      const taskRef = doc(db, 'tasks', updatedTask.id);
      await updateDoc(taskRef, updatedData);

      if (user && subtaskId) {
        await logProgress(user.uid, updatedTask.id, subtaskId, progressPercentage, `Subtask state modified.`);
        await logActivity(user.uid, 'complete_subtask', `Toggled step in goal "${updatedTask.task}"`);
      }

      const diff = new Date(updatedTask.deadline).getTime() - Date.now();
      const hoursRemaining = diff / (1000 * 60 * 60);
      const timeElapsed = Date.now() - new Date(updatedTask.createdAt || Date.now()).getTime();
      const totalTime = new Date(updatedTask.deadline).getTime() - new Date(updatedTask.createdAt || Date.now()).getTime();
      const expectedProgress = totalTime > 0 ? Math.min(100, Math.max(0, (timeElapsed / totalTime) * 100)) : 50;
      const progressLag = Math.max(0, expectedProgress - progressPercentage);
      const urgency = hoursRemaining <= 0 ? 100 : Math.max(0, 50 - hoursRemaining * 2);
      const inactivityWeight = updatedTask.inactivityWeight || 10;

      if (user) {
        await logRisk(user.uid, updatedTask.id, riskScore || 0, Math.round(progressLag), Math.round(urgency), inactivityWeight);
      }

      // Auto Rescue Trigger
      if (riskScore !== undefined && riskScore >= 65 && task.scheduleStatus !== 'rescue') {
        await handleAutoTriggerRescue(updatedTask);
      } else if (wasCompleted === false) {
        // Auto simulation projection
        await handleAutoSimulate(subtasks, updatedTask);
      }
    } catch (err) {
      console.error("Background save failed:", err);
    } finally {
      setSavingInBg(false);
    }
  };

  // Manual subtask overrides - continuously track and update risk
  const handleManualSubtaskCountChange = async (totalCountStr: string, completedCountStr: string) => {
    let newTotal = parseInt(totalCountStr);
    if (isNaN(newTotal) || newTotal < 1) newTotal = task.subtasks.length;
    let newCompleted = parseInt(completedCountStr);
    if (isNaN(newCompleted) || newCompleted < 0) newCompleted = 0;
    newCompleted = Math.min(newTotal, newCompleted);

    const currentSubtasks = [...task.subtasks];
    const updatedSubtasks: Subtask[] = [];

    for (let i = 0; i < newTotal; i++) {
      if (i < currentSubtasks.length) {
        updatedSubtasks.push({
          ...currentSubtasks[i],
          completed: i < newCompleted,
          order: i + 1,
        });
      } else {
        updatedSubtasks.push({
          id: `subtask_manual_${Date.now()}_${i}`,
          title: `Milestone Task ${i + 1}`,
          priority: 'medium',
          estimatedMinutes: 30,
          completed: i < newCompleted,
          order: i + 1,
        });
      }
    }

    const updatedTask = updateTaskStateLocal(updatedSubtasks);
    await saveTaskStateBackground(updatedTask);
  };

  // Task Status manual controls
  const handleUpdateStatus = async (newStatus: 'pending' | 'active' | 'paused' | 'completed' | 'delayed' | 'rescued') => {
    setTaskStatus(newStatus);
    const updated = {
      ...task,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };
    setTask(updated);

    try {
      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      if (user) {
        await logActivity(user.uid, 'task_status_change', `Task "${task.task}" status manually updated to ${newStatus}`);
      }
    } catch (err) {
      console.error("Failed to update status in DB:", err);
    }
  };

  // Upgraded Future Self Behavioral Engine
  const triggerBehavioralEngine = async (
    triggerType: 'subtask_completed' | 'inactivity' | 'risk_increased' | 'behind_pace' | 'deadline_near',
    updatedTask: Task = task,
    currentSubtasks: Subtask[] = task.subtasks
  ) => {
    setSimulating(true);

    let inactivityMinutes = 0;
    if (triggerType === 'inactivity') {
      const currentWeight = updatedTask.inactivityWeight || 10;
      inactivityMinutes = currentWeight;
    }

    try {
      const response = await fetch('/api/planning/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: updatedTask.task,
          deadline: updatedTask.deadline,
          subtasks: currentSubtasks,
          completedCount: updatedTask.completedSubtasks,
          riskScore: updatedTask.riskScore,
          inactivityMinutes,
          triggerType,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSimulationResult({
          paceAnalysis: data.paceAnalysis,
          completionRisk: data.completionRisk,
          hoursDifference: data.hoursDifference,
          tomorrowSelfTasks: data.predictions || [],
          recommendation: data.recommendation,
          futureProjection: data.futureProjection,
          immediateAction: data.immediateAction,
        });

        // Save to Task in Firestore
        const taskRef = doc(db, 'tasks', updatedTask.id);
        const updatedData = {
          futurePrediction: data.paceAnalysis,
          futureProjection: data.futureProjection || data.paceAnalysis,
          immediateAction: data.immediateAction || data.recommendation,
          updatedAt: new Date().toISOString()
        };
        await updateDoc(taskRef, updatedData);

        // Update local state
        setTask(prev => ({
          ...prev,
          ...updatedData
        }));

        // Set feedback and trigger overlay/banner
        const combinedFeedback = `🔮 FUTURE PROJECTION:\n"${data.futureProjection || data.paceAnalysis}"\n\n⚡ WHAT YOU SHOULD DO RIGHT NOW:\n"${data.immediateAction || data.recommendation}"`;
        setFutureSelfFeedback(combinedFeedback);
        setShowFeedbackModal(true);

        if (user) {
          // Log to Firestore collection `future_behavior_logs`
          await logFutureBehavior(
            user.uid,
            triggerType,
            updatedTask.riskScore || 0,
            inactivityMinutes,
            data.futureProjection || data.paceAnalysis || '',
            data.immediateAction || data.recommendation || ''
          );
        }
      }
    } catch (err) {
      console.error("Behavioral Engine execution failed:", err);
    } finally {
      setSimulating(false);
    }
  };

  // Trigger Future Self Simulator automatically on subtask completion
  const handleAutoSimulate = async (currentSubtasks: Subtask[], currentTask: Task) => {
    // Check if progress is behind expected pace
    const diff = new Date(currentTask.deadline).getTime() - Date.now();
    const hoursRemaining = diff / (1000 * 60 * 60);
    const timeElapsed = Date.now() - new Date(currentTask.createdAt || Date.now()).getTime();
    const totalTime = new Date(currentTask.deadline).getTime() - new Date(currentTask.createdAt || Date.now()).getTime();
    const expectedProgress = totalTime > 0 ? Math.min(100, Math.max(0, (timeElapsed / totalTime) * 100)) : 50;
    const progressLag = Math.max(0, expectedProgress - currentTask.progressPercentage);

    let trigger: 'subtask_completed' | 'behind_pace' | 'deadline_near' | 'risk_increased' = 'subtask_completed';
    
    if (hoursRemaining < 3 && currentTask.progressPercentage < 90) {
      trigger = 'deadline_near';
    } else if (progressLag > 15) {
      trigger = 'behind_pace';
    } else if (currentTask.riskScore && currentTask.riskScore > (task.riskScore || 0)) {
      trigger = 'risk_increased';
    }

    await triggerBehavioralEngine(trigger, currentTask, currentSubtasks);
  };

  // Triggered after idle state
  const handleTriggerInactivityConsequence = async () => {
    const currentWeight = task.inactivityWeight || 10;
    const newWeight = Math.min(60, currentWeight + 15);
    
    // Dynamically calculate risk and penalty
    const metrics = calculateTaskMetrics(task.subtasks);
    metrics.riskScore = Math.min(100, metrics.riskScore + 15);

    const updatedTask = {
      ...task,
      inactivityWeight: newWeight,
      riskScore: metrics.riskScore,
    };

    setTask(updatedTask);

    try {
      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, {
        inactivityWeight: newWeight,
        riskScore: metrics.riskScore,
        updatedAt: new Date().toISOString()
      });

      if (user) {
        await logRisk(user.uid, task.id, metrics.riskScore, 20, 40, newWeight);
        await logActivity(user.uid, 'procrastination_alert', `Inactivity consequence flagged for task: ${task.task}`);
      }

      // Execute Behavioral Engine for Inactivity Trigger
      await triggerBehavioralEngine('inactivity', updatedTask, task.subtasks);

      // Trigger rescue automatically if risk crosses 65%
      if (metrics.riskScore >= 65 && task.scheduleStatus !== 'rescue') {
        await handleAutoTriggerRescue(updatedTask);
      }
    } catch (err) {
      console.error("Inactivity warning generation failed:", err);
    }
  };

  // Automatic Rescue Mode Activation - streamlined & auto-scheduled around Google Calendar busy times
  const handleAutoTriggerRescue = async (currentTask: Task) => {
    setRescuing(true);
    setShowRescueAlert(true);
    try {
      const response = await fetch('/api/planning/rescue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: currentTask.task,
          deadline: currentTask.deadline,
          subtasks: currentTask.subtasks,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (user) {
          await logRescueActivation(
            user.uid,
            currentTask.id,
            currentTask.scheduleStatus,
            data.survivalRate || 50,
            `Automated Triage: Risk Score reached danger threshold.`
          );
        }

        // AUTO-RESCHEDULE: run scheduler in background to avoid collisions
        let scheduledSubtasks = data.essentialSubtasks;
        try {
          const scheduleResponse = await fetch('/api/calendar/schedule-tasks', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              subtasks: data.essentialSubtasks,
              busySlots: [],
              startDate: new Date().toISOString(),
              deadline: currentTask.deadline,
            }),
          });
          if (scheduleResponse.ok) {
            const schedData = await scheduleResponse.json();
            scheduledSubtasks = schedData.scheduledSubtasks || data.essentialSubtasks;
          }
        } catch (schedErr) {
          console.error("Auto reschedule during automated rescue failed:", schedErr);
        }

        const updatedData = {
          subtasks: scheduledSubtasks,
          totalSubtasks: scheduledSubtasks.length,
          completedSubtasks: 0,
          progressPercentage: 0,
          scheduleStatus: 'rescue' as const,
          status: 'rescued' as const,
          generatedPlan: `### 🚨 EMERGENCY SURVIVAL ROADMAP\n\n${data.compressedPlan}`,
          rescuePlan: data.compressedPlan,
          updatedAt: new Date().toISOString(),
        };

        const taskRef = doc(db, 'tasks', currentTask.id);
        await updateDoc(taskRef, updatedData);

        setTask(prev => ({
          ...prev,
          ...updatedData
        }));
        setTaskStatus('rescued');
        setActiveRescuePlan(data.compressedPlan);
        setNotificationBanner("⚠️ Autostructure Protocol Active: ChronoMind has streamlined your roadmap, removed non-essential tasks, and locked deadlines.");
      }
    } catch (err) {
      console.error("Failed auto rescue activation:", err);
    } finally {
      setRescuing(false);
    }
  };

  // Scheduled Slot Auto-Start check (starts when slot time matches now)
  useEffect(() => {
    if (taskStatus === 'active' || taskStatus === 'completed') return;

    const checkScheduledSlotStart = () => {
      const now = Date.now();
      const currentSlot = task.subtasks.find(sub => {
        if (!sub.assignedTimeSlot) return false;
        const start = new Date(sub.assignedTimeSlot.startTime).getTime();
        const end = new Date(sub.assignedTimeSlot.endTime).getTime();
        return now >= start && now <= end && !sub.completed;
      });

      if (currentSlot) {
        console.log("Scheduled slot start triggered auto-activation:", currentSlot.title);
        setNotificationBanner(`📅 Scheduled Slot Reached: Automatically activating execution tracker for "${currentSlot.title}"!`);
        handleUpdateStatus('active');
      }
    };

    checkScheduledSlotStart();
    const interval = setInterval(checkScheduledSlotStart, 12000);
    return () => clearInterval(interval);
  }, [task.subtasks, taskStatus]);

  // Idle warning ticker hook (ONLY runs when status is 'active')
  useEffect(() => {
    if (taskStatus !== 'active') {
      setIdleSeconds(35);
      return;
    }

    let interval: NodeJS.Timeout;
    interval = setInterval(() => {
      setIdleSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTriggerInactivityConsequence();
          return 35;
        }
        return prev - 1;
      });
    }, 1000);

    const resetIdle = () => {
      setIdleSeconds(35);
    };

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
    };
  }, [taskStatus, task.id]);

  // Toggle single subtask status - OPTIMISTIC & INSTANT
  const handleToggleSubtask = async (subtaskId: string) => {
    const sub = task.subtasks.find(s => s.id === subtaskId);
    if (!sub) return;
    const wasCompleted = sub.completed;

    const updatedSubtasks = task.subtasks.map(s => {
      if (s.id === subtaskId) {
        return { ...s, completed: !s.completed };
      }
      return s;
    });

    // 1. Local update first (Instant feedback!)
    const updatedTask = updateTaskStateLocal(updatedSubtasks);

    // 2. Sync to firestore & run AI projections in the background
    saveTaskStateBackground(updatedTask, subtaskId, wasCompleted);
  };

  // Slider completed tasks count change
  const handleCompletedSliderChange = async (count: number) => {
    const safeCount = Math.max(0, Math.min(task.subtasks.length, count));
    const updatedSubtasks = task.subtasks.map((s, idx) => {
      return { ...s, completed: idx < safeCount };
    });

    const updatedTask = updateTaskStateLocal(updatedSubtasks);
    saveTaskStateBackground(updatedTask);
  };

  // Run manual simulation
  const handleSimulate = async () => {
    await triggerBehavioralEngine('subtask_completed', task, task.subtasks);
  };

  // Run Emergency Deadline Rescue
  const handleActivateRescue = async () => {
    if (!confirm('Warning: Triggering Emergency Rescue Mode will compress your roadmap, reduce non-essential subtasks, and overhaul your deadlines. Proceed?')) {
      return;
    }

    setRescuing(true);
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

      if (!response.ok) throw new Error('Rescue protocol failed.');

      const data = await response.json();
      setRescueResult({
        compressedPlan: data.compressedPlan,
        essentialSubtasks: data.essentialSubtasks,
        removedSubtasksCount: data.removedSubtasksCount,
        survivalRate: data.survivalRate,
      });
    } catch (err) {
      console.error(err);
      alert('Failed to initiate emergency rescue logic.');
    } finally {
      setRescuing(false);
    }
  };

  // Apply Compressed Rescue Plan to Current Task with Google Calendar auto-reschedule integration
  const handleApplyRescuePlan = async () => {
    if (!rescueResult) return;
    setLoadingUpdate(true);

    // AUTO-RESCHEDULE: Run scheduling for these essential subtasks in the background to avoid collisions!
    let scheduledSubtasks = rescueResult.essentialSubtasks;
    try {
      const scheduleResponse = await fetch('/api/calendar/schedule-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subtasks: rescueResult.essentialSubtasks,
          busySlots: [],
          startDate: new Date().toISOString(),
          deadline: task.deadline,
        }),
      });
      if (scheduleResponse.ok) {
        const schedData = await scheduleResponse.json();
        scheduledSubtasks = schedData.scheduledSubtasks || rescueResult.essentialSubtasks;
      }
    } catch (schedErr) {
      console.error("Auto reschedule in manual rescue apply failed:", schedErr);
    }

    const updatedData = {
      subtasks: scheduledSubtasks,
      totalSubtasks: scheduledSubtasks.length,
      completedSubtasks: 0,
      progressPercentage: 0,
      scheduleStatus: 'rescue' as const,
      status: 'rescued' as const,
      generatedPlan: `### 🚨 EMERGENCY SURVIVAL ROADMAP\n\n${rescueResult.compressedPlan}`,
      rescuePlan: rescueResult.compressedPlan,
      updatedAt: new Date().toISOString(),
    };

    const path = `tasks/${task.id}`;
    try {
      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, updatedData);

      // Sync local state
      setTask(prev => ({
        ...prev,
        ...updatedData
      }));
      setTaskStatus('rescued');
      setActiveRescuePlan(rescueResult.compressedPlan);
      setRescueResult(null); // Clear preview block
      alert('Emergency Rescue roadmap has been successfully loaded into execution terminal and auto-rescheduled!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setLoadingUpdate(false);
    }
  };

  // Custom JSX Markdown renderer
  function renderMarkdown(text: string) {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
      const cleanLine = line.trim();
      if (cleanLine.startsWith('###')) {
        return <h4 key={idx} className="text-sm font-bold text-cyan-300 mt-4 mb-1 font-display">{cleanLine.replace('###', '')}</h4>;
      }
      if (cleanLine.startsWith('##')) {
        return <h3 key={idx} className="text-base font-bold text-cyan-400 mt-5 mb-1.5 font-display">{cleanLine.replace('##', '')}</h3>;
      }
      if (cleanLine.startsWith('#')) {
        return <h2 key={idx} className="text-lg font-bold text-white mt-6 mb-2 font-display border-b border-white/5 pb-1">{cleanLine.replace('#', '')}</h2>;
      }
      if (cleanLine.startsWith('-') || cleanLine.startsWith('*')) {
        return <li key={idx} className="text-xs text-slate-300 ml-4 list-disc mt-1">{cleanLine.substring(1).trim()}</li>;
      }
      if (cleanLine === '') {
        return <div key={idx} className="h-2" />;
      }
      
      const boldRegex = /\*\*(.*?)\*\*/g;
      if (boldRegex.test(cleanLine)) {
        const parts = cleanLine.split('**');
        return (
          <p key={idx} className="text-xs text-slate-400 leading-relaxed mt-1">
            {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="text-white font-semibold">{part}</strong> : part)}
          </p>
        );
      }
      return <p key={idx} className="text-xs text-slate-400 leading-relaxed mt-1">{cleanLine}</p>;
    });
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Detail Header navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <button
          onClick={onBack}
          className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-full text-xs font-mono inline-flex items-center gap-2 cursor-pointer transition-all"
        >
          <ArrowLeft className="w-4 h-4 text-cyan-400" />
          BACK TO DASHBOARD
        </button>

        <div className="text-xs font-mono px-3 py-1.5 bg-white/5 rounded-full border border-white/10 text-slate-400 flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          <span>TASK INSTANCE TERMINAL</span>
        </div>
      </div>

      {/* Dynamic Immersive Execution Control Panel */}
      {(() => {
        const getSystemStateLabel = () => {
          if (task.progressPercentage === 100) return 'On Track';
          if (taskStatus === 'rescued' || task.scheduleStatus === 'rescue') return 'Rescued';
          if (task.riskScore !== undefined && task.riskScore >= 65) return 'Critical Risk';
          if (taskStatus === 'active') return 'Active';
          if (taskStatus === 'paused') return 'Pending';
          if (taskStatus === 'delayed' || (task.riskScore !== undefined && task.riskScore >= 45)) return 'Delayed';
          if (taskStatus === 'pending') return 'Pending';
          return 'On Track';
        };

        const getSystemStateColor = (state: string) => {
          switch(state) {
            case 'On Track': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'Rescued': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 animate-pulse';
            case 'Critical Risk': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            case 'Active': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
            case 'Pending': return 'text-slate-400 bg-white/5 border-white/10';
            case 'Delayed': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            default: return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
          }
        };

        const getBarColorClass = (val: number) => {
          if (val < 45) return 'bg-emerald-500';
          if (val < 65) return 'bg-yellow-500';
          return 'bg-rose-500';
        };

        const getTextColorClass = (val: number) => {
          if (val < 45) return 'text-emerald-400';
          if (val < 65) return 'text-yellow-400';
          return 'text-rose-400';
        };

        const getNextRecommendedAction = () => {
          if (task.progressPercentage === 100) return "Timeline completed. Focus on enjoying your cognitive buffer!";
          if (taskStatus === 'active' && idleSeconds < 25) {
            const nextSubIdx = task.subtasks.findIndex(s => !s.completed);
            const subNum = nextSubIdx !== -1 ? nextSubIdx + 1 : 1;
            return `Resume subtask ${subNum} now.`;
          }
          if (task.riskScore && task.riskScore >= 65) {
            return "Deadline pressure increasing. Focus on high-priority subtasks.";
          }
          const nextSub = task.subtasks.find(s => !s.completed);
          if (nextSub) {
            const reduction = Math.round(100 / Math.max(1, task.totalSubtasks));
            return `Complete one more subtask to reduce risk by ${reduction}%.`;
          }
          return "Complete one more subtask to reduce risk.";
        };

        const getFutureProjectionLabel = () => {
          const score = task.riskScore || 0;
          if (score < 45) return 'On Track';
          if (score < 65) return 'Slight Delay Risk';
          return 'High Delay Risk';
        };

        const getFutureProjectionColor = () => {
          const score = task.riskScore || 0;
          if (score < 45) return 'text-emerald-400';
          if (score < 65) return 'text-yellow-400';
          return 'text-rose-400 animate-pulse';
        };

        // Calculations for risk bars
        const progressRisk = Math.round(100 - task.progressPercentage);
        
        const totalDuration = new Date(task.deadline).getTime() - new Date(task.createdAt || Date.now()).getTime();
        const timeRemaining = new Date(task.deadline).getTime() - Date.now();
        const deadlinePressure = task.progressPercentage === 100 ? 0 : (
          timeRemaining <= 0 ? 100 : Math.min(100, Math.max(0, Math.round((1 - (timeRemaining / Math.max(1, totalDuration))) * 100)))
        );

        const inactivityRisk = task.progressPercentage === 100 ? 0 : (
          taskStatus === 'active' 
            ? Math.round(((35 - idleSeconds) / 35) * 100)
            : (task.inactivityWeight ? Math.min(100, Math.round(task.inactivityWeight * 1.6)) : 20)
        );

        const overallRisk = task.riskScore || 0;

        const currentActiveSubtask = task.subtasks.find(s => !s.completed)?.title || "None (All Complete)";
        const systemState = getSystemStateLabel();
        const thresholdText = overallRisk >= 65 
          ? "Breached / Active" 
          : `${65 - overallRisk}% margin remaining`;

        return (
          <div className="glass-panel p-6 border border-cyan-500/30 bg-gradient-to-r from-slate-950 to-cyan-950/10 shadow-[0_0_30px_rgba(6,182,212,0.15)] rounded-2xl relative overflow-hidden space-y-6">
            {savingInBg && (
              <div className="absolute top-4 right-4 text-[9px] font-mono text-cyan-400 flex items-center gap-1.5 bg-cyan-950/40 border border-cyan-500/30 px-2.5 py-1 rounded-full animate-pulse z-10">
                <Loader className="w-3.5 h-3.5 animate-spin" />
                INTELLIGENCE PANEL LIVE SYNCING...
              </div>
            )}

            {/* Glowing neon mesh overlay */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[50px] rounded-full pointer-events-none"></div>

            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-cyan-400 animate-pulse" />
                <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase">
                  AI SYSTEM INTELLIGENCE CONTROL PANEL
                </h2>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>HUD ONLINE</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Module 1: Telemetry HUD */}
              <div className="space-y-4">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider border-b border-white/5 pb-1 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>SYSTEM METRICS TELEMETRY</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase block mb-0.5">CURRENT TASK NAME</span>
                    <p className="text-xs font-display font-medium text-white line-clamp-1">{task.task}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase block mb-0.5">CURRENT ACTIVE SUBTASK</span>
                    <p className="text-xs font-mono text-cyan-400 font-semibold line-clamp-1">{currentActiveSubtask}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase block mb-0.5">CURRENT STATE</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${getSystemStateColor(systemState)}`}>
                        {systemState}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-mono text-slate-500 uppercase block mb-0.5">PROGRESS BUFFER</span>
                      <span className="text-xs font-mono font-bold text-white">
                        {task.completedSubtasks}/{task.totalSubtasks} ({Math.round(task.progressPercentage)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Module 2: Live Risk Analysis & Visual Bars */}
              <div className="space-y-4 md:border-l md:border-white/5 md:pl-6">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider border-b border-white/5 pb-1 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                  <span>LIVE RISK ANALYSIS HUD</span>
                </div>
                <div className="space-y-3">
                  {/* Progress Risk Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-mono">
                      <span className="text-slate-400 uppercase tracking-wider">Progress Risk</span>
                      <span className={`font-bold ${getTextColorClass(progressRisk)}`}>{progressRisk}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${getBarColorClass(progressRisk)} rounded-full transition-all duration-500`} style={{ width: `${progressRisk}%` }} />
                    </div>
                  </div>

                  {/* Deadline Pressure Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-mono">
                      <span className="text-slate-400 uppercase tracking-wider">Deadline Pressure</span>
                      <span className={`font-bold ${getTextColorClass(deadlinePressure)}`}>{deadlinePressure}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${getBarColorClass(deadlinePressure)} rounded-full transition-all duration-500`} style={{ width: `${deadlinePressure}%` }} />
                    </div>
                  </div>

                  {/* Inactivity Risk Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-mono">
                      <span className="text-slate-400 uppercase tracking-wider">Inactivity Risk</span>
                      <span className={`font-bold ${getTextColorClass(inactivityRisk)}`}>{inactivityRisk}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${getBarColorClass(inactivityRisk)} rounded-full transition-all duration-500`} style={{ width: `${inactivityRisk}%` }} />
                    </div>
                  </div>

                  {/* Overall Collapse Risk Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-mono">
                      <span className="text-slate-300 uppercase tracking-wider font-semibold">Overall Collapse Risk</span>
                      <span className={`font-black ${getTextColorClass(overallRisk)}`}>{overallRisk}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div className={`h-full ${getBarColorClass(overallRisk)} rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(239,68,68,0.2)]`} style={{ width: `${overallRisk}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Module 3: Active Focus Engine controls & Smart Planner */}
              <div className="space-y-4 md:border-l md:border-white/5 md:pl-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider border-b border-white/5 pb-1 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>RECOMMENDED ACTION DIRECTIVES</span>
                  </div>
                  
                  {/* Recommended action text box */}
                  <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl">
                    <span className="text-[8px] font-mono text-cyan-400 uppercase tracking-wider block mb-1">DECISION MATRIX SUGGESTION</span>
                    <p className="text-xs text-slate-100 font-medium leading-relaxed">
                      “{getNextRecommendedAction()}”
                    </p>
                  </div>

                  {/* Future Projection and Rescue Threshold status */}
                  <div className="grid grid-cols-2 gap-3.5 pt-1">
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase block mb-0.5">RESCUE THRESHOLD</span>
                      <span className="text-xs font-mono font-bold text-slate-200">
                        {thresholdText}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase block mb-0.5">FUTURE PROJECTION</span>
                      <span className={`text-xs font-mono font-bold ${getFutureProjectionColor()}`}>
                        {getFutureProjectionLabel()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Manual metric calibration */}
                <div className="space-y-3 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">SMART CALIBRATION INPUTS</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">TOTAL SUBTASKS</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={manualTotalInput}
                        onChange={(e) => {
                          setManualTotalInput(e.target.value);
                          handleManualSubtaskCountChange(e.target.value, manualCompletedInput);
                        }}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">COMPLETED</label>
                      <input
                        type="number"
                        min="0"
                        max={manualTotalInput}
                        value={manualCompletedInput}
                        onChange={(e) => {
                          setManualCompletedInput(e.target.value);
                          handleManualSubtaskCountChange(manualTotalInput, e.target.value);
                        }}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Inactivity Live Progress countdown ticker (only when status is active) */}
            {taskStatus === 'active' && (
              <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex items-center gap-3">
                <Flame className="w-4 h-4 text-rose-400 animate-pulse shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-center text-[10px] font-mono text-rose-300">
                    <span>LIVE PROGRESS TRACKER: INTEGRATED COGNITIVE IDLE LOOP</span>
                    <span>Idle Warning: {idleSeconds}s</span>
                  </div>
                  <div className="h-1.5 bg-rose-950 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-rose-500 rounded-full transition-all duration-1000" 
                      style={{ width: `${(idleSeconds / 35) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Task title and metadata details */}
      <div className="glass-panel p-6 sm:p-8 relative overflow-hidden">
        {task.scheduleStatus === 'rescue' && (
          <div className="absolute right-0 top-0 bg-orange-600 text-black font-mono text-[10px] uppercase font-extrabold tracking-wider px-4 py-1.5 rounded-bl-xl border-l border-b border-orange-400 shadow-md animate-pulse">
            🚨 SURVIVAL PROTOCOL ACTIVE
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="space-y-3">
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest border ${
              task.progressPercentage === 100 ? 'bg-green-500/10 text-green-400 border-green-500/20' :
              task.scheduleStatus === 'rescue' ? 'bg-orange-500/20 text-orange-400 border-orange-500/50 animate-pulse' :
              task.scheduleStatus === 'at_risk' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' :
              'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
            }`}>
              {task.scheduleStatus} Mode
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {task.task}
            </h1>
            <p className="text-xs text-slate-400 font-mono flex flex-wrap items-center gap-2">
              <span>DEADLINE:</span>
              <span className="text-cyan-400 font-semibold">{new Date(task.deadline).toLocaleString()}</span>
              <span>•</span>
              <span className={`font-semibold ${task.scheduleStatus === 'rescue' ? 'text-orange-400' : 'text-cyan-400'}`}>{timeRemainingText}</span>
            </p>
          </div>

          {/* Progress gauge */}
          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 min-w-[200px]">
            <div className="w-12 h-12 rounded-full border-2 border-white/10 flex items-center justify-center relative shrink-0">
              <span className="text-xs font-bold text-cyan-400 font-mono">{task.progressPercentage}%</span>
            </div>
            <div>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Completion</p>
              <h3 className="text-sm font-semibold text-white mt-0.5">
                {task.completedSubtasks} of {task.totalSubtasks} steps
              </h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Subtasks and Roadmap */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Subtasks Checklist section */}
          <div className="glass-panel p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-cyan-400" />
                <h2 className="font-display font-semibold text-lg text-white">Execution Subtasks</h2>
              </div>

              {/* Slider for adaptivity completed tasks count */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-500 font-mono shrink-0 uppercase tracking-wider">BATCH LOG:</label>
                <div className="flex items-center bg-white/5 px-2.5 py-1 rounded-full border border-white/10 gap-2">
                  <button 
                    disabled={task.completedSubtasks <= 0}
                    onClick={() => handleCompletedSliderChange(task.completedSubtasks - 1)}
                    className="text-xs text-slate-400 hover:text-white px-1.5 font-bold disabled:opacity-30 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-xs font-mono font-bold text-cyan-400 min-w-[20px] text-center">
                    {task.completedSubtasks}
                  </span>
                  <button 
                    disabled={task.completedSubtasks >= task.subtasks.length}
                    onClick={() => handleCompletedSliderChange(task.completedSubtasks + 1)}
                    className="text-xs text-slate-400 hover:text-white px-1.5 font-bold disabled:opacity-30 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {loadingUpdate && (
              <div className="p-2 text-center text-xs text-cyan-400 font-mono mb-4 flex items-center justify-center gap-1.5 animate-pulse">
                <Loader className="w-3.5 h-3.5 animate-spin" />
                Recalculating timeline pacing and priority weights...
              </div>
            )}

            {/* Checklist */}
            <div className="space-y-3">
              {task.subtasks.map((sub, idx) => (
                <div
                  key={sub.id}
                  onClick={() => handleToggleSubtask(sub.id)}
                  className={`p-4 rounded-xl border flex items-center justify-between gap-4 cursor-pointer transition-all ${
                    sub.completed 
                      ? 'bg-green-500/5 border-green-500/20 opacity-60' 
                      : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    {sub.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded border border-white/30 shrink-0" />
                    )}
                    <div>
                      <span className={`text-sm text-slate-300 font-medium ${sub.completed ? 'line-through text-slate-500' : ''}`}>
                        {sub.title}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Priority Tag */}
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono shrink-0 uppercase tracking-wider border ${
                      sub.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                      sub.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                      'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                    }`}>
                      {sub.priority}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">{sub.estimatedMinutes} min</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Decomposed Roadmap Card */}
          <div className="glass-panel p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/5">
              <Compass className="w-5 h-5 text-cyan-400" />
              <h2 className="font-display font-semibold text-lg text-white">ChronoMind Strategy Roadmap</h2>
            </div>
            <div className="space-y-1 overflow-y-auto max-h-[350px] pr-2">
              {renderMarkdown(task.generatedPlan)}
            </div>
          </div>
        </div>

        {/* Right Side: Simulator and Rescue Controls */}
        <div className="lg:col-span-5 space-y-6">

          {/* Action Module 1: Future Self Behavioral Engine */}
          <div className="glass-panel p-6 sm:p-8 flex flex-col justify-between border-cyan-500/10 relative overflow-hidden bg-gradient-to-br from-slate-950 via-cyan-950/10 to-indigo-950/10 shadow-[0_0_20px_rgba(6,182,212,0.05)] rounded-2xl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-[30px] rounded-full"></div>
            <div className="relative space-y-5">
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-cyan-400 animate-pulse" />
                  <h3 className="font-display font-bold text-base text-white tracking-tight">Future Self Behavioral Engine</h3>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-mono text-cyan-400">
                  <Activity className="w-3 h-3 animate-pulse" />
                  <span>INTELLIGENCE RUNNING</span>
                </div>
              </div>

              {/* Real-time Context-aware Action layer */}
              <div className="p-4 bg-cyan-950/10 border border-cyan-500/20 rounded-xl space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1 bg-cyan-500/10 text-[8px] font-mono text-cyan-400 rounded-bl tracking-widest uppercase">
                  Action Guidance
                </div>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">What should I do right now?</p>
                <h4 className="text-sm font-semibold text-white leading-snug font-sans">
                  {task.immediateAction || simulationResult?.immediateAction || "Resume execution immediately by ticking off your first subtask."}
                </h4>
              </div>

              {/* Future Projection consequence layer */}
              <div className="p-4 bg-indigo-950/10 border border-indigo-500/20 rounded-xl space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1 bg-indigo-500/10 text-[8px] font-mono text-indigo-400 rounded-bl tracking-widest uppercase">
                  Simulation Projection
                </div>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Future Consequence Projection</p>
                <p className="text-xs text-slate-300 leading-relaxed font-light">
                  {task.futureProjection || simulationResult?.futureProjection || task.futurePrediction || "No future prediction forecasted yet. Perform a behavioral simulation run."}
                </p>
              </div>

              {/* Smart Metrics status */}
              <div className="grid grid-cols-2 gap-3.5 pt-1.5 font-mono">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest block mb-0.5">Risk Level</span>
                  <div className="flex items-center justify-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${
                      (task.riskScore || 0) >= 65 ? 'bg-rose-500 animate-ping' :
                      (task.riskScore || 0) >= 45 ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                    <span className={`text-xs font-bold ${
                      (task.riskScore || 0) >= 65 ? 'text-rose-400' :
                      (task.riskScore || 0) >= 45 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {task.riskScore || 0}%
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest block mb-0.5">Idle Weight</span>
                  <span className="text-xs font-bold text-cyan-400">
                    {task.inactivityWeight || 10} pts
                  </span>
                </div>
              </div>

              {/* Intelligent Passive Telemetry Indicator */}
              <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl flex items-center justify-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">
                  Passive Behavioral Telemetry Synced
                </span>
              </div>
            </div>
          </div>

          {/* Google Calendar Timeline Module */}
          <TimelineView task={task} onTaskUpdated={setTask} />



          {/* Action Module 2: Rescue Mode */}
          <div className="glass-panel p-6 sm:p-8 flex flex-col justify-between border-orange-500/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 blur-[30px] rounded-full"></div>
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="w-4 h-4 text-orange-400" />
                <h3 className="font-display font-semibold text-base text-white">Emergency Rescue Mode</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-6 font-light">
                Are you drastically falling behind? Activate Emergency Rescue Mode. ChronoMind will immediately delete secondary tasks, shrink core times, and establish a high-efficiency survival track.
              </p>

              {/* Rescue Preview Output */}
              {rescueResult ? (
                <div className="p-4 bg-orange-950/10 border border-orange-500/30 rounded-xl space-y-4 mb-6">
                  <div className="flex justify-between items-center pb-2 border-b border-orange-900/20">
                    <span className="text-[10px] font-mono text-orange-400 uppercase tracking-widest">Triage Analysis</span>
                    <span className="text-xs font-bold text-orange-400 font-mono uppercase">
                      SURVIVAL RATE: {rescueResult.survivalRate}%
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 leading-relaxed font-mono">
                    <p>• {rescueResult.removedSubtasksCount} secondary task details omitted to save time.</p>
                    <p>• Remaining critical tasks compressed to core minimums.</p>
                  </div>

                  <div className="p-3 bg-black/60 rounded border border-orange-500/20 overflow-y-auto max-h-[150px] space-y-1">
                    <p className="text-[10px] font-mono text-orange-400 uppercase font-semibold mb-1">PROPOSED EMERGENCY STEPS</p>
                    {renderMarkdown(rescueResult.compressedPlan)}
                  </div>

                  <button
                    onClick={handleApplyRescuePlan}
                    className="w-full py-2 bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs font-extrabold rounded-lg transition-all cursor-pointer shadow-md"
                  >
                    APPLY RESCUE ROADMAP
                  </button>
                </div>
              ) : activeRescuePlan ? (
                <div className="p-4 bg-orange-950/5 border border-orange-500/20 rounded-xl space-y-2 mb-6">
                  <div className="flex justify-between items-center pb-1.5 border-b border-orange-900/20">
                    <span className="text-[10px] font-mono text-orange-400 uppercase font-semibold tracking-wider">Survival Plan In Effect</span>
                    <span className="text-[9px] font-mono text-slate-500">ACTIVE</span>
                  </div>
                  <div className="overflow-y-auto max-h-[140px] pr-1">
                    {renderMarkdown(activeRescuePlan)}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Live Triage Status Info Card */}
            <div className="mt-4 p-3.5 bg-orange-950/20 border border-orange-500/20 rounded-xl flex items-center gap-3">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              <p className="text-[11px] font-mono text-orange-400 leading-normal uppercase">
                {activeRescuePlan 
                  ? "EMERGENCY SURVIVAL PLAN IN EFFECT" 
                  : "Adaptive Triage Standby: Auto-activates on extreme deadline pressure"}
              </p>
            </div>
          </div>
        </div>
      </div>



      {/* 🚨 Automated Rescue Protocol Engagement Alert */}
      {showRescueAlert && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d0907] border border-orange-500/40 rounded-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-[0_0_40px_rgba(249,115,22,0.2)] text-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-rose-600"></div>
            
            <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-2 text-orange-500 animate-pulse">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-mono text-orange-400 uppercase tracking-widest font-extrabold animate-pulse">
                CRITICAL DRIFT: EMERGENCY TRIAGE ENGAGED
              </p>
              <h3 className="font-display font-extrabold text-xl text-white">
                Autostructure Protocol Active
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              ChronoMind has detected a high priority deadline risk ({task.riskScore}% danger threshold breached). 
              Optional subtask details have been pruned and schedule parameters have been auto-compressed.
            </p>

            <button
              onClick={() => setShowRescueAlert(false)}
              className="w-full py-3 bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 text-white font-bold uppercase tracking-widest text-xs rounded-xl transition-all shadow-md cursor-pointer"
            >
              ACCEPT ENHANCED PLAN
            </button>
          </div>
        </div>
      )}

      {/* 🎉 Subtask Completion Congratulations Popup */}
      {showCongratsModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-gradient-to-br from-slate-950 via-emerald-950/20 to-slate-950 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-[0_0_80px_rgba(16,185,129,0.35)] text-center animate-in fade-in zoom-in duration-300">
            {/* Glowing top line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-green-400"></div>
            
            {/* Pulsing glow background */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/10 blur-[40px] rounded-full animate-pulse"></div>
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-teal-500/10 blur-[40px] rounded-full animate-pulse"></div>

            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-teal-500/5 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)] animate-bounce">
              <Trophy className="w-10 h-10 text-emerald-400" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-[0.25em] font-extrabold animate-pulse block">
                SYSTEM CALIBRATION CLEARED
              </span>
              <h3 className="font-display font-black text-3xl text-white tracking-tight uppercase">
                MISSION COMPLETED
              </h3>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-sm mx-auto font-light">
              "Congratulations. All execution milestones have been successfully completed."
            </p>

            {/* Performance Statistics Grid */}
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-0.5">Total Time Spent</span>
                <span className="text-sm font-bold text-emerald-400">
                  {completionStats?.totalTimeSpent || "N/A"}
                </span>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-0.5">Completion Efficiency</span>
                <span className="text-sm font-bold text-cyan-400">
                  {completionStats?.completionEfficiency || 100}%
                </span>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-0.5">Risk Avoided</span>
                <span className="text-sm font-bold text-amber-400">
                  {completionStats?.riskAvoided || 100}%
                </span>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-0.5">Productivity Streak</span>
                <span className="text-sm font-bold text-teal-400 flex items-center justify-center gap-1">
                  <Flame className="w-3.5 h-3.5 fill-teal-400" />
                  {completionStats?.streakUpdated || 1} days
                </span>
              </div>
            </div>

            {/* Future Self Message Card */}
            <div className="p-4 bg-emerald-950/10 border border-emerald-500/20 rounded-xl space-y-1.5 text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 text-emerald-500/30">
                <Brain className="w-12 h-12 rotate-12" />
              </div>
              <p className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest font-semibold">FUTURE-SELF SIGNAL</p>
              <p className="text-xs text-slate-200 leading-relaxed italic relative z-10 font-light">
                “Future-you is now ahead of schedule and under less stress.”
              </p>
            </div>

            {/* Modal Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={onBack}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white font-mono font-bold uppercase tracking-wider text-xs rounded-xl transition-all cursor-pointer"
              >
                RETURN TO DASHBOARD
              </button>
              <button
                onClick={() => setShowCongratsModal(false)}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-mono font-bold uppercase tracking-wider text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.35)] cursor-pointer"
              >
                START NEXT TASK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Dynamic context-aware reminder nudge */}
      {activeReminder && (
        <div 
          className={`fixed bottom-6 right-6 z-40 max-w-xs sm:max-w-md w-full bg-slate-950/95 backdrop-blur-md border border-cyan-500/30 rounded-xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.6)] flex items-start gap-3 transition-all duration-300 ${
            isExitingReminder 
              ? 'opacity-0 translate-y-4 scale-95 pointer-events-none' 
              : 'opacity-100 translate-y-0 scale-100 animate-in slide-in-from-bottom duration-300'
          }`}
        >
          <div className="p-2 bg-cyan-950/50 border border-cyan-500/20 rounded-lg text-cyan-400 shrink-0">
            {activeReminder.type === 'inactivity' && <Flame className="w-5 h-5 text-rose-400 animate-pulse" />}
            {activeReminder.type === 'rescue_near' && <ShieldAlert className="w-5 h-5 text-amber-400 animate-pulse" />}
            {activeReminder.type === 'deadline' && <AlertCircle className="w-5 h-5 text-rose-500 animate-ping" />}
            {activeReminder.type === 'behind' && <AlertTriangle className="w-5 h-5 text-yellow-400" />}
            {activeReminder.type === 'progressing' && <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest font-extrabold flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
                </span>
                COACH NUDGE: {activeReminder.type.replace('_', ' ')}
              </span>
              <button 
                onClick={dismissReminderSmoothly} 
                className="text-[10px] text-slate-500 hover:text-white font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              {activeReminder.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
