/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Task, Subtask } from '../types';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  Calendar, Check, RefreshCw, Loader, AlertTriangle, 
  Clock, CalendarCheck, HelpCircle, Activity, Sparkles, ExternalLink, ShieldAlert
} from 'lucide-react';
import { 
  logAvailabilitySlots, 
  logScheduleAction, 
  logCalendarEvent, 
  logActivity 
} from '../utils/dbLogger';

interface TimelineViewProps {
  task: Task;
  onTaskUpdated: (updatedTask: Task) => void;
}

interface BusySlot {
  id: string;
  title: string;
  start: string;
  end: string;
}

export default function TimelineView({ task, onTaskUpdated }: TimelineViewProps) {
  const { user, googleAccessToken, connectGoogleCalendar, isCalendarDemoMode, enableCalendarDemoMode } = useAuth();
  
  const [connecting, setConnecting] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [busySlots, setBusySlots] = useState<BusySlot[]>([]);
  const [scheduling, setScheduling] = useState(false);
  const [syncingToGoogle, setSyncingToGoogle] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [reminders, setReminders] = useState<string[]>([]);
  const [showAuthInstructions, setShowAuthInstructions] = useState(false);

  // Fetch Busy Slots for Today & Next 7 Days from Google Calendar via server proxy
  const fetchBusySlots = async () => {
    if (!googleAccessToken) return;
    setLoadingCalendar(true);
    setNotification(null);
    try {
      const timeMin = new Date();
      timeMin.setHours(0, 0, 0, 0); // Start of today
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 7); // Next 7 days
      
      const response = await fetch('/api/calendar/busy-slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: googleAccessToken,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve busy slots from proxy.');
      }

      const data = await response.json();
      setBusySlots(data.busySlots || []);
      
      // Log Availability slots fetch in database
      if (user) {
        await logAvailabilitySlots(
          user.uid, 
          data.busySlots?.length || 0, 
          timeMin.toISOString(), 
          timeMax.toISOString()
        );
        await logActivity(user.uid, 'fetch_slots', `Retrieved ${data.busySlots?.length || 0} occupied slots.`);
      }
    } catch (err: any) {
      console.error(err);
      setNotification('Failed to synchronize with your Google Calendar events.');
    } finally {
      setLoadingCalendar(false);
    }
  };

  useEffect(() => {
    if (googleAccessToken) {
      fetchBusySlots();
    }
  }, [googleAccessToken]);

  // Connect Google Calendar
  const handleConnectCalendar = async () => {
    setConnecting(true);
    setNotification(null);
    try {
      await connectGoogleCalendar();
      setNotification('Connected to Google Calendar successfully! (Sandbox/Simulated mode active if popup was blocked)');
    } catch (err: any) {
      console.error("Connect Calendar error:", err);
      setNotification('Calendar connection rejected or cancelled.');
    } finally {
      setConnecting(false);
    }
  };

  // Run Smart Slot Scheduling Algorithm on Server
  const handleSmartSchedule = async () => {
    if (task.subtasks.length === 0) {
      setNotification('This task has no subtasks to schedule.');
      return;
    }
    setScheduling(true);
    setNotification(null);

    try {
      const response = await fetch('/api/calendar/schedule-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subtasks: task.subtasks,
          busySlots: busySlots,
          startDate: new Date().toISOString(),
          deadline: task.deadline,
        }),
      });

      if (!response.ok) {
        throw new Error('Scheduler algorithm execution failed.');
      }

      const data = await response.json();
      const updatedSubtasks = data.scheduledSubtasks || [];

      // Update Task in Firestore
      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, {
        subtasks: updatedSubtasks,
        updatedAt: new Date().toISOString(),
      });

      // Update Parent State
      onTaskUpdated({
        ...task,
        subtasks: updatedSubtasks,
        updatedAt: new Date().toISOString()
      });

      setNotification('Smart Scheduling applied! Free slots allocated successfully.');

      if (user) {
        await logScheduleAction(user.uid, task.id, 'smart_scheduled', 'Allocated free spots on calendar.');
        await logActivity(user.uid, 'smart_schedule', `Scheduled subtasks for task: ${task.task}`);
      }
    } catch (err: any) {
      console.error(err);
      setNotification('Failed to run scheduling allocation.');
    } finally {
      setScheduling(false);
    }
  };

  // Sync scheduled tasks directly into User's Google Calendar as events
  const handleSyncToGoogleCalendar = async () => {
    if (!googleAccessToken) {
      setNotification('Please connect your Google Calendar account first.');
      return;
    }

    const scheduledSubtasks = task.subtasks.filter(s => s.assignedTimeSlot && s.calendarSyncStatus !== 'synced');
    if (scheduledSubtasks.length === 0) {
      setNotification('No new scheduled subtasks are ready to sync.');
      return;
    }

    setSyncingToGoogle(true);
    setNotification(null);
    let successCount = 0;

    // Simulation/Demo Calendar Mode handler
    if (googleAccessToken === 'mock_demo_token') {
      try {
        await new Promise(resolve => setTimeout(resolve, 800)); // Realism latency
        
        const updatedSubtasks = task.subtasks.map(sub => {
          if (sub.assignedTimeSlot && sub.calendarSyncStatus !== 'synced') {
            successCount++;
            return {
              ...sub,
              calendarSyncStatus: 'synced' as const,
              calendarEventId: `sim-evt-${Math.random().toString(36).substring(2, 11)}`,
            };
          }
          return sub;
        });

        const taskRef = doc(db, 'tasks', task.id);
        await updateDoc(taskRef, {
          subtasks: updatedSubtasks,
          calendarEventsSynced: true,
          updatedAt: new Date().toISOString(),
        });

        onTaskUpdated({
          ...task,
          subtasks: updatedSubtasks,
          calendarEventsSynced: true,
          updatedAt: new Date().toISOString()
        });

        setNotification(`[DEMO MODE] Successfully synchronized ${successCount} execution blocks to your simulated Calendar!`);
      } catch (err) {
        console.error("Demo sync failed:", err);
        setNotification('Simulated sync failed.');
      } finally {
        setSyncingToGoogle(false);
      }
      return;
    }

    try {
      const updatedSubtasks = [...task.subtasks];

      for (let i = 0; i < updatedSubtasks.length; i++) {
        const sub = updatedSubtasks[i];
        if (sub.assignedTimeSlot && sub.calendarSyncStatus !== 'synced') {
          // POST to Google Calendar
          const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${googleAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              summary: `ChronoMind: ${sub.title}`,
              description: `Decomposed execution block from task: ${task.task}`,
              start: {
                dateTime: sub.assignedTimeSlot.startTime,
              },
              end: {
                dateTime: sub.assignedTimeSlot.endTime,
              },
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'popup', minutes: 15 }
                ]
              }
            })
          });

          if (response.ok) {
            const eventData = await response.json();
            updatedSubtasks[i] = {
              ...sub,
              calendarSyncStatus: 'synced',
              calendarEventId: eventData.id,
            };
            successCount++;

            // Save in log collection
            if (user) {
              await logCalendarEvent(
                user.uid, 
                task.id, 
                sub.id, 
                eventData.id, 
                `ChronoMind: ${sub.title}`, 
                sub.assignedTimeSlot.startTime, 
                sub.assignedTimeSlot.endTime
              );
            }
          } else {
            updatedSubtasks[i] = {
              ...sub,
              calendarSyncStatus: 'failed',
            };
          }
        }
      }

      // Update Task in Firestore with final sync statuses
      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, {
        subtasks: updatedSubtasks,
        calendarEventsSynced: true,
        updatedAt: new Date().toISOString(),
      });

      // Update Parent State
      onTaskUpdated({
        ...task,
        subtasks: updatedSubtasks,
        calendarEventsSynced: true,
        updatedAt: new Date().toISOString()
      });

      setNotification(`Synchronized ${successCount} execution blocks to Google Calendar!`);
      if (user) {
        await logActivity(user.uid, 'sync_calendar', `Pushed ${successCount} events into calendar.`);
      }
    } catch (err: any) {
      console.error(err);
      setNotification('Encountered an error pushing events to Google.');
    } finally {
      setSyncingToGoogle(false);
    }
  };

  // Adaptive Rescheduling: rearranging tasks if deadline risk increases
  const handleAdaptiveReschedule = async () => {
    setScheduling(true);
    setNotification(null);
    try {
      // Re-fetch slots to get updated state
      await fetchBusySlots();
      
      const incomplete = task.subtasks.filter(s => !s.completed);
      
      const response = await fetch('/api/calendar/schedule-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subtasks: incomplete,
          busySlots: busySlots,
          startDate: new Date().toISOString(),
          deadline: task.deadline,
        }),
      });

      if (!response.ok) {
        throw new Error('Adaptive scheduler algorithm failed.');
      }

      const data = await response.json();
      const scheduledIncomplete = data.scheduledSubtasks || [];

      // Merge back completed ones with their original slots
      const mergedSubtasks = task.subtasks.map(s => {
        if (s.completed) return s;
        const scheduledVer = scheduledIncomplete.find((si: any) => si.id === s.id);
        return scheduledVer || s;
      });

      // Update Firestore
      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, {
        subtasks: mergedSubtasks,
        updatedAt: new Date().toISOString(),
      });

      onTaskUpdated({
        ...task,
        subtasks: mergedSubtasks,
        updatedAt: new Date().toISOString()
      });

      setNotification('Adaptive Schedule update complete! Slots reshuffled around calendar conflicts.');

      if (user) {
        await logScheduleAction(user.uid, task.id, 'rescheduled', 'Adaptive Reschedule triggered to clear overlaps.');
        await logActivity(user.uid, 'adaptive_reschedule', `Rescheduled remaining steps for task: ${task.task}`);
      }
    } catch (err) {
      console.error(err);
      setNotification('Failed to execute adaptive rescheduling.');
    } finally {
      setScheduling(false);
    }
  };

  // Check and show Context-Aware reminders
  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now();
      const activeReminders: string[] = [];

      task.subtasks.forEach(sub => {
        if (sub.assignedTimeSlot && !sub.completed) {
          const start = new Date(sub.assignedTimeSlot.startTime).getTime();
          const diffMins = (start - now) / (1000 * 60);

          // If event starts in 10-20 minutes, flag as ready reminder
          if (diffMins > 0 && diffMins <= 15) {
            activeReminders.push(`⏰ You have a scheduled ChronoMind task "${sub.title}" in ${Math.round(diffMins)} minutes.`);
          }
        }
      });

      setReminders(activeReminders);
    };

    checkReminders();
    const interval = setInterval(checkReminders, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [task.subtasks]);

  return (
    <div className="glass-panel p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-cyan-400" />
          <h2 className="font-display font-semibold text-lg text-white">Google Calendar Integration</h2>
        </div>

        {googleAccessToken ? (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
            ACTIVE SYNC
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] font-mono text-slate-500">
            OFFLINE
          </div>
        )}
      </div>

      {notification && (
        <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-cyan-300 flex items-start gap-2.5">
          <Activity className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>{notification}</span>
        </div>
      )}

      {reminders.map((rem, idx) => (
        <div key={idx} className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2 animate-bounce">
          <Clock className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{rem}</span>
        </div>
      ))}

      {/* Google Sign in / Connect UI */}
      {!googleAccessToken ? (
        <div className="text-center py-6 space-y-4">
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Connect your Google Calendar to allow ChronoMind to analyze your availability slots, avoid work scheduling conflicts, and automatically book execution times.
          </p>
          <button
            onClick={handleConnectCalendar}
            disabled={connecting}
            className="gsi-material-button mx-auto cursor-pointer"
          >
            <div className="gsi-material-button-state"></div>
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents">
                {connecting ? 'Requesting Authorization...' : 'Link Google Calendar'}
              </span>
            </div>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick Actions Panel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={handleSmartSchedule}
              disabled={scheduling}
              className="py-2.5 px-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all shadow-[0_2px_10px_rgba(6,182,212,0.2)] inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              {scheduling ? (
                <>
                  <Loader className="w-3.5 h-3.5 animate-spin text-black" />
                  Allocating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-black" />
                  SMART SLOT ASSIGN
                </>
              )}
            </button>

            <button
              onClick={handleSyncToGoogleCalendar}
              disabled={syncingToGoogle}
              className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-[10px] uppercase rounded-xl transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              {syncingToGoogle ? (
                <>
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <CalendarCheck className="w-3.5 h-3.5 text-cyan-400" />
                  SYNC TO CALENDAR
                </>
              )}
            </button>

            <button
              onClick={handleAdaptiveReschedule}
              disabled={scheduling}
              className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-[10px] uppercase rounded-xl transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${scheduling ? 'animate-spin' : ''}`} />
              ADAPT SCHEDULE
            </button>
          </div>

          {/* Today's Schedule Timeline Preview */}
          <div className="space-y-3">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center justify-between">
              <span>TODAY'S CHRONO SEGMENTS (08:00 - 22:00)</span>
              <span>{busySlots.length} calendar conflicts</span>
            </p>

            <div className="bg-black/30 border border-white/5 rounded-2xl p-4 divide-y divide-white/5 max-h-[300px] overflow-y-auto">
              {/* Map out hours */}
              {Array.from({ length: 15 }, (_, i) => i + 8).map(hour => {
                // Find any busy event in this hour
                const busyInHour = busySlots.find(b => {
                  const s = new Date(b.start).getHours();
                  const e = new Date(b.end).getHours();
                  return s <= hour && e > hour;
                });

                // Find any subtask scheduled in this hour
                const subInHour = task.subtasks.find(sub => {
                  if (!sub.assignedTimeSlot) return false;
                  const s = new Date(sub.assignedTimeSlot.startTime).getHours();
                  const e = new Date(sub.assignedTimeSlot.endTime).getHours();
                  return s <= hour && e > hour;
                });

                return (
                  <div key={hour} className="flex items-center gap-4 py-2 text-xs">
                    <span className="w-10 text-right font-mono text-slate-600 shrink-0">
                      {hour.toString().padStart(2, '0')}:00
                    </span>
                    
                    {busyInHour ? (
                      <div className="flex-1 px-3 py-1.5 bg-white/5 border border-dashed border-white/10 rounded-lg text-slate-500 font-mono text-[10px] truncate">
                        🔒 OCCUPIED: {busyInHour.title}
                      </div>
                    ) : subInHour ? (
                      <div className={`flex-1 px-3 py-1.5 rounded-lg border flex items-center justify-between gap-2 truncate transition-all ${
                        subInHour.completed 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-slate-500' 
                          : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 font-medium shadow-[0_0_8px_rgba(6,182,212,0.05)]'
                      }`}>
                        <span className="truncate flex items-center gap-1.5">
                          <Check className={`w-3.5 h-3.5 shrink-0 ${subInHour.completed ? 'text-emerald-400' : 'text-slate-500'}`} />
                          {subInHour.title}
                        </span>
                        <span className="text-[9px] font-mono shrink-0 bg-white/5 px-2 py-0.5 rounded text-slate-400">
                          {new Date(subInHour.assignedTimeSlot!.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ) : (
                      <div className="flex-1 text-[10px] text-slate-700 italic px-3">
                        Free available execution slot
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
                <h3 className="font-display font-bold text-lg text-white">Google Provider Disabled</h3>
              </div>
            </div>

            <div className="p-4 bg-rose-500/5 border border-rose-500/15 rounded-xl space-y-2">
              <p className="text-xs text-rose-300 leading-relaxed font-light">
                Your Firebase project has thrown an <strong className="font-mono text-rose-400">auth/operation-not-allowed</strong> response. Google Sign-In is currently disabled under Authentication in your Firebase Console.
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">How to Enable Google Provider:</p>
              
              <ul className="space-y-3.5 text-xs text-slate-300">
                <li className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-[10px] font-mono text-cyan-400 shrink-0 mt-0.5">1</div>
                  <span className="leading-relaxed">
                    Open your <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline inline-flex items-center gap-1">Firebase Console <ExternalLink className="w-3.5 h-3.5 inline" /></a>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-[10px] font-mono text-cyan-400 shrink-0 mt-0.5">2</div>
                  <span className="leading-relaxed">
                    Navigate to <strong>Build &gt; Authentication &gt; Sign-in method</strong>. Click <strong>Add new provider</strong>, choose <strong>Google</strong>, enable the toggle, and click <strong>Save</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-[10px] font-mono text-cyan-400 shrink-0 mt-0.5">3</div>
                  <span className="leading-relaxed">
                    Under the <strong>Settings</strong> tab, add <code className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded font-mono text-cyan-400 text-[11px]">{window.location.hostname}</code> to <strong>Authorized Domains</strong>.
                  </span>
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-white uppercase tracking-wider">🚀 Bypass &amp; Simulate Now:</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  You can activate the <strong>Simulated Demo Calendar</strong> to try out the smart hourly schedule, collision avoidance, and event sync with zero setup!
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    enableCalendarDemoMode();
                    setShowAuthInstructions(false);
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-black font-mono font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_15px_rgba(6,182,212,0.25)] cursor-pointer"
                >
                  ⚡ Try Demo Calendar
                </button>
                <button
                  type="button"
                  onClick={() => setShowAuthInstructions(false)}
                  className="py-3 px-5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-mono font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
