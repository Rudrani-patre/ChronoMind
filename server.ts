/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini client utility safely
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Warning: GEMINI_API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "MOCK_KEY",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

const ai = getGeminiClient();

app.use(express.json());

// Helper to strip markdown JSON blocks
function cleanJsonResponse(rawText: string): string {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

// High-Fidelity ChronoMind Local Sandbox Generators for Zero-Setup Offline/Iframe Reliability
function generateMockPlan(task: string, deadline: string) {
  const lower = task.toLowerCase();
  let subtasks = [];
  let roadmap = "";
  let isImpossible = false;
  let impossibleReason = "";

  if (
    lower.includes("impossible") || 
    lower.includes("travel to mars") || 
    lower.includes("time travel") || 
    (lower.includes("build") && lower.includes("day") && (lower.includes("house") || lower.includes("skyscraper")))
  ) {
    isImpossible = true;
    impossibleReason = `ChronoMind Chronological Analysis: Attempting to "${task}" within this timeframe violates physical laws and structural logistics. Our simulation engines advise a complete re-scoping.`;
    roadmap = `### 🚨 Mission Impossible Detected\n\n- **Logistics Alert**: This task exceeds safe physical thresholds.\n- **Recommendation**: Deconstruct the ambition or extend the target deadline.`;
  } else if (
    lower.includes("code") || 
    lower.includes("app") || 
    lower.includes("build") || 
    lower.includes("website") || 
    lower.includes("software") || 
    lower.includes("dev") ||
    lower.includes("program")
  ) {
    subtasks = [
      { id: `subtask_mock_${Date.now()}_1`, title: "Analyze system requirements and design database architecture", priority: "high", estimatedMinutes: 45, completed: false, order: 1 },
      { id: `subtask_mock_${Date.now()}_2`, title: "Set up the local environment, repository, and basic boilerplates", priority: "high", estimatedMinutes: 30, completed: false, order: 2 },
      { id: `subtask_mock_${Date.now()}_3`, title: "Implement core backend routes, authentication, and database schemas", priority: "high", estimatedMinutes: 90, completed: false, order: 3 },
      { id: `subtask_mock_${Date.now()}_4`, title: "Develop beautiful, responsive user interface views with Tailwind CSS", priority: "medium", estimatedMinutes: 120, completed: false, order: 4 },
      { id: `subtask_mock_${Date.now()}_5`, title: "Connect frontend components to backend API services", priority: "high", estimatedMinutes: 60, completed: false, order: 5 },
      { id: `subtask_mock_${Date.now()}_6`, title: "Conduct comprehensive end-to-end testing, debug race conditions, and optimize build bundles", priority: "medium", estimatedMinutes: 45, completed: false, order: 6 },
      { id: `subtask_mock_${Date.now()}_7`, title: "Deploy build artifacts to production hosting and verify environment configs", priority: "low", estimatedMinutes: 30, completed: false, order: 7 }
    ];
    roadmap = `### 💻 Software Development Road Map\n\nWe have formulated an agile sprint sequence to implement **${task}** before the deadline:\n\n1. **Blueprint Phase**: Finalize database relationships and schema parameters.\n2. **MVP Execution**: Focus on critical-path high priority components first.\n3. **Sanity Checking**: Rigorously test and debug connections before live deployment.`;
  } else if (
    lower.includes("write") || 
    lower.includes("essay") || 
    lower.includes("paper") || 
    lower.includes("report") || 
    lower.includes("book") || 
    lower.includes("article") ||
    lower.includes("thesis")
  ) {
    subtasks = [
      { id: `subtask_mock_${Date.now()}_1`, title: "Conduct background literature research and compile notes", priority: "high", estimatedMinutes: 60, completed: false, order: 1 },
      { id: `subtask_mock_${Date.now()}_2`, title: "Formulate a strong thesis statement and structural outline", priority: "high", estimatedMinutes: 30, completed: false, order: 2 },
      { id: `subtask_mock_${Date.now()}_3`, title: "Draft the introductory section and contextualize the main hook", priority: "medium", estimatedMinutes: 30, completed: false, order: 3 },
      { id: `subtask_mock_${Date.now()}_4`, title: "Flesh out core body arguments with strong supporting evidence and quotes", priority: "high", estimatedMinutes: 120, completed: false, order: 4 },
      { id: `subtask_mock_${Date.now()}_5`, title: "Draft a comprehensive conclusion synthesizing all key insights", priority: "medium", estimatedMinutes: 45, completed: false, order: 5 },
      { id: `subtask_mock_${Date.now()}_6`, title: "Perform thorough proofreading for clarity, flow, and structural flow", priority: "low", estimatedMinutes: 30, completed: false, order: 6 }
    ];
    roadmap = `### ✍️ Editorial Composition Road Map\n\nTo construct a powerful written piece on **${task}**:\n\n1. **Fact Synthesis**: Secure key evidence before drafting paragraphs.\n2. **Structuring Flow**: Ensure each section seamlessly connects to your core thesis.\n3. **Refinement Cycle**: Polish phrasing, check citations, and verify tone.`;
  } else if (
    lower.includes("study") || 
    lower.includes("exam") || 
    lower.includes("learn") || 
    lower.includes("test") || 
    lower.includes("course") || 
    lower.includes("class") ||
    lower.includes("quiz")
  ) {
    subtasks = [
      { id: `subtask_mock_${Date.now()}_1`, title: "Gather all lectures, syllabi, textbooks, and review sheets", priority: "high", estimatedMinutes: 30, completed: false, order: 1 },
      { id: `subtask_mock_${Date.now()}_2`, title: "Identify high-weight topics and summarize core theoretical concepts", priority: "high", estimatedMinutes: 90, completed: false, order: 2 },
      { id: `subtask_mock_${Date.now()}_3`, title: "Create custom flashcards for essential terms, formulas, and key definitions", priority: "medium", estimatedMinutes: 45, completed: false, order: 3 },
      { id: `subtask_mock_${Date.now()}_4`, title: "Complete multiple practice exams or timed problem sets", priority: "high", estimatedMinutes: 120, completed: false, order: 4 },
      { id: `subtask_mock_${Date.now()}_5`, title: "Review incorrect answers and clarify lingering complex concepts", priority: "medium", estimatedMinutes: 60, completed: false, order: 5 },
      { id: `subtask_mock_${Date.now()}_6`, title: "Perform a final light review of summarized flashcards and formulas", priority: "low", estimatedMinutes: 30, completed: false, order: 6 }
    ];
    roadmap = `### 🧠 Cognitive Mastery Road Map\n\nOptimized study plan to conquer **${task}** confidently:\n\n1. **Theoretical Grounding**: Solidify core mental models early.\n2. **Active Recall**: Force retention using practice sets and flashcards.\n3. **Memory Consolidation**: Clear up weak spots instead of cramming everything.`;
  } else {
    subtasks = [
      { id: `subtask_mock_${Date.now()}_1`, title: "Deconstruct requirements, outline milestones, and define ultimate success goals", priority: "high", estimatedMinutes: 30, completed: false, order: 1 },
      { id: `subtask_mock_${Date.now()}_2`, title: "Acquire necessary reference resources, tools, materials, or initial data", priority: "high", estimatedMinutes: 45, completed: false, order: 2 },
      { id: `subtask_mock_${Date.now()}_3`, title: "Execute the core foundational components of the task", priority: "high", estimatedMinutes: 90, completed: false, order: 3 },
      { id: `subtask_mock_${Date.now()}_4`, title: "Flesh out supporting details, secondary phases, and aesthetic polish", priority: "medium", estimatedMinutes: 60, completed: false, order: 4 },
      { id: `subtask_mock_${Date.now()}_5`, title: "Conduct detailed review, verify quality parameters, and optimize details", priority: "medium", estimatedMinutes: 45, completed: false, order: 5 },
      { id: `subtask_mock_${Date.now()}_6`, title: "Finalize delivery, wrap up outstanding items, and present results", priority: "low", estimatedMinutes: 30, completed: false, order: 6 }
    ];
    roadmap = `### 🚀 General Task Execution Road Map\n\nAn organized blueprint to systematically execute **${task}** before your deadline:\n\n1. **Discovery & Setup**: Map out key milestones and clear prerequisites.\n2. **Deep Work Sprint**: Dive into foundational steps while minimizing distractions.\n3. **Polish & Release**: Polish final aspects and review against objectives.`;
  }

  return {
    isImpossible,
    impossibleReason,
    task: task.charAt(0).toUpperCase() + task.slice(1),
    subtasks,
    roadmap,
    initialPrediction: isImpossible 
      ? "Impossible task projected. Please re-evaluate." 
      : "High-probability track. Proceeding with organized subtasks."
  };
}

function generateMockSimulation(
  task: string, 
  completedCount: number, 
  totalSubtasks: number, 
  riskScore: number = 40, 
  inactivityMinutes: number = 0, 
  triggerType: string = 'manual'
) {
  const progressPercentage = totalSubtasks > 0 ? Math.round((completedCount / totalSubtasks) * 1000) / 10 : 0;
  const remaining = totalSubtasks - completedCount;

  let completionRisk: "high" | "medium" | "low" = "medium";
  if (riskScore > 70) completionRisk = "high";
  else if (riskScore < 30) completionRisk = "low";

  let futureProjection = "";
  let immediateAction = "";

  if (triggerType === 'inactivity' || inactivityMinutes > 15) {
    futureProjection = `At this pace, your inactivity of ${inactivityMinutes || 30} minutes is compounding stress. Future-you may face last-minute pressure if this continues.`;
    immediateAction = `You've been inactive for ${inactivityMinutes || 30} minutes. Resume the next subtask right now.`;
  } else if (triggerType === 'deadline_near') {
    futureProjection = `Only a short time remains before your deadline! Future-you will be extremely stressed if any core high-priority milestones are left unfinished.`;
    immediateAction = `Only 2 hours left. Focus on critical tasks first.`;
  } else if (triggerType === 'behind_pace' || riskScore > 65) {
    futureProjection = `You are currently falling behind the optimal sprint velocity. Future-you might face last-minute deadline pressure.`;
    immediateAction = `Complete one more subtask to reduce risk by 18%.`;
  } else if (triggerType === 'subtask_completed' || progressPercentage > 60) {
    futureProjection = `Outstanding velocity! You are ${progressPercentage}% closer to finishing your task. Future-you is less stressed and in control.`;
    immediateAction = `You're ahead of schedule. Finish one more now and reduce tomorrow's load.`;
  } else if (triggerType === 'risk_increased') {
    futureProjection = `Your task risk score has increased to ${riskScore}%. Future-you may face severe bottlenecks if this momentum drop isn't arrested.`;
    immediateAction = `Your momentum is dropping. Completing the next task now may prevent Rescue Mode.`;
  } else {
    // Default fallback based on completion rate
    if (progressPercentage >= 80) {
      futureProjection = `You're ${progressPercentage}% complete! Future-you is feeling proud, relieved, and completely stress-free.`;
      immediateAction = `Finish one more subtask to completely clear tomorrow's schedule!`;
    } else if (progressPercentage >= 40) {
      futureProjection = `At this pace, you're on a razor-thin margin. Future-you might face some delay.`;
      immediateAction = `Complete the next critical-path subtask in the next 30 minutes.`;
    } else {
      futureProjection = `Low initial progress (${progressPercentage}%). Future-you will face a massive bottleneck under extreme stress.`;
      immediateAction = `Get started immediately on the first high-priority subtask to break the freeze response.`;
    }
  }

  const hoursDifference = riskScore > 60 ? 3.5 : riskScore < 30 ? -2.5 : 0.5;
  const predictions = [
    futureProjection,
    `Risk Index stands at ${riskScore}%.`,
    `Inactivity duration: ${inactivityMinutes} minutes.`
  ];

  return {
    paceAnalysis: `Simulation Report: ${futureProjection}\n\nRecommended: ${immediateAction}`,
    completionRisk,
    hoursDifference,
    predictions,
    recommendation: immediateAction,
    futureProjection,
    immediateAction
  };
}

function generateMockRescue(task: string, subtasks: any[]) {
  const incomplete = subtasks.filter((s: any) => !s.completed);
  
  // Keep only non-low priority or compress them
  const essentialSubtasks = incomplete.map((sub: any, i: number) => {
    // Compress estimated minutes by 30%
    const compressedMinutes = Math.max(15, Math.round((sub.estimatedMinutes || 30) * 0.7));
    return {
      id: sub.id,
      title: sub.title.startsWith("[COMPRESSED]") ? sub.title : `[COMPRESSED] ${sub.title}`,
      priority: sub.priority === 'low' ? 'medium' : sub.priority,
      estimatedMinutes: compressedMinutes,
      completed: false,
      order: i + 1
    };
  }).filter(sub => sub.priority !== 'low');

  const removedSubtasksCount = incomplete.length - essentialSubtasks.length;
  const survivalRate = Math.min(95, Math.max(45, 100 - (incomplete.length * 5)));

  const compressedPlan = `### 🚨 EMERGENCY SURVIVAL PROTOCOL ACTIVATED\n\n**Mission: Save the Deadline for "${task}"**\n\n- **Time Triage**: We have eliminated ${removedSubtasksCount} optional subtasks.\n- **Workload Compression**: Remaining task durations have been compressed by **30%**.\n- **Crucial Action**: Focus strictly on core high-priority milestones to secure a minimally viable completion on time!`;

  return {
    compressedPlan,
    essentialSubtasks,
    removedSubtasksCount,
    survivalRate
  };
}

// 1. Smart Planner - AI Decomposition Endpoint
app.post("/api/planning/decompose", async (req, res) => {
  const { task, deadline } = req.body;

  if (!task || !deadline) {
    return res.status(400).json({ error: "Task description and deadline are required." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const hasValidKey = apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "MOCK_KEY" && apiKey.trim().length > 0;

  if (!hasValidKey) {
    console.warn("[SANDBOX ENGINE] Falling back to high-fidelity ChronoMind Local Sandbox Engine due to missing/inactive GEMINI_API_KEY.");
    const fallbackPlan = generateMockPlan(task, deadline);
    return res.json(fallbackPlan);
  }

  const prompt = `You are ChronoMind, an elite AI-powered execution intelligence system designed to decompose a user's task and plan for a strict deadline.

Task Name: "${task}"
Target Deadline: "${deadline}"
Current Time: ${new Date().toISOString()}

Analyze this task and deadline carefully.
First, check if this task is physically, logically, or logistically IMPOSSIBLE to complete within the given time and deadline (e.g., building a 5-floor building in 2 days, travel faster than light, 500 hours of manual work in 1 day, picking up someone two days from now when it's logically contradictory, etc.).

If it is indeed impossible, flag it. Set "isImpossible" to true, "impossibleReason" to a clear, realistic, and slightly humorous or educational explanation of why it cannot be achieved, and return an empty array for subtasks.

If it is possible, set "isImpossible" to false, "impossibleReason" to "", and decompose it into a list of 4 to 8 concrete, sequential, action-oriented subtasks that are necessary to achieve the objective on time.
Assign a priority ('high', 'medium', or 'low') and an estimated completion duration in minutes for each subtask.
- 'high' priority is for critical-path essential tasks that must be done.
- 'medium' priority is for necessary but non-critical tasks.
- 'low' priority is for helpful, optional, or easily decomposable details.

Return your response strictly as a JSON object, without any markdown backticks. Do not include any text before or after the JSON.
JSON format expected:
{
  "isImpossible": boolean,
  "impossibleReason": "Strict and helpful analysis of impossibility if applicable, or empty string if possible",
  "task": "A polished title for this task",
  "subtasks": [
    {
      "id": "subtask_1",
      "title": "Clear action-oriented step description",
      "priority": "high",
      "estimatedMinutes": 45,
      "completed": false,
      "order": 1
    }
  ],
  "roadmap": "A strategic Markdown roadmap with visual dividers explaining milestones, potential pitfalls, and timing tactics to succeed."
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const text = response.text || "{}";
    const cleaned = cleanJsonResponse(text);
    const parsed = JSON.parse(cleaned);

    res.json(parsed);
  } catch (err: any) {
    console.warn("Gemini AI planning error, transitioning to high-fidelity ChronoMind Local Sandbox Engine:", err);
    const fallbackPlan = generateMockPlan(task, deadline);
    res.json(fallbackPlan);
  }
});

// Google Calendar Busy Slots API
app.post("/api/calendar/busy-slots", async (req, res) => {
  const { accessToken, timeMin, timeMax } = req.body;
  if (!accessToken) {
    return res.status(400).json({ error: "Google Calendar Access Token is required." });
  }
  
  // Return simulated busy slots for Demo/Simulation Mode
  if (accessToken === "mock_demo_token") {
    const today = new Date();
    const createTime = (daysOffset: number, hours: number, minutes: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + daysOffset);
      d.setHours(hours, minutes, 0, 0);
      return d.toISOString();
    };

    const busySlots = [
      { id: "demo-1", title: "Sprint Planning Sync", start: createTime(0, 10, 0), end: createTime(0, 11, 30) },
      { id: "demo-2", title: "Lunch Break", start: createTime(0, 13, 0), end: createTime(0, 14, 0) },
      { id: "demo-3", title: "Weekly Sync Call", start: createTime(0, 16, 0), end: createTime(0, 17, 0) },
      { id: "demo-4", title: "Daily Standup Meeting", start: createTime(1, 9, 30), end: createTime(1, 10, 30) },
      { id: "demo-5", title: "Product Architecture Review", start: createTime(1, 15, 0), end: createTime(1, 16, 30) },
      { id: "demo-6", title: "Client Alignment Call", start: createTime(2, 11, 0), end: createTime(2, 12, 30) },
      { id: "demo-7", title: "Design Feedback Loop", start: createTime(2, 14, 0), end: createTime(2, 15, 0) },
    ];
    return res.json({ busySlots });
  }
  
  try {
    const tMin = timeMin || new Date().toISOString();
    const tMax = timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(tMin)}&timeMax=${encodeURIComponent(tMax)}&singleEvents=true&orderBy=startTime`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      }
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error("Google Calendar API error response:", errText);
      return res.status(response.status).json({ error: `Google Calendar API returned error: ${errText}` });
    }
    
    const data = await response.json();
    const events = data.items || [];
    
    const busySlots = events.map((event: any) => ({
      id: event.id,
      title: event.summary || "Busy Slot",
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
    })).filter((slot: any) => slot.start && slot.end);
    
    res.json({ busySlots });
  } catch (error: any) {
    console.error("Fetch busy slots error:", error);
    res.status(500).json({ error: "Failed to fetch Google Calendar busy slots." });
  }
});

// Smart slot scheduling algorithm
app.post("/api/calendar/schedule-tasks", (req, res) => {
  const { subtasks, busySlots, startDate, deadline } = req.body;
  if (!Array.isArray(subtasks)) {
    return res.status(400).json({ error: "subtasks list is required." });
  }
  
  const parsedBusy = (busySlots || []).map((slot: any) => ({
    start: new Date(slot.start).getTime(),
    end: new Date(slot.end).getTime(),
    title: slot.title
  })).sort((a: any, b: any) => a.start - b.start);
  
  let currentPtr = startDate ? new Date(startDate).getTime() : Date.now();
  const limitTime = deadline ? new Date(deadline).getTime() : currentPtr + 30 * 24 * 60 * 60 * 1000;
  
  const scheduledSubtasks = [];
  
  for (const sub of subtasks) {
    const durationMs = (sub.estimatedMinutes || 30) * 60 * 1000;
    let scheduled = false;
    
    while (!scheduled && currentPtr < limitTime) {
      const startCandidate = currentPtr;
      const endCandidate = startCandidate + durationMs;
      
      // Check overlap with any busy slots
      let overlapSlot = null;
      for (const busy of parsedBusy) {
        if (startCandidate < busy.end && endCandidate > busy.start) {
          overlapSlot = busy;
          break;
        }
      }
      
      if (overlapSlot) {
        // If it overlaps, push the pointer to the end of the overlapping busy slot
        currentPtr = overlapSlot.end;
      } else {
        // No overlap! Check sleeping hours: daytime limits (8 AM to 10 PM)
        const dateObj = new Date(startCandidate);
        const startHour = dateObj.getHours();
        
        // Let's check if startHour is before 8 AM or after 10 PM (22)
        if (startHour >= 22 || startHour < 8) {
          // Push to 8 AM of the next day (or same day if before 8 AM)
          const tempDate = new Date(startCandidate);
          if (startHour >= 22) {
            tempDate.setDate(tempDate.getDate() + 1);
          }
          tempDate.setHours(8, 0, 0, 0);
          currentPtr = tempDate.getTime();
        } else {
          // Success! Allocate the slot
          scheduledSubtasks.push({
            ...sub,
            assignedTimeSlot: {
              startTime: new Date(startCandidate).toISOString(),
              endTime: new Date(endCandidate).toISOString(),
            },
            calendarSyncStatus: 'none' as const
          });
          currentPtr = endCandidate + 15 * 60 * 1000; // Add 15 mins buffer between tasks
          scheduled = true;
        }
      }
    }
    
    // If we couldn't schedule within deadline limits, we place it with none sync status
    if (!scheduled) {
      scheduledSubtasks.push({
        ...sub,
        assignedTimeSlot: undefined,
        calendarSyncStatus: 'none' as const
      });
    }
  }
  
  res.json({ scheduledSubtasks });
});

// 2. Future Self Simulator Endpoint (Upgraded to Future Self Behavioral Engine)
app.post("/api/planning/simulate", async (req, res) => {
  const { task, deadline, subtasks, completedCount, riskScore, inactivityMinutes, triggerType } = req.body;

  if (!task || !deadline || !Array.isArray(subtasks)) {
    return res.status(400).json({ error: "Missing required simulation fields." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const hasValidKey = apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "MOCK_KEY" && apiKey.trim().length > 0;

  const currentRisk = typeof riskScore === 'number' ? riskScore : 40;
  const currentInactivity = typeof inactivityMinutes === 'number' ? inactivityMinutes : 0;
  const currentTrigger = triggerType || 'manual';

  if (!hasValidKey) {
    console.warn("[SANDBOX ENGINE] Falling back to high-fidelity ChronoMind Local Simulation Engine due to missing/inactive GEMINI_API_KEY.");
    const fallbackSim = generateMockSimulation(task, completedCount, subtasks.length, currentRisk, currentInactivity, currentTrigger);
    return res.json(fallbackSim);
  }

  const totalSubtasks = subtasks.length;
  const progressPercentage = totalSubtasks > 0 ? Math.round((completedCount / totalSubtasks) * 1000) / 10 : 0;

  const prompt = `You are the Future Self Behavioral Engine inside ChronoMind.
Your job is to look at the current completion pace, deadline, and context parameters, then generate BOTH a future outcome consequence projection and context-aware immediate action guidance.

Parent Task: "${task}"
Deadline: "${deadline}"
Current Time: ${new Date().toISOString()}
Total Subtasks: ${totalSubtasks}
Completed Subtasks So Far: ${completedCount}
Calculated Progress: ${progressPercentage}%
Current Risk Score: ${currentRisk}%
Inactivity Duration: ${currentInactivity} minutes
Trigger Type: ${currentTrigger}

Please analyze their behavioral status to formulate the guidance:
1. "futureProjection": A projection of how future-them is affected, e.g.:
   - If they are progressing: "You've completed ${progressPercentage}% of your work. Future-you is significantly less stressed."
   - If they are delaying/behind: "At this pace, your deadline may slip. Future-you may face extreme last-minute pressure."
2. "immediateAction": High-fidelity context-aware real-time action guidance answering “What should I do right now?”:
   - If inactive: "You’ve been inactive for ${currentInactivity} minutes. Resume the next subtask now."
   - If deadline close: "Only 2 hours left. Focus on critical tasks first."
   - If behind: "Complete one more subtask to reduce risk by 18%."
   - If progressing: "You’re ahead of schedule. Finish one more now and reduce tomorrow’s load."
   - If risk rising: "Your momentum is dropping. Completing the next task now may prevent Rescue Mode."
3. Fill in backward-compatible fields: paceAnalysis, completionRisk, hoursDifference, predictions, and recommendation.

Return your response strictly as a JSON object, with no markdown backticks, matching this exact structure:
{
  "futureProjection": "Description of future outcome",
  "immediateAction": "Actionable immediate guidance answering 'What should I do right now?'",
  "paceAnalysis": "Detailed paragraph analyzing current work pace and timeline, referencing that they have completed ${progressPercentage}% of tasks",
  "completionRisk": "high" | "medium" | "low",
  "hoursDifference": number (approximate hours they will be late by, or negative if ahead),
  "predictions": [
    "At this pace, you may...",
    "If you complete...",
    "Your tomorrow self will face..."
  ],
  "recommendation": "One powerful immediate recommendation matching immediateAction."
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const text = response.text || "{}";
    const cleaned = cleanJsonResponse(text);
    const parsed = JSON.parse(cleaned);

    res.json(parsed);
  } catch (err: any) {
    console.warn("Gemini Simulator error, transitioning to high-fidelity ChronoMind Local Simulation Engine:", err);
    const fallbackSim = generateMockSimulation(task, completedCount, totalSubtasks, currentRisk, currentInactivity, currentTrigger);
    res.json(fallbackSim);
  }
});

// 3. Deadline Rescue Mode Endpoint
app.post("/api/planning/rescue", async (req, res) => {
  const { task, deadline, subtasks } = req.body;

  if (!task || !deadline || !Array.isArray(subtasks)) {
    return res.status(400).json({ error: "Missing required rescue fields." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const hasValidKey = apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "MOCK_KEY" && apiKey.trim().length > 0;

  if (!hasValidKey) {
    console.warn("[SANDBOX ENGINE] Falling back to high-fidelity ChronoMind Local Rescue Engine due to missing/inactive GEMINI_API_KEY.");
    const fallbackRescue = generateMockRescue(task, subtasks);
    return res.json(fallbackRescue);
  }

  const prompt = `You are the EMERGENCY DEADLINE RESCUE controller of ChronoMind.
The user is falling behind, the deadline is fast approaching, and they are in danger of failing. You must activate Survival Mode and execute extreme time triage.

Parent Task: "${task}"
Deadline: "${deadline}"
Current Time: ${new Date().toISOString()}
Subtasks Remaining (incomplete):
${JSON.stringify(subtasks.filter((s: any) => !s.completed))}

Your mission is to:
1. Compress remaining subtasks (reduce non-essential time, make titles ultra-focused).
2. Filter out optional tasks: Remove or flag "low" priority subtasks and non-essential "medium" tasks to squeeze the workload into the absolute limit of remaining time.
3. Formulate an emergency survival plan/sequence (Markdown formatted) focusing on raw survival: what is the single critical path to have a working outcome?
4. Calculate an estimated Survival Rate (percentage, e.g. 75%).

Return your response strictly as a JSON object, with no markdown backticks, matching this structure:
{
  "compressedPlan": "A high-octane, step-by-step survival sequence in Markdown. Cut out the fat. Tell them exactly what to skip and what to crunch.",
  "essentialSubtasks": [
    {
      "id": string,
      "title": "Compressed focus title (e.g. 'Build Core MVP only')",
      "priority": "high" | "medium",
      "estimatedMinutes": number (reduced/compressed duration),
      "completed": false,
      "order": number
    }
  ],
  "removedSubtasksCount": number,
  "survivalRate": number (1 to 100)
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const text = response.text || "{}";
    const cleaned = cleanJsonResponse(text);
    const parsed = JSON.parse(cleaned);

    res.json(parsed);
  } catch (err: any) {
    console.warn("Gemini Rescue Mode error, transitioning to high-fidelity ChronoMind Local Rescue Engine:", err);
    const fallbackRescue = generateMockRescue(task, subtasks);
    res.json(fallbackRescue);
  }
});

// Full-stack Vite handling
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ChronoMind full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
