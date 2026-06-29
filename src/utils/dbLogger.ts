/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export const logProgress = async (userId: string, taskId: string, subtaskId: string, progressPercentage: number, notes?: string) => {
  try {
    await addDoc(collection(db, 'progress_logs'), {
      userId,
      taskId,
      subtaskId,
      progressPercentage,
      notes: notes || '',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to log progress:", err);
  }
};

export const logRisk = async (userId: string, taskId: string, riskScore: number, progressLag: number, deadlineUrgency: number, inactivityWeight: number) => {
  try {
    await addDoc(collection(db, 'risk_logs'), {
      userId,
      taskId,
      riskScore,
      progressLag,
      deadlineUrgency,
      inactivityWeight,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to log risk:", err);
  }
};

export const logFutureSimulation = async (userId: string, taskId: string, paceAnalysis: string, completionRisk: string, hoursDifference: number) => {
  try {
    await addDoc(collection(db, 'future_simulations'), {
      userId,
      taskId,
      paceAnalysis,
      completionRisk,
      hoursDifference,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to log future simulation:", err);
  }
};

export const logRescueActivation = async (userId: string, taskId: string, previousStatus: string, survivalRate: number, details?: string) => {
  try {
    await addDoc(collection(db, 'rescue_activations'), {
      userId,
      taskId,
      previousStatus,
      survivalRate,
      details: details || '',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to log rescue activation:", err);
  }
};

export const logActivity = async (userId: string, action: string, details: string) => {
  try {
    await addDoc(collection(db, 'activity_logs'), {
      userId,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};

export const logCalendarEvent = async (userId: string, taskId: string, subtaskId: string, eventId: string, summary: string, startTime: string, endTime: string) => {
  try {
    await addDoc(collection(db, 'calendar_events'), {
      userId,
      taskId,
      subtaskId,
      eventId,
      summary,
      startTime,
      endTime,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to log calendar event:", err);
  }
};

export const logAvailabilitySlots = async (userId: string, busyCount: number, timeMin: string, timeMax: string) => {
  try {
    await addDoc(collection(db, 'availability_slots'), {
      userId,
      busyCount,
      timeMin,
      timeMax,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to log availability slots:", err);
  }
};

export const logScheduleAction = async (userId: string, taskId: string, action: 'smart_scheduled' | 'rescheduled' | 'adapted', details: string) => {
  try {
    await addDoc(collection(db, 'schedule_logs'), {
      userId,
      taskId,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to log schedule action:", err);
  }
};

export const logFutureBehavior = async (
  userId: string,
  trigger_type: 'subtask_completed' | 'inactivity' | 'risk_increased' | 'behind_pace' | 'deadline_near',
  risk_score: number,
  inactivity_time: number,
  message: string,
  suggested_action: string
) => {
  try {
    await addDoc(collection(db, 'future_behavior_logs'), {
      userId,
      trigger_type,
      risk_score,
      inactivity_time,
      message,
      suggested_action,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to log future behavior:", err);
  }
};
