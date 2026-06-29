/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Task, Subtask } from '../types';
import { 
  Mic, MicOff, Volume2, VolumeX, Sparkles, Brain, X, Send, Play, HelpCircle, AlertCircle
} from 'lucide-react';

interface ChronoVoiceProps {
  tasks: Task[];
  activeTask?: Task | null;
}

export default function ChronoVoice({ tasks, activeTask: propActiveTask }: ChronoVoiceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [recognitionSupported, setRecognitionSupported] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [assistantState, setAssistantState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [speechError, setSpeechError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const waveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [waveHeights, setWaveHeights] = useState<number[]>([15, 15, 15, 15, 15]);

  // Determine active/target task for voice context
  const getActiveContextTask = (): Task | null => {
    if (propActiveTask) return propActiveTask;
    // Find first task in active state
    const active = tasks.find(t => t.status === 'active');
    if (active) return active;
    // Find first incomplete task
    const incomplete = tasks.find(t => t.status !== 'completed' && t.progressPercentage < 100);
    if (incomplete) return incomplete;
    // Fallback to first task if any exist
    return tasks.length > 0 ? tasks[0] : null;
  };

  useEffect(() => {
    // Check SpeechRecognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setRecognitionSupported(false);
    } else {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setAssistantState('listening');
        setSpeechError(null);
        startWaveAnimation();
      };

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        processVoiceCommand(text);
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          setSpeechError("Microphone permission denied inside this frame. Try typing below!");
        } else {
          setSpeechError(`Error: ${event.error}. Please try again.`);
        }
        setIsListening(false);
        setAssistantState('idle');
        stopWaveAnimation();
      };

      rec.onend = () => {
        setIsListening(false);
        if (assistantState === 'listening') {
          setAssistantState('idle');
        }
        stopWaveAnimation();
      };

      recognitionRef.current = rec;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopVoice();
      stopWaveAnimation();
    };
  }, [tasks, propActiveTask]);

  // Stop active speech synthesis
  const stopVoice = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
  };

  // Speak response aloud using speechSynthesis
  const speakText = (text: string) => {
    stopVoice();
    if (!voiceEnabled || !synthRef.current) return;

    // Clean up text for clearer pronunciation
    const cleanText = text.replace(/%/g, ' percent').replace(/“|”|"/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utteranceRef.current = utterance;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setAssistantState('speaking');
      startWaveAnimation();
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setAssistantState('idle');
      stopWaveAnimation();
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setAssistantState('idle');
      stopWaveAnimation();
    };

    // Find a nice natural English voice if possible
    const voices = synthRef.current.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en-') && v.name.includes('Google')) || 
                         voices.find(v => v.lang.startsWith('en-')) || 
                         voices[0];
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    utterance.rate = 1.05; // Slightly faster for high-performance vibe

    synthRef.current.speak(utterance);
  };

  const startWaveAnimation = () => {
    if (waveIntervalRef.current) clearInterval(waveIntervalRef.current);
    waveIntervalRef.current = setInterval(() => {
      setWaveHeights(Array.from({ length: 5 }, () => Math.floor(Math.random() * 30) + 8));
    }, 120);
  };

  const stopWaveAnimation = () => {
    if (waveIntervalRef.current) {
      clearInterval(waveIntervalRef.current);
      waveIntervalRef.current = null;
    }
    setWaveHeights([15, 15, 15, 15, 15]);
  };

  const toggleListening = () => {
    stopVoice();
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionSupported) {
        setSpeechError("Speech recognition is not supported in this environment. Use the text input below!");
        return;
      }
      try {
        setTranscript('');
        setResponse('');
        recognitionRef.current?.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
        recognitionRef.current?.abort();
        setTimeout(() => {
          recognitionRef.current?.start();
        }, 300);
      }
    }
  };

  // Process natural language command and calculate exact productivity advice
  const processVoiceCommand = (input: string) => {
    setAssistantState('thinking');
    const queryStr = input.toLowerCase().trim();
    const task = getActiveContextTask();

    let reply = "";

    if (!task) {
      reply = "You do not have any active tasks logged in your terminal right now. Please create a new task on the dashboard to initialize execution tracking.";
      setResponse(reply);
      speakText(reply);
      return;
    }

    const title = task.task;
    const completed = task.completedSubtasks;
    const total = task.totalSubtasks;
    const progress = Math.round(task.progressPercentage);
    const risk = task.riskScore || 0;
    
    // Calculate hours remaining
    const diff = new Date(task.deadline).getTime() - Date.now();
    const hoursRemaining = Math.max(1, Math.round(diff / (1000 * 60 * 60)));
    const minutesRemaining = Math.max(1, Math.round(diff / (1000 * 60)));

    const nextSubIdx = task.subtasks.findIndex(s => !s.completed);
    const subNum = nextSubIdx !== -1 ? nextSubIdx + 1 : 1;
    const nextSubName = nextSubIdx !== -1 ? task.subtasks[nextSubIdx].title : "your next milestone";
    const riskReduction = Math.round(100 / Math.max(1, total));

    // Calculate expected progress based on time elapsed
    const elapsedMs = Date.now() - new Date(task.createdAt || Date.now()).getTime();
    const totalDuration = new Date(task.deadline).getTime() - new Date(task.createdAt || Date.now()).getTime();
    const expectedProgress = totalDuration > 0 ? Math.min(100, (elapsedMs / totalDuration) * 100) : 50;
    const expectedCompleted = Math.round((expectedProgress / 100) * total);
    const lagSubtasks = Math.max(0, expectedCompleted - completed);

    // 1. TASK GUIDANCE
    if (
      queryStr.includes('do now') || 
      queryStr.includes('next subtask') || 
      queryStr.includes('what should i do') || 
      queryStr.includes('prioritize') ||
      queryStr.includes('next step')
    ) {
      if (nextSubIdx !== -1) {
        reply = `You should execute subtask ${subNum} right now: "${nextSubName}". It is your current highest priority. Completing this single step immediately lowers your overall project collapse risk by ${riskReduction}%.`;
      } else {
        reply = `All subtasks for your task, "${title}", are completed! Excellent progress. You have achieved 100% calibration. No pending action items are required.`;
      }
    }
    // 2. RISK AWARENESS
    else if (queryStr.includes('how risky') || queryStr.includes('risk level') || queryStr.includes('collapse risk')) {
      reply = `Your overall collapse risk is evaluated at ${risk}%. ${
        risk >= 65 
          ? "This breaches the critical safety threshold of 65%. Emergency Rescue is recommended." 
          : risk >= 45 
            ? "Your timeline pressure is elevated. A single delay could trigger Rescue Mode." 
            : "Your timeline is stable. Continue maintaining this pace to survive the deadline."
      } You have ${hoursRemaining} hours left.`;
    }
    else if (queryStr.includes('falling behind') || queryStr.includes('behind pace') || queryStr.includes('lag')) {
      if (lagSubtasks > 0) {
        reply = `Yes. You are currently ${lagSubtasks} subtasks behind the projected pace for "${title}". Your deadline pressure is rising. Complete "${nextSubName}" immediately to recover lost buffer.`;
      } else {
        reply = `No, you are completely on track! Your current progress of ${progress}% is stable and aligned with projection. Maintain this rhythm.`;
      }
    }
    else if (queryStr.includes('time left') || queryStr.includes('how much time') || queryStr.includes('remaining time') || queryStr.includes('deadline')) {
      if (diff <= 0) {
        reply = "Your deadline has passed. Focus on emergency rescue or immediate status recalculation.";
      } else if (hoursRemaining > 4) {
        reply = `You have ${hoursRemaining} hours remaining until your deadline. Your time buffer is stable, but sequential focus is still advised.`;
      } else {
        reply = `Warning: Time compression is critical. Only ${hoursRemaining} hours left. Focus entirely on "${nextSubName}" and avoid all administrative tasks.`;
      }
    }
    // 3. FUTURE PREDICTION
    else if (queryStr.includes('finish on time') || queryStr.includes('can i finish') || queryStr.includes('confidence')) {
      const confidence = Math.max(10, Math.min(98, 100 - risk));
      reply = `At your current execution velocity, our timeline completion confidence is ${confidence}%. Completing just one subtask in the next hour raises this confidence by ${riskReduction}%.`;
    }
    else if (queryStr.includes('delay') || queryStr.includes('what happens if i delay')) {
      const probIncrease = Math.round(risk * 0.3 + 12);
      reply = `Delaying execution by even 2 hours increases your Rescue Mode trigger probability by ${probIncrease}%. Cognitive stalling is the primary cause of deadline failure.`;
    }
    // 4. RESCUE MODE
    else if (queryStr.includes('rescue mode') || queryStr.includes('close to rescue') || queryStr.includes('rescue threshold')) {
      if (risk >= 50) {
        reply = `Yes. Your overall collapse risk is ${risk}%, which is dangerously close to the 65% automatic Rescue Mode threshold. Complete "${nextSubName}" to keep Emergency Protocols offline.`;
      } else {
        reply = `No. Your current risk score is ${risk}%, leaving a comfortable ${65 - risk}% margin before automatic Rescue Mode triggers.`;
      }
    }
    else if (queryStr.includes('reduce') || queryStr.includes('lower risk') || queryStr.includes('how do i reduce')) {
      reply = `To reduce your risk, check off your current active subtask: "${nextSubName}". Doing so immediately decreases risk by ${riskReduction}%. Sequential execution is key.`;
    }
    // 5. PROGRESS
    else if (queryStr.includes('how much') || queryStr.includes('completed') || queryStr.includes('percentage') || queryStr.includes('done')) {
      reply = `You have successfully completed ${completed} out of ${total} subtasks for "${title}". This represents ${progress}% of your total execution plan, leaving ${total - completed} steps remaining.`;
    }
    // 6. MOTIVATION
    else if (queryStr.includes('motivate') || queryStr.includes('continue now') || queryStr.includes('stuck') || queryStr.includes('motivation')) {
      const quotes = [
        `Future-you is watching. Finishing "${nextSubName}" right now is the ultimate gift of peace you can send forward in time.`,
        `Action drives clarity. Do not wait for focus to find you. Start on "${nextSubName}" for just 5 minutes and let momentum do the rest.`,
        `Your timeline is a design of your own choices. Complete your next subtask to completely erase deadline anxiety.`
      ];
      reply = quotes[Math.floor(Math.random() * quotes.length)];
    }
    // DEFAULT COGNITIVE ADVICE
    else {
      reply = `I processed "${input}". To optimize your active task, "${title}", you are currently at ${progress}% progress with ${risk}% collapse risk. I recommend completing "${nextSubName}" right now to maintain timeline health.`;
    }

    setResponse(reply);
    speakText(reply);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    setTranscript(textInput);
    processVoiceCommand(textInput);
    setTextInput('');
  };

  return (
    <>
      {/* Floating Microphone Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-24 z-40 p-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-black font-semibold rounded-full shadow-[0_0_25px_rgba(6,182,212,0.45)] cursor-pointer hover:scale-105 transition-all flex items-center justify-center border border-cyan-300/30 group"
        title="Launch ChronoVoice Real-Time Productivity Assistant"
      >
        <Mic className="w-6 h-6 animate-pulse group-hover:scale-110 transition-transform" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 text-xs font-mono font-bold tracking-wider uppercase transition-all duration-300 whitespace-nowrap">
          ChronoVoice
        </span>
      </button>

      {/* ChronoVoice Slide-out HUD Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/20 border border-cyan-500/30 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col space-y-4">
            
            {/* Glowing top accent */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-500"></div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-cyan-400 animate-pulse" />
                <div>
                  <h3 className="text-sm font-mono font-bold text-white tracking-widest uppercase">
                    CHRONOVOICE DIRECTIVE ENGINE
                  </h3>
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    Real-Time Execution Strategist
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Voice Toggle */}
                <button
                  onClick={() => {
                    const next = !voiceEnabled;
                    setVoiceEnabled(next);
                    if (!next) stopVoice();
                  }}
                  className={`p-1.5 rounded-lg border transition-all ${
                    voiceEnabled 
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' 
                      : 'bg-white/5 border-white/5 text-slate-500'
                  }`}
                  title={voiceEnabled ? "Mute Voice Response" : "Unmute Voice Response"}
                >
                  {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                {/* Close */}
                <button
                  onClick={() => {
                    stopVoice();
                    setIsOpen(false);
                  }}
                  className="p-1.5 bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Active context task card */}
            {(() => {
              const task = getActiveContextTask();
              if (!task) return null;
              return (
                <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3 font-mono text-[10px]">
                  <div className="truncate">
                    <span className="text-slate-500 uppercase block mb-0.5">Focus Context</span>
                    <span className="text-slate-200 font-semibold truncate block">{task.task}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-slate-500 uppercase block mb-0.5">Collapse Risk</span>
                    <span className={`font-extrabold ${
                      (task.riskScore || 0) >= 65 ? 'text-rose-400 animate-pulse' : (task.riskScore || 0) >= 45 ? 'text-yellow-400' : 'text-emerald-400'
                    }`}>
                      {task.riskScore || 0}%
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Error banner */}
            {speechError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-start gap-2 text-xs font-mono">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{speechError}</span>
              </div>
            )}

            {/* Interactive Visualizer Stage */}
            <div className="h-44 bg-slate-950/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center relative p-4 font-mono">
              {assistantState === 'idle' && (
                <div className="text-center space-y-2">
                  <Sparkles className="w-8 h-8 text-indigo-400 mx-auto animate-pulse" />
                  <p className="text-xs text-slate-400">Click the mic or speak to initiate consult.</p>
                  <p className="text-[9px] text-slate-600 uppercase tracking-wider">Example: "What should I do right now?"</p>
                </div>
              )}

              {assistantState === 'listening' && (
                <div className="text-center space-y-3">
                  <div className="flex justify-center items-end gap-1 h-8">
                    {waveHeights.map((h, i) => (
                      <div 
                        key={i} 
                        className="w-1 bg-cyan-400 rounded-full transition-all duration-75" 
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-cyan-400 font-bold animate-pulse uppercase tracking-widest">Listening Contextually...</p>
                </div>
              )}

              {assistantState === 'thinking' && (
                <div className="text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-indigo-400 uppercase tracking-widest">Re-computing decision matrix...</p>
                </div>
              )}

              {assistantState === 'speaking' && (
                <div className="text-center space-y-3 w-full px-2 overflow-y-auto max-h-36">
                  <div className="flex justify-center items-end gap-1 h-8">
                    {waveHeights.map((h, i) => (
                      <div 
                        key={i} 
                        className="w-1 bg-indigo-400 rounded-full transition-all duration-75" 
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-light italic">
                    "{response}"
                  </p>
                </div>
              )}

              {/* Show raw Transcript during thinking */}
              {transcript && assistantState === 'thinking' && (
                <div className="absolute bottom-2 text-[10px] text-slate-500 text-center w-full truncate px-4">
                  Heard: "{transcript}"
                </div>
              )}
            </div>

            {/* Suggested prompts helper */}
            <div className="space-y-1.5 font-mono">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest block">SUGGESTED DIRECTIVES</span>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <button
                  onClick={() => processVoiceCommand("What should I do now?")}
                  className="p-1.5 bg-white/5 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/20 rounded-lg text-left text-slate-300 hover:text-cyan-400 transition-all cursor-pointer"
                >
                  "What should I do now?"
                </button>
                <button
                  onClick={() => processVoiceCommand("Am I falling behind?")}
                  className="p-1.5 bg-white/5 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/20 rounded-lg text-left text-slate-300 hover:text-cyan-400 transition-all cursor-pointer"
                >
                  "Am I falling behind?"
                </button>
                <button
                  onClick={() => processVoiceCommand("Can I finish on time?")}
                  className="p-1.5 bg-white/5 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/20 rounded-lg text-left text-slate-300 hover:text-cyan-400 transition-all cursor-pointer"
                >
                  "Can I finish on time?"
                </button>
                <button
                  onClick={() => processVoiceCommand("Am I close to Rescue Mode?")}
                  className="p-1.5 bg-white/5 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/20 rounded-lg text-left text-slate-300 hover:text-cyan-400 transition-all cursor-pointer"
                >
                  "Am I close to Rescue Mode?"
                </button>
              </div>
            </div>

            {/* Inputs Footer (Mic trigger + text input fallback) */}
            <div className="flex gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={toggleListening}
                className={`px-4 py-3 rounded-xl border flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                  isListening 
                    ? 'bg-rose-500 border-rose-400 text-white animate-pulse' 
                    : 'bg-cyan-500 hover:bg-cyan-400 border-cyan-400 text-black'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4 shrink-0" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 shrink-0" />
                    <span>Mic</span>
                  </>
                )}
              </button>

              <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2">
                <input
                  type="text"
                  placeholder="Consult textually (e.g., 'What is my risk?')..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim()}
                  className="px-4 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
