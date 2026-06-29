/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  createdAt: string;
  streak?: number;
  longestStreak?: number;
  consistencyScore?: number;
}

export interface Subtask {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  completed: boolean;
  notes?: string;
  order: number;
  assignedTimeSlot?: { startTime: string; endTime: string };
  calendarSyncStatus?: 'synced' | 'pending' | 'failed' | 'none';
  calendarEventId?: string;
}

export interface Task {
  id: string; // Firestore document ID
  userId: string;
  task: string;
  deadline: string; // ISO date-time string
  subtasks: Subtask[];
  generatedPlan: string; // Markdown formatted roadmap text
  totalSubtasks: number;
  completedSubtasks: number;
  progressPercentage: number;
  scheduleStatus: 'normal' | 'rescue' | 'at_risk';
  futurePrediction?: string;
  futureProjection?: string;
  immediateAction?: string;
  rescuePlan?: string;
  createdAt: string;
  updatedAt: string;
  isImpossible?: boolean;
  impossibleReason?: string;
  riskScore?: number;
  totalSubtasksInput?: number;
  completedSubtasksInput?: number;
  inactivityWeight?: number;
  calendarEventsSynced?: boolean;
  status?: 'pending' | 'active' | 'paused' | 'completed' | 'delayed' | 'rescued';
}

export interface SimulationResult {
  paceAnalysis: string;
  completionRisk: 'high' | 'medium' | 'low';
  hoursDifference: number; // Positive if delayed, negative if ahead
  tomorrowSelfTasks: string[];
  recommendation: string;
  futureProjection?: string;
  immediateAction?: string;
}

export interface RescueResult {
  compressedPlan: string;
  essentialSubtasks: Subtask[];
  removedSubtasksCount: number;
  survivalRate: number; // percentage
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  type: 'long-term' | 'weekly' | 'daily';
  targetDate: string;
  completed: boolean;
  createdAt: string;
}

export interface HabitLog {
  id: string;
  userId: string;
  habitName: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  timestamp: string;
}

export interface FutureBehaviorLog {
  id: string;
  userId: string;
  trigger_type: 'subtask_completed' | 'inactivity' | 'risk_increased' | 'behind_pace' | 'deadline_near';
  risk_score: number;
  inactivity_time: number; // minutes
  message: string;
  suggested_action: string;
  timestamp: string;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  taskId: string;
  subtaskId: string;
  title: string;
  startTime: string;
  endTime: string;
  calendarEventId?: string;
  syncedAt: string;
}
