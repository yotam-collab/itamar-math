# Daily Coach System — Staging Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full coach widget UI + mock backend so the product can be tested end-to-end before connecting to WordPress.

**Architecture:** React widget with Zustand store, mock API service that simulates WordPress endpoints with localStorage persistence. All AI responses are canned/templated for staging. Brand colors updated to ZNK palette (navy #1B3A6B, pink #E91E78, yellow #F5B731, purple #6B3FA0).

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS 4, existing neumorphism design system.

**Staging approach:** `src/services/coachApi.ts` exposes the same interface as the future WordPress API but uses localStorage + canned responses. Swapping to real API = changing one import.

**Spec:** `docs/superpowers/specs/2026-03-20-daily-coach-system-design.md`

---

## Chunk 1: Coach Store + Mock API

### Task 1: Create Mock API Service

**Files:**
- Create: `src/services/coachApi.ts`
- Create: `src/services/mockCoachData.ts`

- [ ] **Step 1: Create mock data file**

```typescript
// src/services/mockCoachData.ts

export interface Mission {
  id: string
  type: 'vocab_learn' | 'vocab_practice' | 'reading' | 'exam_sc' | 'exam_restatement'
  title: string
  subtitle: string
  estimatedMinutes: number
  route: string  // where to navigate
  routeParams?: Record<string, string>
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  completedAt?: string
}

export interface ChatMessage {
  id: string
  sender: 'bot' | 'roni' | 'dana' | 'student' | `staff:${string}`
  type: 'text' | 'morning_message' | 'mission_card' | 'system_update' | 'plan_update'
  content: string
  metadata?: Record<string, unknown>
  createdAt: string
  readAt?: string
}

export interface DailyPlan {
  id: string
  date: string  // YYYY-MM-DD
  totalMinutes: number
  missions: Mission[]
  morningMessage: string
  status: 'active' | 'modified' | 'completed'
}

export function generateMockPlan(studentName: string): DailyPlan {
  const today = new Date().toISOString().split('T')[0]
  return {
    id: `plan-${today}`,
    date: today,
    totalMinutes: 33,
    status: 'active',
    morningMessage: `בוקר טוב, ${studentName}! ☀️\nאתמול עשית עבודה מעולה. היום נמשיך להתקדם!`,
    missions: [
      {
        id: `m-${today}-1`,
        type: 'vocab_learn',
        title: 'למד 10 מילים חדשות',
        subtitle: 'יחידה 2 · מילות קישור',
        estimatedMinutes: 8,
        route: '/vocabulary/games/learnMode',
        routeParams: { unit: '2' },
        status: 'pending',
      },
      {
        id: `m-${today}-2`,
        type: 'vocab_practice',
        title: 'תרגל 20 מילים',
        subtitle: 'חזרה על יחידות 1-2',
        estimatedMinutes: 7,
        route: '/vocabulary/games/adaptivePractice',
        status: 'pending',
      },
      {
        id: `m-${today}-3`,
        type: 'reading',
        title: 'קרא קטע + שאלות',
        subtitle: 'רמה בינונית · טכנולוגיה',
        estimatedMinutes: 10,
        route: '/reading',
        status: 'pending',
      },
      {
        id: `m-${today}-4`,
        type: 'exam_sc',
        title: '5 שאלות בחינה',
        subtitle: 'השלמת משפטים + ניסוח מחדש',
        estimatedMinutes: 8,
        route: '/exam/sc',
        status: 'pending',
      },
    ],
  }
}

export function generateMockBotResponses(): Record<string, { persona: 'bot' | 'roni' | 'dana', response: string }> {
  return {
    // Time-related
    'time': { persona: 'bot', response: 'לגמרי מבין! 😊 עדכנתי את התוכנית. תהנה!' },
    // Difficulty
    'hard': { persona: 'roni', response: 'היי! 👋 זה לגמרי נורמלי שזה מרגיש קשה. ספר לי — מה בדיוק מרגיש לך הכי מאתגר? ככה אוכל לעזור יותר ממוקד.' },
    'boring': { persona: 'roni', response: 'שמעתי אותך! 😊 בוא ננסה לגוון קצת. מה היית מעדיף — יותר משחקים, או שננסה סגנון תרגול אחר?' },
    // Exam-specific
    'restatement': { persona: 'dana', response: 'שאלות ניסוח מחדש באמת מאתגרות! 📝 טיפ: תחפש את המילה שמשנה את המשמעות. בדרך כלל יש מילה אחת מפתח שהופכת את המשפט.' },
    'exam': { persona: 'dana', response: 'בוא נדבר על זה! 📚 איזה חלק בבחינה מרגיש לך הכי מאתגר? השלמת משפטים, ניסוח מחדש, או הבנת הנקרא?' },
    // Default
    'default': { persona: 'roni', response: 'תודה ששיתפת! 😊 אני בודקת ומעדכנת. אם צריך, מישהו מהצוות יחזור אליך בהקדם.' },
  }
}

export function matchBotResponse(text: string): { persona: 'bot' | 'roni' | 'dana', response: string } {
  const lower = text.toLowerCase()
  const responses = generateMockBotResponses()

  if (lower.includes('דק') || lower.includes('זמן') || lower.includes('אירוע') || lower.includes('עסוק'))
    return responses['time']
  if (lower.includes('קשה') || lower.includes('קשות') || lower.includes('לא מבין') || lower.includes('לא מצליח'))
    return responses['hard']
  if (lower.includes('משעמם') || lower.includes('מעצבן') || lower.includes('לא מעניין'))
    return responses['boring']
  if (lower.includes('ניסוח') || lower.includes('restatement'))
    return responses['restatement']
  if (lower.includes('בחינה') || lower.includes('מבחן') || lower.includes('בגרות'))
    return responses['exam']

  return responses['default']
}
```

- [ ] **Step 2: Create coach API service**

```typescript
// src/services/coachApi.ts

import {
  type DailyPlan, type ChatMessage, type Mission,
  generateMockPlan, matchBotResponse,
} from './mockCoachData'

const STORAGE_KEY = 'znk-coach-data'

interface CoachData {
  plan: DailyPlan | null
  messages: ChatMessage[]
  lastPlanDate: string | null
}

function loadData(): CoachData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { plan: null, messages: [], lastPlanDate: null }
}

function saveData(data: CoachData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function makeId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function nowISO() {
  return new Date().toISOString()
}

// ── API Functions (same interface as future WordPress REST API) ──

export async function fetchTodayPlan(studentName: string): Promise<DailyPlan> {
  const data = loadData()
  const today = new Date().toISOString().split('T')[0]

  if (data.plan && data.lastPlanDate === today) {
    return data.plan
  }

  // Generate new plan for today
  const plan = generateMockPlan(studentName)
  data.plan = plan
  data.lastPlanDate = today

  // Add morning message to chat
  const morningMsg: ChatMessage = {
    id: makeId(),
    sender: 'bot',
    type: 'morning_message',
    content: plan.morningMessage,
    createdAt: nowISO(),
  }
  // Add mission card message
  const missionMsg: ChatMessage = {
    id: makeId(),
    sender: 'bot',
    type: 'mission_card',
    content: '',
    metadata: { planId: plan.id, totalMinutes: plan.totalMinutes },
    createdAt: nowISO(),
  }
  data.messages.push(morningMsg, missionMsg)
  saveData(data)
  return plan
}

export async function fetchMessages(since?: string): Promise<ChatMessage[]> {
  const data = loadData()
  if (!since) return data.messages
  return data.messages.filter(m => m.createdAt > since)
}

export async function sendMessage(text: string): Promise<{
  studentMessage: ChatMessage
  botReply: ChatMessage
  systemUpdate?: ChatMessage
}> {
  const data = loadData()

  // Save student message
  const studentMessage: ChatMessage = {
    id: makeId(),
    sender: 'student',
    type: 'text',
    content: text,
    createdAt: nowISO(),
  }
  data.messages.push(studentMessage)

  // Generate mock response
  const { persona, response } = matchBotResponse(text)
  const botReply: ChatMessage = {
    id: makeId(),
    sender: persona,
    type: 'text',
    content: response,
    createdAt: nowISO(),
  }

  // Check if this is a time-change request → add system update
  let systemUpdate: ChatMessage | undefined
  const lower = text.toLowerCase()
  if (lower.includes('דק') || lower.includes('זמן') || lower.includes('אירוע')) {
    systemUpdate = {
      id: makeId(),
      sender: 'bot',
      type: 'system_update',
      content: 'התוכנית עודכנה · הקריאה הועברה למחר',
      createdAt: nowISO(),
    }
    // Remove reading mission from plan
    if (data.plan) {
      data.plan.missions = data.plan.missions.filter(m => m.type !== 'reading')
      data.plan.totalMinutes = data.plan.missions
        .filter(m => m.status !== 'completed')
        .reduce((sum, m) => sum + m.estimatedMinutes, 0)
      data.plan.status = 'modified'
    }
    data.messages.push(systemUpdate)
  }

  data.messages.push(botReply)
  saveData(data)

  return { studentMessage, botReply, systemUpdate }
}

export async function completeMission(missionId: string): Promise<Mission | null> {
  const data = loadData()
  if (!data.plan) return null

  const mission = data.plan.missions.find(m => m.id === missionId)
  if (!mission) return null

  mission.status = 'completed'
  mission.completedAt = nowISO()

  // Check if all done
  const allDone = data.plan.missions.every(m => m.status === 'completed')
  if (allDone) {
    data.plan.status = 'completed'
    const celebMsg: ChatMessage = {
      id: makeId(),
      sender: 'bot',
      type: 'text',
      content: 'מדהים! סיימת את כל המשימות להיום! 🎉🎉🎉\nצברת +180 XP. נתראה מחר!',
      createdAt: nowISO(),
    }
    data.messages.push(celebMsg)
  }

  saveData(data)
  return mission
}

export async function syncLearningState(state: Record<string, unknown>): Promise<void> {
  // In staging: just log. In production: POST to WordPress
  console.log('[coach-sync]', state)
}
```

- [ ] **Step 3: Verify files compile**

Run: `cd /Users/yotam.osher/claude-code/ZNK/Amirnet/.claude/worktrees/epic-khorana && npx tsc --noEmit src/services/coachApi.ts src/services/mockCoachData.ts`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/services/coachApi.ts src/services/mockCoachData.ts
git commit -m "feat(coach): add mock API service + data types for staging"
```

---

### Task 2: Create Coach Store

**Files:**
- Create: `src/stores/coachStore.ts`

- [ ] **Step 1: Create the Zustand store**

```typescript
// src/stores/coachStore.ts

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DailyPlan, ChatMessage, Mission } from '../services/mockCoachData'
import * as coachApi from '../services/coachApi'

interface CoachState {
  // Widget state
  isOpen: boolean
  hasOpenedToday: boolean
  lastOpenDate: string | null
  unreadCount: number

  // Data
  dailyPlan: DailyPlan | null
  messages: ChatMessage[]
  isTyping: boolean
  typingPersona: 'bot' | 'roni' | 'dana' | null

  // Actions
  openWidget: () => void
  closeWidget: () => void
  toggleWidget: () => void

  fetchPlan: (studentName: string) => Promise<void>
  fetchMessages: () => Promise<void>
  sendMessage: (text: string) => Promise<void>
  completeMission: (missionId: string) => Promise<void>

  getCompletedCount: () => number
  getTotalCount: () => number
  getRemainingMinutes: () => number
}

export const useCoachStore = create<CoachState>()(
  persist(
    (set, get) => ({
      // Initial state
      isOpen: false,
      hasOpenedToday: false,
      lastOpenDate: null,
      unreadCount: 0,
      dailyPlan: null,
      messages: [],
      isTyping: false,
      typingPersona: null,

      openWidget: () => {
        const today = new Date().toISOString().split('T')[0]
        set({ isOpen: true, unreadCount: 0, hasOpenedToday: true, lastOpenDate: today })
      },

      closeWidget: () => set({ isOpen: false }),

      toggleWidget: () => {
        const { isOpen } = get()
        if (isOpen) get().closeWidget()
        else get().openWidget()
      },

      fetchPlan: async (studentName: string) => {
        const plan = await coachApi.fetchTodayPlan(studentName)
        const messages = await coachApi.fetchMessages()
        const today = new Date().toISOString().split('T')[0]
        const isNewDay = get().lastOpenDate !== today

        set({
          dailyPlan: plan,
          messages,
          unreadCount: isNewDay ? plan.missions.filter(m => m.status === 'pending').length : get().unreadCount,
        })
      },

      fetchMessages: async () => {
        const messages = await coachApi.fetchMessages()
        set({ messages })
      },

      sendMessage: async (text: string) => {
        // Add student message immediately
        const tempStudentMsg: ChatMessage = {
          id: `temp-${Date.now()}`,
          sender: 'student',
          type: 'text',
          content: text,
          createdAt: new Date().toISOString(),
        }
        set(s => ({ messages: [...s.messages, tempStudentMsg] }))

        // Show typing indicator
        set({ isTyping: true, typingPersona: 'bot' })

        // Simulate delay (2-6 seconds for "team" feel)
        const delay = 2000 + Math.random() * 4000
        await new Promise(resolve => setTimeout(resolve, delay))

        const result = await coachApi.sendMessage(text)

        set({ isTyping: false, typingPersona: null })

        // Replace temp message + add responses
        set(s => {
          const msgs = s.messages.filter(m => m.id !== tempStudentMsg.id)
          msgs.push(result.studentMessage)
          if (result.systemUpdate) msgs.push(result.systemUpdate)
          msgs.push(result.botReply)
          return {
            messages: msgs,
            dailyPlan: result.systemUpdate ? s.dailyPlan : s.dailyPlan, // plan already updated in API
          }
        })

        // Re-fetch plan if it was modified
        if (result.systemUpdate) {
          const plan = await coachApi.fetchTodayPlan('')
          set({ dailyPlan: plan })
        }
      },

      completeMission: async (missionId: string) => {
        const mission = await coachApi.completeMission(missionId)
        if (!mission) return

        // Re-fetch to get updated plan + any celebration message
        const plan = await coachApi.fetchTodayPlan('')
        const messages = await coachApi.fetchMessages()
        set({ dailyPlan: plan, messages })
      },

      getCompletedCount: () => {
        const plan = get().dailyPlan
        if (!plan) return 0
        return plan.missions.filter(m => m.status === 'completed').length
      },

      getTotalCount: () => {
        const plan = get().dailyPlan
        if (!plan) return 0
        return plan.missions.length
      },

      getRemainingMinutes: () => {
        const plan = get().dailyPlan
        if (!plan) return 0
        return plan.missions
          .filter(m => m.status !== 'completed')
          .reduce((sum, m) => sum + m.estimatedMinutes, 0)
      },
    }),
    {
      name: 'znk-coach',
      partialize: (state) => ({
        hasOpenedToday: state.hasOpenedToday,
        lastOpenDate: state.lastOpenDate,
      }),
    }
  )
)
```

- [ ] **Step 2: Verify store compiles**

Run: `npx tsc --noEmit src/stores/coachStore.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/stores/coachStore.ts
git commit -m "feat(coach): add coach Zustand store with mock API integration"
```

---

## Chunk 2: Widget UI Components

### Task 3: Create CoachFab (Floating Action Button)

**Files:**
- Create: `src/features/coach/CoachFab.tsx`

- [ ] **Step 1: Create the FAB component**

```tsx
// src/features/coach/CoachFab.tsx

import { useCoachStore } from '../../stores/coachStore'

export default function CoachFab() {
  const { isOpen, unreadCount, openWidget } = useCoachStore()

  if (isOpen) return null

  return (
    <button
      onClick={openWidget}
      className="fixed z-50 flex items-center justify-center transition-all duration-300"
      style={{
        bottom: 80,
        left: 16,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #1B3A6B, #6B3FA0)',
        border: '3px solid rgba(255,255,255,0.3)',
        boxShadow: '0 6px 24px rgba(27,58,107,0.35), 0 2px 6px rgba(0,0,0,0.15)',
      }}
      aria-label="פתח צ'אט מאמן"
    >
      <img
        src="znk-logo-clean.png"
        alt="זינוק"
        className="rounded-full"
        style={{ width: 34, height: 34 }}
      />
      {unreadCount > 0 && (
        <span
          className="absolute flex items-center justify-center text-white font-extrabold"
          style={{
            top: -3, right: -3,
            width: 22, height: 22,
            borderRadius: '50%',
            background: '#E91E78',
            fontSize: 11,
            border: '2px solid #E0E5EC',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          {unreadCount}
        </span>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/coach/CoachFab.tsx
git commit -m "feat(coach): add floating action button component"
```

---

### Task 4: Create Chat Message Components

**Files:**
- Create: `src/features/coach/ChatBubble.tsx`
- Create: `src/features/coach/SystemMessage.tsx`
- Create: `src/features/coach/TypingIndicator.tsx`
- Create: `src/features/coach/MissionCard.tsx`

- [ ] **Step 1: Create ChatBubble**

```tsx
// src/features/coach/ChatBubble.tsx

import type { ChatMessage } from '../../services/mockCoachData'

const PERSONA_CONFIG = {
  bot: { label: 'בוט התוכנית', color: '#6B3FA0', icon: '🤖', bg: 'linear-gradient(135deg, #1B3A6B, #6B3FA0)' },
  roni: { label: 'רוני · מצוות זינוק', color: '#E65100', icon: '👩‍💻', bg: 'linear-gradient(135deg, #FFB870, #FF9A45)' },
  dana: { label: 'דנה · מצוות זינוק', color: '#6B3FA0', icon: '👨‍🎓', bg: 'linear-gradient(135deg, #6B3FA0, #4F4780)' },
} as const

interface Props {
  message: ChatMessage
}

export default function ChatBubble({ message }: Props) {
  const isStudent = message.sender === 'student'
  const isStaff = message.sender.startsWith('staff:')
  const persona = isStudent || isStaff ? null : PERSONA_CONFIG[message.sender as keyof typeof PERSONA_CONFIG]
  const staffName = isStaff ? message.sender.split(':')[1] : null
  const time = new Date(message.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`flex items-end gap-1.5 animate-fadeIn ${isStudent ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      {!isStudent && persona && (
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-full text-sm"
          style={{ width: 26, height: 26, background: persona.bg }}
        >
          {persona.icon}
        </div>
      )}
      {!isStudent && !persona && <div style={{ width: 26, flexShrink: 0 }} />}

      {/* Bubble */}
      <div
        className={`max-w-[85%] rounded-2xl text-[13px] leading-relaxed ${
          isStudent ? 'rounded-bl-sm' : 'rounded-br-sm'
        }`}
        style={{
          padding: '10px 13px',
          background: isStudent
            ? 'linear-gradient(135deg, #6B3FA0, #4F3A8B)'
            : 'white',
          color: isStudent ? 'white' : '#332F3A',
          boxShadow: isStudent
            ? '3px 3px 10px rgba(107,63,160,0.2)'
            : '3px 3px 10px rgba(130,120,160,0.08), -2px -2px 6px rgba(255,255,255,0.8)',
        }}
      >
        {/* Sender name */}
        {!isStudent && persona && (
          <div className="text-[10px] font-bold mb-0.5 opacity-70" style={{ color: persona.color }}>
            {persona.label}
          </div>
        )}
        {isStaff && (
          <div className="text-[10px] font-bold mb-0.5 opacity-70" style={{ color: '#1B3A6B' }}>
            {staffName} · מצוות זינוק
          </div>
        )}

        {/* Content */}
        <div className="whitespace-pre-line">{message.content}</div>

        {/* Time */}
        <div
          className="text-[9px] mt-0.5 opacity-50"
          style={{ color: isStudent ? 'rgba(255,255,255,0.5)' : '#635F69' }}
        >
          {time}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create SystemMessage**

```tsx
// src/features/coach/SystemMessage.tsx

import type { ChatMessage } from '../../services/mockCoachData'

interface Props {
  message: ChatMessage
}

export default function SystemMessage({ message }: Props) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl animate-fadeIn"
      style={{
        padding: '8px 12px',
        background: 'rgba(107,63,160,0.06)',
        border: '1px solid rgba(107,63,160,0.1)',
        fontSize: 11,
        color: '#635F69',
      }}
    >
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full"
        style={{
          width: 22, height: 22,
          background: 'linear-gradient(135deg, #6B3FA0, #4F3A8B)',
          fontSize: 11,
        }}
      >
        ⚙️
      </div>
      <span dangerouslySetInnerHTML={{
        __html: message.content.replace(
          /(\S+)/,
          '<strong style="color:#6B3FA0">$1</strong>'
        )
      }} />
    </div>
  )
}
```

- [ ] **Step 3: Create TypingIndicator**

```tsx
// src/features/coach/TypingIndicator.tsx

const PERSONA_BG = {
  bot: 'linear-gradient(135deg, #1B3A6B, #6B3FA0)',
  roni: 'linear-gradient(135deg, #FFB870, #FF9A45)',
  dana: 'linear-gradient(135deg, #6B3FA0, #4F4780)',
}

const PERSONA_ICON = { bot: '🤖', roni: '👩‍💻', dana: '👨‍🎓' }

interface Props {
  persona: 'bot' | 'roni' | 'dana'
}

export default function TypingIndicator({ persona }: Props) {
  return (
    <div className="flex items-center gap-1.5 animate-fadeIn">
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full text-sm"
        style={{ width: 26, height: 26, background: PERSONA_BG[persona] }}
      >
        {PERSONA_ICON[persona]}
      </div>
      <div
        className="flex gap-1 rounded-2xl bg-white"
        style={{ padding: '8px 12px', boxShadow: '2px 2px 8px rgba(130,120,160,0.08)' }}
      >
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="rounded-full"
            style={{
              width: 6, height: 6,
              background: '#635F69',
              animation: `typing 1.2s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create MissionCard**

```tsx
// src/features/coach/MissionCard.tsx

import type { Mission } from '../../services/mockCoachData'

const TYPE_STYLES: Record<string, { bg: string; iconBg: string; textColor: string; icon: string }> = {
  vocab_learn:      { bg: '#FFF0F5', iconBg: 'linear-gradient(135deg, #E91E78, #C2185B)', textColor: '#C2185B', icon: '📖' },
  vocab_practice:   { bg: '#FFF0E6', iconBg: 'linear-gradient(135deg, #FFB870, #FF9A45)', textColor: '#E65100', icon: '🎯' },
  reading:          { bg: '#F0F0FA', iconBg: 'linear-gradient(135deg, #6B3FA0, #4F4780)', textColor: '#6B3FA0', icon: '📝' },
  exam_sc:          { bg: '#ECFDF5', iconBg: 'linear-gradient(135deg, #10B981, #059669)', textColor: '#047857', icon: '✅' },
  exam_restatement: { bg: '#ECFDF5', iconBg: 'linear-gradient(135deg, #10B981, #059669)', textColor: '#047857', icon: '✅' },
}

interface Props {
  mission: Mission
  onStart: (mission: Mission) => void
}

export default function MissionCard({ mission, onStart }: Props) {
  const style = TYPE_STYLES[mission.type] || TYPE_STYLES['vocab_learn']
  const isDone = mission.status === 'completed'

  return (
    <button
      className={`flex items-center gap-2 w-full text-right rounded-xl border-none transition-all duration-200 relative ${
        isDone ? 'opacity-50 pointer-events-none' : 'active:scale-[0.97]'
      }`}
      style={{
        padding: '9px 12px',
        background: style.bg,
        fontFamily: "'Heebo', sans-serif",
        fontSize: '12.5px',
      }}
      onClick={() => !isDone && onStart(mission)}
    >
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-[10px] text-white"
        style={{ width: 30, height: 30, background: style.iconBg, fontSize: 16 }}
      >
        {style.icon}
      </div>
      <div className="flex-1 font-bold" style={{ color: style.textColor }}>
        <span className={isDone ? 'line-through decoration-emerald-500 decoration-2' : ''}>
          {mission.title}
        </span>
        <span className="text-[10px] font-normal opacity-60 block">{mission.subtitle}</span>
      </div>
      {!isDone && (
        <>
          <span className="text-[9px] font-bold text-gray-400 flex-shrink-0">~{mission.estimatedMinutes} דק׳</span>
          <span className="text-[13px] opacity-30 flex-shrink-0">←</span>
        </>
      )}
      {isDone && (
        <span
          className="absolute flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-black"
          style={{ left: 8, width: 18, height: 18 }}
        >
          ✓
        </span>
      )}
    </button>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/coach/
git commit -m "feat(coach): add chat bubble, system message, typing indicator, mission card components"
```

---

### Task 5: Create ChatInput Component

**Files:**
- Create: `src/features/coach/ChatInput.tsx`

- [ ] **Step 1: Create the input component**

```tsx
// src/features/coach/ChatInput.tsx

import { useState, useRef, type KeyboardEvent } from 'react'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 80) + 'px'
  }

  return (
    <div
      className="flex items-end gap-2 flex-shrink-0"
      style={{
        padding: '8px 12px 12px',
        borderTop: '1px solid rgba(107,63,160,0.08)',
        background: 'rgba(255,255,255,0.5)',
      }}
    >
      <div
        className="flex-1 flex items-end rounded-2xl transition-colors"
        style={{
          background: 'white',
          border: '1.5px solid rgba(107,63,160,0.15)',
          padding: '4px 6px 4px 14px',
          boxShadow: '2px 2px 8px rgba(130,120,160,0.06)',
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="כתוב הודעה לצוות..."
          rows={1}
          disabled={disabled}
          className="flex-1 border-none outline-none resize-none bg-transparent text-[13px] leading-snug"
          style={{
            fontFamily: "'Heebo', sans-serif",
            padding: '6px 0',
            maxHeight: 80,
            minHeight: 20,
            direction: 'rtl',
            color: '#332F3A',
          }}
        />
      </div>
      <button
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className="flex-shrink-0 flex items-center justify-center rounded-full text-white transition-all active:scale-90 disabled:opacity-40"
        style={{
          width: 34, height: 34,
          background: 'linear-gradient(135deg, #6B3FA0, #4F3A8B)',
          boxShadow: '0 3px 10px rgba(107,63,160,0.3)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}>
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/coach/ChatInput.tsx
git commit -m "feat(coach): add chat input component with send button"
```

---

### Task 6: Create Main CoachWidget Component

**Files:**
- Create: `src/features/coach/CoachWidget.tsx`

- [ ] **Step 1: Create the main widget that assembles all parts**

```tsx
// src/features/coach/CoachWidget.tsx

import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useCoachStore } from '../../stores/coachStore'
import { useStudentProfileStore } from '../../stores/studentProfileStore'
import CoachFab from './CoachFab'
import ChatBubble from './ChatBubble'
import SystemMessage from './SystemMessage'
import TypingIndicator from './TypingIndicator'
import MissionCard from './MissionCard'
import ChatInput from './ChatInput'
import type { Mission, ChatMessage } from '../../services/mockCoachData'

// Pages where widget is hidden (during active practice)
const HIDDEN_ROUTES = [
  '/vocabulary/games/',
  '/exam/sc', '/exam/restatement', '/exam/rc', '/exam/full/start',
  '/reading/',
]

export default function CoachWidget() {
  const navigate = useNavigate()
  const location = useLocation()
  const bodyRef = useRef<HTMLDivElement>(null)

  const studentName = useStudentProfileStore(s => s.studentName) || 'תלמיד'
  const {
    isOpen, dailyPlan, messages, isTyping, typingPersona,
    openWidget, closeWidget, fetchPlan, sendMessage, completeMission,
    getCompletedCount, getTotalCount, getRemainingMinutes,
  } = useCoachStore()

  // Hide during practice
  const isHidden = HIDDEN_ROUTES.some(r => location.pathname.includes(r))

  // Fetch plan on mount
  useEffect(() => {
    fetchPlan(studentName)
  }, [fetchPlan, studentName])

  // Auto-open on first visit of the day
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const store = useCoachStore.getState()
    if (store.lastOpenDate !== today && dailyPlan && !isHidden) {
      setTimeout(() => openWidget(), 1500)
    }
  }, [dailyPlan, openWidget, isHidden])

  // Scroll to bottom when new messages
  useEffect(() => {
    if (bodyRef.current && isOpen) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [messages, isTyping, isOpen])

  if (isHidden) return null

  const handleMissionStart = (mission: Mission) => {
    closeWidget()
    const url = mission.routeParams?.unit
      ? `${mission.route}?unit=${mission.routeParams.unit}`
      : mission.route
    navigate(url)
    // Mark complete after navigation (in staging, immediately)
    setTimeout(() => completeMission(mission.id), 500)
  }

  const completed = getCompletedCount()
  const total = getTotalCount()
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

  const renderMessage = (msg: ChatMessage) => {
    if (msg.type === 'system_update' || msg.type === 'plan_update') {
      return <SystemMessage key={msg.id} message={msg} />
    }
    if (msg.type === 'mission_card' && dailyPlan) {
      return (
        <div key={msg.id} className="flex items-end gap-1.5 animate-fadeIn">
          <div style={{ width: 26, flexShrink: 0 }} />
          <div
            className="w-full rounded-2xl bg-white"
            style={{
              padding: '11px 13px',
              boxShadow: '3px 3px 10px rgba(130,120,160,0.08), -2px -2px 6px rgba(255,255,255,0.8)',
            }}
          >
            <div className="text-[11.5px] font-bold text-gray-500 mb-1.5">
              📋 התוכנית שלך להיום · <span style={{ color: '#6B3FA0' }}>~{dailyPlan.totalMinutes} דק׳</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {dailyPlan.missions.map(m => (
                <MissionCard key={m.id} mission={m} onStart={handleMissionStart} />
              ))}
            </div>
            {/* Progress bar */}
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(107,63,160,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #6B3FA0, #E91E78)',
                  }}
                />
              </div>
              <span className="text-[11px] font-bold" style={{ color: '#6B3FA0' }}>
                {completed === total && total > 0 ? '🎉' : `${completed}/${total}`}
              </span>
            </div>
          </div>
        </div>
      )
    }
    return <ChatBubble key={msg.id} message={msg} />
  }

  return (
    <>
      {/* FAB */}
      <CoachFab />

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 transition-opacity duration-300 md:hidden"
          style={{ background: 'rgba(27, 58, 107, 0.35)' }}
          onClick={closeWidget}
        />
      )}

      {/* Sheet / Window */}
      <div
        className={`fixed z-50 flex flex-col transition-transform duration-400 ${
          isOpen ? '' : 'translate-y-full pointer-events-none md:scale-50 md:translate-y-10 md:opacity-0'
        }`}
        style={{
          // Mobile: bottom sheet
          bottom: 0, left: '50%', transform: isOpen ? 'translateX(-50%)' : 'translateX(-50%) translateY(100%)',
          width: '100%', maxWidth: 390, maxHeight: '85vh',
          background: '#E0E5EC',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 40px rgba(27,58,107,0.2)',
        }}
      >
        {/* Drag handle */}
        <div className="w-full text-center pt-2.5 pb-1 cursor-grab flex-shrink-0 md:hidden">
          <div className="inline-block w-9 h-1 rounded-full bg-black/15" />
        </div>

        {/* Header */}
        <div
          className="flex items-center gap-2.5 flex-shrink-0 mx-3 rounded-2xl"
          style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #1B3A6B, #6B3FA0)',
          }}
        >
          {/* Team avatars */}
          <div className="relative flex-shrink-0" style={{ width: 52, height: 36 }}>
            {[
              { icon: '🤖', bg: 'linear-gradient(135deg, #FFB870, #FF9A45)', right: 0, z: 3 },
              { icon: '👩‍💻', bg: 'linear-gradient(135deg, #6B3FA0, #4F4780)', right: 12, z: 2 },
              { icon: '👨‍🎓', bg: 'linear-gradient(135deg, #10B981, #059669)', right: 24, z: 1 },
            ].map((av, i) => (
              <div
                key={i}
                className="absolute flex items-center justify-center rounded-full text-base"
                style={{
                  width: 32, height: 32, top: 2, right: av.right, zIndex: av.z,
                  background: av.bg,
                  border: '2px solid rgba(255,255,255,0.3)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                }}
              >
                {av.icon}
              </div>
            ))}
          </div>
          <div className="flex-1">
            <div className="text-[13.5px] font-extrabold text-white flex items-center gap-1.5">
              צוות זינוק
              <span className="w-[7px] h-[7px] rounded-full bg-emerald-500" style={{ boxShadow: '0 0 6px rgba(16,185,129,0.5)' }} />
            </div>
            <div className="text-[10px] text-white/50">הבחינה בעוד 47 יום · יום 12 בתוכנית</div>
          </div>
          <button
            onClick={closeWidget}
            className="flex items-center justify-center rounded-full text-white text-base border-none cursor-pointer"
            style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.1)' }}
          >
            ✕
          </button>
        </div>

        {/* Chat body */}
        <div
          ref={bodyRef}
          className="flex-1 overflow-y-auto flex flex-col gap-2"
          style={{
            padding: '12px 12px 8px',
            scrollbarWidth: 'thin',
            scrollbarColor: '#C4B5FD #E0E5EC',
          }}
        >
          {messages.map(renderMessage)}
          {isTyping && typingPersona && <TypingIndicator persona={typingPersona} />}
        </div>

        {/* Team footer */}
        <div className="text-center text-[10px] text-gray-400 py-0.5">
          צוות זינוק · בוט + 2 אנשי צוות · זמן מענה ממוצע: 6 דקות
        </div>

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={isTyping} />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify all coach components compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/features/coach/CoachWidget.tsx
git commit -m "feat(coach): add main CoachWidget component with bottom sheet, chat body, and header"
```

---

## Chunk 3: Integration + Styling

### Task 7: Add CoachWidget to Shell

**Files:**
- Modify: `src/components/layout/Shell.tsx`

- [ ] **Step 1: Import and render CoachWidget in Shell**

At the top of Shell.tsx, add import:
```typescript
import CoachWidget from '../../features/coach/CoachWidget'
```

At the end of the Shell return JSX, just before the closing `</>` or `</div>`, add:
```tsx
<CoachWidget />
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Shell.tsx
git commit -m "feat(coach): integrate CoachWidget into app Shell"
```

---

### Task 8: Add Typing Animation Keyframes

**Files:**
- Modify: `src/design-system/tokens.css`

- [ ] **Step 1: Add typing animation keyframes**

Add at the end of tokens.css:
```css
/* Coach widget typing animation */
@keyframes typing {
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-3px); }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/design-system/tokens.css
git commit -m "feat(coach): add typing indicator animation keyframes"
```

---

### Task 9: Desktop Layout (Floating Window)

**Files:**
- Modify: `src/features/coach/CoachWidget.tsx`

- [ ] **Step 1: Add media query responsive behavior**

Update the sheet/window div's style to handle desktop differently. Replace the fixed style object with responsive classes:

For the main chat window div, update the className to include:
```
md:bottom-[90px] md:left-5 md:right-auto md:w-[380px] md:max-h-[560px] md:rounded-3xl md:translate-y-0
```

And add `md:hidden` to the backdrop div and drag handle so they only show on mobile.

The desktop version renders as a floating window (bottom-left, 380px wide, rounded corners) while mobile stays as a bottom sheet.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/features/coach/CoachWidget.tsx
git commit -m "feat(coach): add desktop floating window layout"
```

---

### Task 10: Brand Colors Integration

**Files:**
- Modify: `src/design-system/tokens.css`

- [ ] **Step 1: Add ZNK coach brand variables**

Add to tokens.css `:root` block:
```css
/* ZNK Coach brand colors (from logo) */
--znk-navy: #1B3A6B;
--znk-pink: #E91E78;
--znk-yellow: #F5B731;
--znk-purple: #6B3FA0;
--znk-coach-bg: #E0E5EC;
```

- [ ] **Step 2: Commit**

```bash
git add src/design-system/tokens.css
git commit -m "feat(coach): add ZNK brand color variables to design tokens"
```

---

### Task 11: Final Build + Smoke Test

**Files:** None (verification only)

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: No errors, no warnings

- [ ] **Step 2: Start dev server and verify widget appears**

Run: `npm run dev`
Expected: App loads, FAB visible on home page bottom-left, clicking opens bottom sheet with mock daily plan and chat

- [ ] **Step 3: Commit all remaining changes**

```bash
git add -A
git commit -m "feat(coach): complete staging coach widget with mock API"
```

---

## Summary

| Task | Component | Files |
|------|-----------|-------|
| 1 | Mock API Service | `src/services/coachApi.ts`, `src/services/mockCoachData.ts` |
| 2 | Coach Store | `src/stores/coachStore.ts` |
| 3 | FAB Button | `src/features/coach/CoachFab.tsx` |
| 4 | Chat Components | `ChatBubble.tsx`, `SystemMessage.tsx`, `TypingIndicator.tsx`, `MissionCard.tsx` |
| 5 | Chat Input | `src/features/coach/ChatInput.tsx` |
| 6 | Main Widget | `src/features/coach/CoachWidget.tsx` |
| 7 | Shell Integration | `src/components/layout/Shell.tsx` (modify) |
| 8 | Animations | `src/design-system/tokens.css` (modify) |
| 9 | Desktop Layout | `CoachWidget.tsx` (modify) |
| 10 | Brand Colors | `tokens.css` (modify) |
| 11 | Final Verification | Build + smoke test |

**Total new files:** 8
**Modified files:** 2
**Estimated tasks:** 11

**Next phase (after staging approval):** WordPress plugin + real Claude API integration.
