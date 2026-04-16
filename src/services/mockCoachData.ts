// src/services/mockCoachData.ts
// ─── Types, mock data, intelligent response routing, and security utilities ───

// ── Security ──────────────────────────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 500
const MAX_MESSAGES_PER_HOUR = 30

/** Sanitize user input: trim, limit length, strip control characters */
export function sanitizeInput(text: string): string {
  return text
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH)
    // Remove control chars except newlines
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Collapse excessive newlines
    .replace(/\n{3,}/g, '\n\n')
}

/** Check rate limiting (returns true if allowed) */
export function checkRateLimit(): boolean {
  const key = 'znk-coach-rate'
  try {
    const raw = localStorage.getItem(key)
    const now = Date.now()
    let timestamps: number[] = raw ? JSON.parse(raw) : []
    // Keep only last hour
    timestamps = timestamps.filter(t => now - t < 3600_000)
    if (timestamps.length >= MAX_MESSAGES_PER_HOUR) return false
    timestamps.push(now)
    localStorage.setItem(key, JSON.stringify(timestamps))
    return true
  } catch {
    return true // fail open on storage errors
  }
}

/** Escape HTML entities for safe rendering */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Mission {
  id: string
  type: 'vocab_flashcards' | 'vocab_wordhack' | 'vocab_adaptive' | 'vocab_learn' | 'vocab_gravity' | 'vocab_practice' | 'reading' | 'exam_sc' | 'exam_restatement'
  title: string
  subtitle: string
  estimatedMinutes: number
  route: string  // where to navigate
  routeParams?: Record<string, string>
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'locked'
  completedAt?: string
  /** Index for progressive unlocking — lower unlocks first */
  unlockOrder?: number
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

// ── Off-hours detection ───────────────────────────────────────────────────────
// Sun-Thu: no responses after 22:00
// Friday: no responses after 13:00
// Saturday: no responses until 20:00

export function isOffHours(): boolean {
  const now = new Date()
  const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
  const day = israelTime.getDay() // 0=Sun, 6=Sat
  const hour = israelTime.getHours()

  // Saturday: off until 20:00
  if (day === 6 && hour < 20) return true
  // Friday: off after 13:00
  if (day === 5 && hour >= 13) return true
  // Sun-Thu: off after 22:00
  if (day >= 0 && day <= 4 && hour >= 22) return true

  return false
}

/** Get next available time as a human-readable Hebrew string */
export function getNextAvailableTime(): string {
  const now = new Date()
  const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
  const day = israelTime.getDay()
  const hour = israelTime.getHours()

  if (day === 6 && hour < 20) return 'מוצ״ש אחרי 20:00'
  if (day === 5 && hour >= 13) return 'מוצ״ש אחרי 20:00'
  // Weeknight after 22:00
  return 'מחר בבוקר'
}

/** Get time-appropriate greeting based on Israel time */
export function getTimeGreeting(): { greeting: string; emoji: string } {
  const now = new Date()
  const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
  const hour = israelTime.getHours()

  if (hour >= 5 && hour < 12) return { greeting: 'בוקר טוב', emoji: '☀️' }
  if (hour >= 12 && hour < 17) return { greeting: 'צהריים טובים', emoji: '🌤️' }
  if (hour >= 17 && hour < 21) return { greeting: 'ערב טוב', emoji: '🌆' }
  return { greeting: 'לילה טוב', emoji: '🌙' }
}

// ── Response delay calculation (staging mock) ─────────────────────────────────
// Research-based timing for human-like feel:
// - Real customer support: avg 2-10 minutes for first response
// - Chat apps: "typing" indicator shown 5-30 seconds feels natural
// - In staging we compress: bot=2-4s, personas=15-45s
// - In production with Claude API: bot=2-4s, personas=2-10 min real delay

export type ResponseTiming = {
  /** Delay in ms before showing typing indicator */
  preTypingDelay: number
  /** Duration of typing indicator in ms */
  typingDuration: number
  /** Total delay = preTypingDelay + typingDuration */
  totalDelay: number
}

/** Calculate realistic response delay based on persona, message complexity, and conversation state.
 *  First response from a persona takes longer (they need to "notice" the message).
 *  Once a conversation is going, they respond faster (they're already engaged). */
export function calculateResponseDelay(
  persona: 'bot' | 'roni' | 'dana',
  messageLength: number,
  recentMessages?: ChatMessage[],
): ResponseTiming {
  if (persona === 'bot') {
    // Bot is instant — 1.5-3s total (typing indicator for realism)
    const typingDuration = 1500 + Math.random() * 1500
    return { preTypingDelay: 0, typingDuration, totalDelay: typingDuration }
  }

  // Check if this persona has already responded recently (= active conversation)
  const hasActiveConversation = recentMessages
    ? recentMessages.slice(-8).some(m => m.sender === persona)
    : false

  if (hasActiveConversation) {
    // Already in conversation — respond faster (3-8s staging / 30s-2min production)
    const readingTime = Math.min(messageLength * 15, 2000)  // quick read
    const thinkingTime = 1500 + Math.random() * 3000         // 1.5-4.5s think
    const typingDuration = 2000 + Math.random() * 3000        // 2-5s typing
    const preTypingDelay = readingTime + thinkingTime
    return { preTypingDelay, typingDuration, totalDelay: preTypingDelay + typingDuration }
  }

  // First response — takes longer (15-45s staging / 2-10min production)
  // They need to "notice" the message, read context, think, then type
  const readingTime = Math.min(messageLength * 30, 5000) // up to 5s to "read"
  const thinkingTime = 8000 + Math.random() * 15000      // 8-23s to "think"
  const typingDuration = 3000 + Math.random() * 4000       // 3-7s "typing"
  const preTypingDelay = readingTime + thinkingTime

  return {
    preTypingDelay,
    typingDuration,
    totalDelay: preTypingDelay + typingDuration,
  }
}

// ── Student context for intelligent responses ─────────────────────────────────

export interface StudentContext {
  name: string
  gender: 'male' | 'female' | null
  englishLevel: string | null
  vocabElo: number
  readingElo: number
  examElo: number
  currentCombo: number
  bestCombo: number
  totalReadingMinutes: number
  weeklyGoalWords: number
  weeklyGoalPractice: number
  recentVocabAccuracy: number | null   // 0-1
  recentExamAccuracy: number | null    // 0-1
  recentReadingAccuracy: number | null // 0-1
  diagnosticScore: number | null
}

/** Read student context from localStorage stores */
export function getStudentContext(): StudentContext {
  try {
    const raw = localStorage.getItem('amirnet-student-profile')
    if (!raw) return defaultContext()
    const parsed = JSON.parse(raw)
    const state = parsed?.state || parsed
    const calcAccuracy = (results: boolean[] | undefined) => {
      if (!results || results.length === 0) return null
      return results.filter(Boolean).length / results.length
    }
    return {
      name: state.studentName || 'תלמיד',
      gender: state.gender || null,
      englishLevel: state.englishLevel || null,
      vocabElo: state.vocabElo || 1000,
      readingElo: state.readingElo || 1000,
      examElo: state.examElo || 1000,
      currentCombo: state.currentCombo || 0,
      bestCombo: state.bestCombo || 0,
      totalReadingMinutes: state.totalReadingMinutes || 0,
      weeklyGoalWords: state.weeklyGoalWords || 30,
      weeklyGoalPractice: state.weeklyGoalPractice || 3,
      recentVocabAccuracy: calcAccuracy(state.recentVocabResults),
      recentExamAccuracy: calcAccuracy(state.recentExamResults),
      recentReadingAccuracy: calcAccuracy(state.recentReadingResults),
      diagnosticScore: state.diagnosticScore || null,
    }
  } catch {
    return defaultContext()
  }
}

function defaultContext(): StudentContext {
  return {
    name: 'תלמיד', gender: null, englishLevel: null,
    vocabElo: 1000, readingElo: 1000, examElo: 1000,
    currentCombo: 0, bestCombo: 0, totalReadingMinutes: 0,
    weeklyGoalWords: 30, weeklyGoalPractice: 3,
    recentVocabAccuracy: null, recentExamAccuracy: null, recentReadingAccuracy: null,
    diagnosticScore: null,
  }
}

// ── Escalation detection ──────────────────────────────────────────────────────
// When to stop AI and flag for real human review

export type EscalationReason =
  | 'explicit_request'    // Student asked for a real person
  | 'repeated_frustration' // 3+ negative messages in recent history
  | 'technical_issue'     // Bug report, payment, access problem
  | 'sensitive_topic'     // Personal issues beyond study scope
  | 'complaint'           // Formal complaint about service

export function detectEscalation(
  text: string,
  recentMessages: ChatMessage[],
): EscalationReason | null {
  const lower = text.toLowerCase()

  // Explicit request for human
  if (
    lower.includes('אדם אמיתי') || lower.includes('נציג אמיתי') ||
    lower.includes('בן אדם') || lower.includes('מנהל') ||
    lower.includes('תעביר אותי') || lower.includes('אני רוצה לדבר עם')
  ) {
    return 'explicit_request'
  }

  // Technical / payment / access issues
  if (
    lower.includes('באג') || lower.includes('bug') ||
    lower.includes('תשלום') || lower.includes('כסף') || lower.includes('חיוב') ||
    lower.includes('סיסמה') || lower.includes('לא מצליח להיכנס') ||
    lower.includes('שגיאה') || lower.includes('לא עובד') || lower.includes('תקוע') ||
    lower.includes('החשבון שלי') || lower.includes('מנוי')
  ) {
    return 'technical_issue'
  }

  // Complaint
  if (
    lower.includes('תלונה') || lower.includes('לא מקצועי') ||
    lower.includes('שירות גרוע') || lower.includes('מאוכזב') ||
    lower.includes('אני רוצה החזר') || lower.includes('רימיתם')
  ) {
    return 'complaint'
  }

  // Sensitive personal topics
  if (
    lower.includes('חרדה') || lower.includes('דיכאון') ||
    lower.includes('פאניקה') || lower.includes('לחץ נפשי') ||
    lower.includes('אני לא בסדר') || lower.includes('אני רוצה לוותר על הכל')
  ) {
    return 'sensitive_topic'
  }

  // Repeated frustration: check if 3+ of last 6 student messages contain negative sentiment
  const recentStudentMsgs = recentMessages
    .filter(m => m.sender === 'student')
    .slice(-6)
  const frustrationWords = ['קשה', 'לא מבין', 'לא מצליח', 'נמאס', 'עצבני', 'מתסכל', 'כועס', 'עוזב', 'לא עוזר', 'חרא']
  const negativeCount = recentStudentMsgs.filter(m =>
    frustrationWords.some(w => m.content.toLowerCase().includes(w))
  ).length
  if (negativeCount >= 3) return 'repeated_frustration'

  return null
}

// ── Response routing: who responds to what ────────────────────────────────────
//
// ROLE DIVISION (research-based):
//
// BOT (instant, 2-4s) — System/operational:
//   • Daily plan generation & schedule changes
//   • Progress stats, Elo ratings, accuracy reports
//   • Mission tracking, XP, streaks, combo info
//   • Site navigation help (where to find features)
//   • Account info, settings questions
//   • Greetings, generic acknowledgments
//
// RONI (delayed, 15-45s staging / 2-5 min production) — Learning coach:
//   • Emotional support, motivation, encouragement
//   • Study strategy & habit advice
//   • Difficulty complaints, frustration handling
//   • Schedule/workload adjustment conversations
//   • "I'm bored/tired/overwhelmed" messages
//   • General learning methodology questions
//
// DANA (delayed, 15-45s staging / 3-8 min production) — Content expert:
//   • Vocabulary: word meanings, usage, etymology
//   • Exam strategy: SC tips, restatement tricks, RC approaches
//   • How to solve specific question types
//   • English grammar/language questions
//   • Content explanations, examples
//   • Reading comprehension strategies
//
// ESCALATION → Real staff:
//   • Technical issues, bugs, payment
//   • Explicit request for human
//   • Repeated frustration (3+ negative in row)
//   • Complaints, sensitive personal topics

export type ResponseCategory =
  | 'schedule'       // time/plan changes → bot
  | 'progress'       // stats/progress questions → bot
  | 'navigation'     // site/feature questions → bot
  | 'greeting'       // hi/thanks/bye → bot
  | 'difficulty'     // hard/struggling → roni
  | 'motivation'     // bored/tired/overwhelmed → roni
  | 'study_strategy' // how to study → roni
  | 'vocab_question' // word meaning/usage → dana
  | 'exam_strategy'  // exam tips → dana
  | 'content_help'   // how to solve, grammar → dana
  | 'escalation'     // needs real human → roni (with flag)
  | 'off_hours'      // message during off hours → bot (queue notice)
  | 'general'        // catch-all → roni

export interface RoutedResponse {
  persona: 'bot' | 'roni' | 'dana'
  response: string
  category: ResponseCategory
  shouldEscalate: boolean
  escalationReason?: EscalationReason
}

/** Detect the active persona — who was last handling this student's conversation */
function getActivePersona(recentMessages: ChatMessage[]): 'roni' | 'dana' | null {
  // Look at last 6 messages for an active persona conversation
  const recent = recentMessages.slice(-6)
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i]
    if (m.sender === 'roni' || m.sender === 'dana') return m.sender
    // If student replied after a persona, that persona is still active
    if (m.sender === 'student' && i > 0) continue
  }
  return null
}

export function routeAndRespond(
  text: string,
  ctx: StudentContext,
  recentMessages: ChatMessage[],
): RoutedResponse {
  const lower = text.toLowerCase()

  // ── Check escalation ──
  const escalation = detectEscalation(text, recentMessages)
  if (escalation) {
    return buildEscalationResponse(escalation, ctx)
  }

  // ── Persona stickiness: if a persona started handling, they continue ──
  const activePersona = getActivePersona(recentMessages)

  // ── Conversation continuation: if Roni's last message was a question, treat student's reply as continuation ──
  // NOTE: The current student message has ALREADY been pushed to recentMessages,
  // so we need to look at the SECOND-TO-LAST message (the one before current student msg)
  const msgsBeforeCurrent = recentMessages.slice(0, -1) // exclude current student message
  const lastRoniMsg = [...msgsBeforeCurrent].reverse().find(m => m.sender === 'roni')
  const lastMsgBeforeCurrent = msgsBeforeCurrent[msgsBeforeCurrent.length - 1]
  const isReplyToRoni = lastRoniMsg && lastMsgBeforeCurrent && lastMsgBeforeCurrent.sender === 'roni'

  if (isReplyToRoni && lastRoniMsg) {
    const roniAsked = lastRoniMsg.content.toLowerCase()
    // Roni was probing — asked any question or made a statement that invites a reply
    const roniWasProbing = roniAsked.includes('מה קורה') || roniAsked.includes('מה גרם') ||
      roniAsked.includes('עייפות') || roniAsked.includes('מה בדיוק') ||
      roniAsked.includes('שמעתי אותך') || roniAsked.includes('בלי לחץ') ||
      roniAsked.includes('אפשר לשאול') || roniAsked.includes('ספר לי') ||
      roniAsked.includes('ספרי לי') || roniAsked.includes('מה הכי') ||
      roniAsked.includes('מה קשה') || roniAsked.includes('אני כאן') ||
      roniAsked.endsWith('?')

    if (roniWasProbing) {
      // Student is answering Roni's question — analyze their answer
      const realBarrierWords = ['עבודה', 'משמרת', 'חולה', 'רופא', 'טיול', 'מסיבה', 'חתונה',
        'נסיעה', 'מילואים', 'אירוע', 'בית ספר', 'מבחן', 'מבחנים', 'שיעור', 'חוג']
      const emotionalWords = ['עייף', 'עייפות', 'לחוץ', 'לחץ', 'חרדה', 'פחד', 'מפחד',
        'עצוב', 'דיכאון', 'בודד', 'נמאס', 'שחיקה', 'מותש',
        'אין כוח', 'אין כח', 'אין לי כוח', 'אין לי כח', 'לא בא לי',
        'לא בכיף', 'לא בכייף', 'לא במוד', 'תעוף', 'לא רוצה']
      const hasRealBarrier = realBarrierWords.some(w => lower.includes(w))
      const hasEmotional = emotionalWords.some(w => lower.includes(w))

      if (hasRealBarrier) {
        // Real barrier identified — empathize and adapt plan
        return {
          persona: 'roni',
          response: `${ctx.name}, משמרת כפולה זה באמת עומס. ${g('אתה', 'את', ctx.gender)} לא ${g('צריך', 'צריכה', ctx.gender)} להרגיש רע על זה.\n\nאני ${g('מוריד', 'מורידה', ctx.gender)} את המשימות הכבדות ושומרת רק את הקל ביותר. מחר, כש${g('תהיה', 'תהיי', ctx.gender)} יותר ${g('פנוי', 'פנויה', ctx.gender)}, נחזור לקצב רגיל.\n\nתנוח ${g('אחי', 'אחותי', ctx.gender)} 💙\n\nתרגול_מותאם`,
          category: 'schedule',
          shouldEscalate: false,
        }
      }

      if (hasEmotional) {
        // "No energy" / procrastination signals → route to negotiation (Round 1+ via LLM)
        const noEnergySignals = ['אין כוח', 'אין כח', 'לא בא לי', 'לא בכיף', 'לא במוד', 'לא רוצה']
        const isNoEnergy = noEnergySignals.some(s => lower.includes(s))
        if (isNoEnergy) {
          // Route to Roni negotiation (LLM will handle this with empathy + probing)
          return {
            persona: 'roni',
            response: buildTimeNegotiationResponse(lower, ctx, recentMessages),
            category: 'difficulty', // NOT 'schedule' — prevents mission card from appearing
            shouldEscalate: false,
          }
        }

        // Deeper emotional distress (anxiety, depression, loneliness) — validate, don't negotiate
        return {
          persona: 'roni',
          response: `${ctx.name}, שמעתי ${g('אותך', 'אותך', ctx.gender)}. ${lower.includes('לחוץ') || lower.includes('חרדה') ? 'לחץ זה דבר אמיתי ואני לא מזלזלת בזה.' : 'זה מובן לגמרי.'}\n\nהלמידה תחכה — ${g('אתה', 'את', ctx.gender)} קודם. אם ${g('תרגיש', 'תרגישי', ctx.gender)} שמשהו יותר גדול קורה, אני פה לשמוע. 💙`,
          category: 'difficulty',
          shouldEscalate: false,
        }
      }

      // General reply to Roni's probing — route to Roni for personalized LLM response
      return {
        persona: 'roni',
        response: buildTimeNegotiationResponse(lower, ctx, recentMessages),
        category: 'difficulty', // NOT 'schedule' — prevents mission card from appearing
        shouldEscalate: false,
      }
    }
  }

  // ── Bot-only routes (always bot, 24/7 — regardless of off-hours) ──

  // "Can't practice" / "no time" / "busy" → Roni negotiation (NOT bot — don't give up easily)
  const cantPracticeSignals = [
    'לא מספיק', 'אין לי זמן', 'אין זמן', 'עסוק', 'לא יכול', 'אירוע',
    'לא פנוי', 'אין כוח', 'אין כח', 'אין לי כוח', 'אין לי כח',
    'לא בא לי', 'מחר', 'לא היום', 'לדלג',
    'לבטל', 'לוותר', 'לא רוצה', 'לא אספיק', 'אי אפשר היום',
    'לא יכולה', 'לא רוצה לתרגל', 'לא בכיף', 'לא בכייף', 'לא במוד',
  ]
  const isCantPractice = cantPracticeSignals.some(s => lower.includes(s))
  if (isCantPractice && !lower.includes('מה לתרגל')) {
    return {
      persona: 'roni',
      response: buildTimeNegotiationResponse(lower, ctx, recentMessages),
      category: 'schedule',
      shouldEscalate: false,
    }
  }

  // ── Request to add a specific mission type ("תן לי משימת קריאה נוספת") ──
  // Must be BEFORE generic 'משימ' handler to prevent falling through
  {
    const addIndicators = ['תן לי', 'תני לי', 'הוסיפ', 'הוסף', 'עוד', 'נוסף', 'נוספ', 'אני רוצה', 'אפשר עוד']
    const hasAddIntent = addIndicators.some(s => lower.includes(s))
    if (hasAddIntent) {
      if (lower.includes('קריאה') || lower.includes('קטע') || lower.includes('reading')) {
        return {
          persona: 'bot',
          response: `בטח! 📖 הוספתי משימת קריאה לתוכנית שלך.\n${g('לחץ', 'לחצי', ctx.gender)} על המשימה החדשה כדי להתחיל!\n\nהוספת_משימה_קריאה`,
          category: 'schedule',
          shouldEscalate: false,
        }
      }
      if (lower.includes('בחינה') || lower.includes('מבחן') || lower.includes('שאלות בחינה')) {
        return {
          persona: 'bot',
          response: `בטח! 📝 הוספתי משימת בחינה לתוכנית שלך.\n${g('לחץ', 'לחצי', ctx.gender)} על המשימה החדשה כדי להתחיל!\n\nהוספת_משימה_בחינה`,
          category: 'schedule',
          shouldEscalate: false,
        }
      }
      if (lower.includes('מילים') || lower.includes('אוצר') || lower.includes('כרטיסיות')) {
        return {
          persona: 'bot',
          response: `בטח! 🔤 הוספתי משימת אוצר מילים לתוכנית שלך.\n${g('לחץ', 'לחצי', ctx.gender)} על המשימה החדשה כדי להתחיל!\n\nהוספת_משימה_מילים`,
          category: 'schedule',
          shouldEscalate: false,
        }
      }
    }
  }

  // Informational schedule/plan questions → Bot (instant)
  if (
    lower.includes('לשנות את התוכנית') ||
    lower.includes('תוכנית') || lower.includes('משימ') ||
    lower.includes('כמה זמן') || lower.includes('מתי') ||
    lower.includes('לתרגל') || lower.includes('מה לעשות') || lower.includes('מה עושים') ||
    lower.includes('מה יש היום') || lower.includes('מה להיום') ||
    lower.includes('מה התוכנית') || lower.includes('מה לי היום') ||
    lower.includes('במה להתחיל') || lower.includes('איפה מתחיל') ||
    lower.includes('מה הצעד הבא') || lower.includes('המשך') ||
    /\d+\s*דק/.test(lower) || lower.includes('לשנות את הזמן')
  ) {
    return { persona: 'bot', response: buildScheduleResponse(lower, ctx), category: 'schedule', shouldEscalate: false }
  }

  // Progress/stats → Bot (instant)
  if (
    lower.includes('התקדמות') || lower.includes('ציון') || lower.includes('דירוג') ||
    lower.includes('רמה') || lower.includes('סטטיסטיק') || lower.includes('כמה מילים') ||
    lower.includes('xp') || lower.includes('ניקוד') || lower.includes('streak') ||
    lower.includes('רצף') || lower.includes('קומבו') || lower.includes('elo')
  ) {
    return { persona: 'bot', response: buildProgressResponse(ctx), category: 'progress', shouldEscalate: false }
  }

  // Navigation/site help → Bot (instant)
  if (
    lower.includes('איפה') || lower.includes('איך מגיע') || lower.includes('איך אני') ||
    lower.includes('כפתור') || lower.includes('תפריט') || lower.includes('דף') ||
    lower.includes('אתר') || lower.includes('אפליקציה') || lower.includes('פיצ\'ר') ||
    lower.includes('מה יש') || lower.includes('מה אפשר')
  ) {
    return { persona: 'bot', response: buildNavigationResponse(lower), category: 'navigation', shouldEscalate: false }
  }

  // Greetings → Bot (instant)
  if (
    lower.match(/^(היי|הי|שלום|בוקר טוב|ערב טוב|מה קורה|מה נשמע|תודה|תודה רבה|ביי|להתראות|יאללה)[\s!?.]*$/)
  ) {
    return { persona: 'bot', response: buildGreetingResponse(lower, ctx), category: 'greeting', shouldEscalate: false }
  }

  // Quick action: "פירוש מילה?" → Bot asks which word
  if (lower.match(/^פירוש מילה\??$/)) {
    return {
      persona: 'bot',
      response: `מה המילה ש${g('אתה רוצה', 'את רוצה', ctx.gender)} לדעת?\n${g('כתוב', 'כתבי', ctx.gender)} אותה באנגלית, או ${g('צלם', 'צלמי', ctx.gender)} טקסט עם כפתור המצלמה 📷\nאני אחפש ${g('לך', 'לך', ctx.gender)} תרגום, משפט לדוגמא, ואפילו אוסיף אותה לתרגול 📖`,
      category: 'vocab_question',
      shouldEscalate: false,
    }
  }

  // Quick action: "יש לי בעיה" → Roni probes (VPSE: validate + probe)
  if (lower.match(/^יש לי בעיה\s*$/)) {
    return {
      persona: 'roni',
      response: `${ctx.name}, אני כאן. ${g('ספר', 'ספרי', ctx.gender)} לי — מה קורה?`,
      category: 'difficulty',
      shouldEscalate: false,
    }
  }

  // ── Off-hours: only for persona messages (bot handles schedule/dictionary/progress 24/7) ──
  // If we got here, it means no bot-only route matched — this will go to Roni/Dana.
  // During off-hours, acknowledge and promise follow-up.
  if (isOffHours()) {
    const nextTime = getNextAvailableTime()
    return {
      persona: 'bot',
      response: `קיבלתי את ההודעה שלך! 📩\nהצוות שלנו יחזור אליך ${nextTime}.\nבינתיים, התוכנית היומית שלך ממשיכה לפעול כרגיל — אפשר להמשיך לתרגל! 💪`,
      category: 'off_hours',
      shouldEscalate: false,
    }
  }

  // ── Difficulty/emotional messages → Always Roni first (VPSE: validate + probe) ──
  // If the PRIMARY intent is expressing difficulty, route to Roni even if content area is mentioned
  const difficultySignals = ['מתקשה', 'קשה לי', 'לא מבין', 'לא מצליח', 'נתקע', 'מתסכל', 'קשות', 'קשה']
  const isDifficultyMessage = difficultySignals.some(s => lower.includes(s))
  if (isDifficultyMessage) {
    return {
      persona: 'roni',
      response: buildDifficultyResponse(lower, ctx),
      category: 'difficulty',
      shouldEscalate: false,
    }
  }

  // ── Determine which persona SHOULD handle this by topic ──
  const topicPersona = getTopicPersona(lower)
  const category = classifyMessage(lower)

  // ── Persona stickiness: only within their domain ──
  // If active persona matches the topic domain → they continue
  // If topic clearly belongs to the OTHER persona → hand off
  // If topic is ambiguous/general → active persona continues
  if (activePersona) {
    if (topicPersona === null || topicPersona === activePersona) {
      // Same domain or ambiguous → active persona continues
      return {
        persona: activePersona,
        response: buildActionableResponse(lower, ctx, activePersona, category),
        category,
        shouldEscalate: false,
      }
    }
    // Different domain → hand off to the right persona
    return {
      persona: topicPersona,
      response: buildActionableResponse(lower, ctx, topicPersona, category),
      category,
      shouldEscalate: false,
    }
  }

  // ── No active persona — route by detected topic ──
  const persona = topicPersona || 'roni' // default to roni
  return {
    persona,
    response: buildActionableResponse(lower, ctx, persona, category),
    category,
    shouldEscalate: false,
  }
}

/** Determine which persona should handle a topic (null = ambiguous/general) */
function getTopicPersona(lower: string): 'dana' | 'roni' | null {
  // Dana: vocabulary, content, exam strategy, grammar, word meanings
  if (
    lower.includes('מה זה') || lower.includes('מה המילה') || lower.includes('פירוש') ||
    lower.includes('תרגום') || lower.includes('מילה') || lower.includes('אוצר מילים') ||
    lower.includes('מה ההבדל בין') || lower.includes('synonym') || lower.includes('meaning') ||
    lower.match(/\b[a-zA-Z]{2,}\b/) ||
    lower.includes('בחינה') || lower.includes('מבחן') || lower.includes('בגרות') ||
    lower.includes('ניסוח מחדש') || lower.includes('restatement') ||
    lower.includes('השלמת משפטים') || lower.includes('sentence completion') ||
    lower.includes('הבנת הנקרא') || lower.includes('reading comprehension') ||
    lower.includes('טיפ') || lower.includes('טריק') || lower.includes('שיטה') ||
    lower.includes('איך פותר') || lower.includes('איך לפתור') ||
    lower.includes('לא הבנתי את השאלה') || lower.includes('הסבר') ||
    lower.includes('דקדוק') || lower.includes('grammar') ||
    lower.includes('זמנים באנגלית') || lower.includes('tense') ||
    lower.includes('למה התשובה') || lower.includes('למה זה') ||
    lower.includes('קישור')
  ) {
    return 'dana'
  }

  // Roni: difficulty, emotions, motivation, study strategy
  if (
    lower.includes('קשה') || lower.includes('קשות') || lower.includes('לא מבין') ||
    lower.includes('לא מצליח') || lower.includes('נתקע') || lower.includes('מתקש') ||
    lower.includes('משעמם') || lower.includes('מעצבן') || lower.includes('לא מעניין') ||
    lower.includes('עייף') || lower.includes('נמאס') || lower.includes('לא בא לי') ||
    lower.includes('מותש') || lower.includes('לחוץ') ||
    lower.includes('פחד') || lower.includes('מפחיד') || lower.includes('מלחיץ') ||
    lower.includes('איך ללמוד') || lower.includes('שיטת לימוד') ||
    lower.includes('סדר יום') || lower.includes('לו"ז') || lower.includes('לוח זמנים') ||
    lower.includes('כמה שעות') || lower.includes('מתי לתרגל') ||
    lower.includes('עדיף') || lower.includes('ממליצ')
  ) {
    return 'roni'
  }

  // Ambiguous — let stickiness or default decide
  return null
}

/** Classify a message into a category */
function classifyMessage(lower: string): ResponseCategory {
  if (lower.includes('מה זה') || lower.includes('פירוש') || lower.includes('תרגום') || lower.includes('מילה') || lower.includes('מה ההבדל') || lower.match(/\b[a-zA-Z]{2,}\b/)) return 'vocab_question'
  if (lower.includes('בחינה') || lower.includes('מבחן') || lower.includes('ניסוח') || lower.includes('השלמת') || lower.includes('הבנת הנקרא') || lower.includes('טיפ')) return 'exam_strategy'
  if (lower.includes('איך פותר') || lower.includes('דקדוק') || lower.includes('הסבר') || lower.includes('למה') || lower.includes('קישור')) return 'content_help'
  if (lower.includes('קשה') || lower.includes('לא מבין') || lower.includes('לא מצליח') || lower.includes('נתקע')) return 'difficulty'
  if (lower.includes('משעמם') || lower.includes('נמאס') || lower.includes('לחוץ') || lower.includes('פחד') || lower.includes('עייף')) return 'motivation'
  if (lower.includes('איך ללמוד') || lower.includes('סדר יום') || lower.includes('עדיף') || lower.includes('ממליצ')) return 'study_strategy'
  return 'general'
}

/** Build an actionable response — with specific routes and solutions, not generic "tell me more" */
function buildActionableResponse(
  lower: string,
  ctx: StudentContext,
  persona: 'roni' | 'dana',
  category: ResponseCategory,
): string {
  // Try to find a specific action for their problem
  const action = findActionForProblemInline(lower)
  const relevantUnits = findRelevantUnitsInline(lower)

  if (persona === 'dana') {
    return buildDanaActionableResponse(lower, ctx, category, action, relevantUnits)
  }
  return buildRoniActionableResponse(lower, ctx, category, action)
}

/** Inline version of knowledge base lookup — avoids circular import */
function findActionForProblemInline(lower: string): { route: string; label: string; explanation: string } | null {
  const issues: { keywords: string[]; explanation: string; route: string; label: string }[] = [
    { keywords: ['מילות קישור', 'connectors', 'קישור'], explanation: 'מילות קישור הן הבסיס של בחינת אמירנט. הן מחולקות ליחידות 1-7 לפי סוג. הכי חשוב להתחיל מיחידה 1 (ניגוד) כי זה הנפוץ ביותר בבחינה.', route: '/vocabulary/units/1', label: 'תרגול מילות קישור — יחידה 1 (ניגוד)' },
    { keywords: ['ניסוח מחדש', 'restatement', 'ניסוח'], explanation: 'המפתח בניסוח מחדש: למצוא את המילה שמשנה את המשמעות. 80% מהשאלות בנויות על ניגוד או סיבה-תוצאה. שיטת NOT — לסלק תשובות שבטוח לא נכונות.', route: '/exam/restatement', label: 'תרגול ניסוח מחדש' },
    { keywords: ['השלמת משפטים', 'sentence completion', 'sc', 'השלמה'], explanation: 'לקרוא את כל המשפט, לזהות רמזי הקשר (but=ניגוד, because=סיבה), ולחשוב על מילה בעצמך לפני שמסתכלים על התשובות.', route: '/exam/sc', label: 'תרגול השלמת משפטים' },
    { keywords: ['הבנת הנקרא', 'reading comprehension', 'rc', 'קטע', 'קטעים'], explanation: 'לקרוא שאלות לפני הקטע, לא להיתקע על מילים לא מוכרות, ולחפש paraphrase של מה שכתוב בטקסט.', route: '/exam/rc', label: 'תרגול הבנת הנקרא' },
    { keywords: ['מילים קשות', 'לא זוכר', 'לא נשמר', 'שוכח'], explanation: 'המערכת משתמשת בחזרה מרווחת (SM-2) — מזכירה מילים בדיוק כשהמוח עומד לשכוח. מצב הצלה מתמקד במילים הכי חלשות.', route: '/vocabulary/games/rescueMode', label: 'מצב הצלה — חיזוק מילים חלשות' },
  ]
  for (const issue of issues) {
    if (issue.keywords.some(k => lower.includes(k))) {
      return { route: issue.route, label: issue.label, explanation: issue.explanation }
    }
  }
  return null
}

function findRelevantUnitsInline(lower: string): number[] {
  const units: number[] = []
  if (lower.includes('ניגוד') || lower.includes('but') || lower.includes('however') || lower.includes('although')) units.push(1)
  if (lower.includes('תוספת') || lower.includes('addition') || lower.includes('moreover')) units.push(2)
  if (lower.includes('סיבה') || lower.includes('תוצאה') || lower.includes('because') || lower.includes('therefore')) units.push(3)
  if (lower.includes('קישור') && units.length === 0) units.push(1, 2, 3)
  return [...new Set(units)]
}

function buildDanaActionableResponse(
  lower: string,
  ctx: StudentContext,
  category: ResponseCategory,
  action: { route: string; label: string; explanation: string } | null,
  relevantUnits: number[],
): string {
  // If we identified a specific problem with a solution
  if (action) {
    let response = `${action.explanation}\n\n`
    if (relevantUnits.length > 0) {
      const unitLinks = relevantUnits.map(u => `יחידה ${u}`).join(', ')
      response += `ההמלצה שלי: ${g('תתחיל', 'תתחילי', ctx.gender)} עם ${unitLinks}.\n`
    }
    response += `${g('היכנס', 'היכנסי', ctx.gender)} ל: ${action.label}`
    return response
  }

  // Category-specific actionable responses
  switch (category) {
    case 'vocab_question': {
      const englishMatch = lower.match(/\b([a-zA-Z]{2,})\b/)
      if (englishMatch) {
        const word = englishMatch[1]
        return `המילה "${word}" — ${g('חפש', 'חפשי', ctx.gender)} אותה ברשימת המילים.\nאם היא לא שם, ${g('הוסף', 'הוסיפי', ctx.gender)} אותה ל"המילים שלי" עם דוגמה למשפט — ככה היא תיכנס למערכת החזרות שלך.\n\nטיפ: כדאי לרשום מילה חדשה מיד עם משפט — ככה היא נשמרת בזיכרון.`
      }
      if (lower.includes('הבדל בין')) {
        return `הבדלים בין מילים דומות הם מהדברים הכי חשובים בבחינה.\n\n${g('ספר', 'ספרי', ctx.gender)} לי בין אילו מילים ${g('אתה מתלבט', 'את מתלבטת', ctx.gender)} ואני אפרק את ההבדלים עם דוגמאות.`
      }
      return buildVocabHelpResponse(lower, ctx)
    }
    case 'exam_strategy':
      return buildExamStrategyResponse(lower, ctx)
    case 'content_help':
      return buildContentHelpResponse(lower, ctx)
    case 'difficulty':
      // Dana can handle content-related difficulty
      return buildDifficultyResponse(lower, ctx)
    default:
      // Even for general/unknown, try to give a useful answer
      if (lower.includes('מה') || lower.includes('איך') || lower.includes('למה')) {
        return `${g('ספר', 'ספרי', ctx.gender)} לי עוד קצת על מה ${g('אתה שואל', 'את שואלת', ctx.gender)} ואני אתן הסבר מפורט.`
      }
      return `אם יש ${g('לך', 'לך', ctx.gender)} שאלה על החומר, על מילים, או על הבחינה — אני כאן לעזור. מה הנושא?`
  }
}

function buildRoniActionableResponse(
  lower: string,
  ctx: StudentContext,
  category: ResponseCategory,
  action: { route: string; label: string; explanation: string } | null,
): string {
  switch (category) {
    case 'difficulty':
      return buildDifficultyResponse(lower, ctx)
    case 'motivation':
      return buildMotivationResponse(lower, ctx)
    case 'study_strategy':
      return buildStudyStrategyResponse(lower, ctx)
    case 'vocab_question':
      // Roni shouldn't answer vocab — this should have been handed off to Dana
      // But just in case, give a useful answer
      return buildVocabHelpResponse(lower, ctx)
    case 'exam_strategy':
      return buildExamStrategyResponse(lower, ctx)
    case 'content_help':
      return buildContentHelpResponse(lower, ctx)
    default:
      if (action) {
        return `${action.explanation}\n\n${g('היכנס', 'היכנסי', ctx.gender)} ל: ${action.label}`
      }
      // Even for general — try to understand the question
      if (lower.includes('מה') || lower.includes('איך') || lower.includes('למה')) {
        return `${g('ספר', 'ספרי', ctx.gender)} לי עוד קצת ואני אוכל לעזור בצורה ממוקדת.`
      }
      return buildGeneralResponse(ctx)
  }
}

// ── Time negotiation (mental mentor approach) ────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// MI-based Mental Coach: Resistance Escalation Ladder
//
// Research: Motivational Interviewing "rolling with resistance" + CBT behavioral
// activation + Israeli dugri culture. NEVER repeat the same strategy.
//
// Round 1: Micro-commitment offer ("just 5 minutes of flashcards")
// Round 2: Validate + explore ("what's going on today?") — STOP suggesting tasks
// Round 3: Come alongside / hand back autonomy ("maybe today IS a rest day")
// Round 4+: Warm exit + plant a seed ("I noticed 12 words in yellow...")
// ══════════════════════════════════════════════════════════════════════════════

export function getResistanceRound(messages: ChatMessage[]): number {
  // Count Roni's negotiation responses in recent messages (last 6 hours, not date-based — avoids timezone issues)
  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000
  const recentMessages = messages.filter(m => new Date(m.createdAt).getTime() > sixHoursAgo)

  // Look for Roni's negotiation/resistance markers in recent messages
  const negotiationMarkers = [
    'עסקה', 'ימים כאלה', 'מה קורה', 'יום עמוס', 'בלי לחץ',
    'הבנתי', 'שמעתי', 'לא חייב', 'סבבה', 'יום מנוחה',
    'אני פה מחר', 'אני מבינה', 'לא הולך ללחוץ', 'קיבלתי',
    'לא מעלה את זה שוב', 'יום חופש', 'מכבד את זה', 'מכבדת את זה',
  ]
  let round = 0

  for (const msg of recentMessages) {
    if (msg.sender === 'roni' && negotiationMarkers.some(m => msg.content.includes(m))) {
      round++
    }
  }

  return round
}

function buildTimeNegotiationResponse(lower: string, ctx: StudentContext, messages: ChatMessage[]): string {
  // ── Check for explicit time constraint ("I have 5 minutes", "only 10 min") ──
  const timeMatch = lower.match(/(\d+)\s*דק/)
  if (timeMatch) {
    const minutes = parseInt(timeMatch[1])
    if (minutes >= 15) {
      return `${minutes} דקות זה מספיק בהחלט.\n\nאני ${g('ממליץ', 'ממליצה', ctx.gender)}: ${getSuggestedQuickTask(ctx, minutes)}\n\nמה ${g('אומר', 'אומרת', ctx.gender)}?`
    }
    if (minutes >= 5) {
      return `${minutes} דקות? אפשר לעשות עם זה משהו.\n\n${getSuggestedQuickTask(ctx, minutes)}\n\nלפעמים 5 דקות ממוקדות שוות יותר מחצי שעה בלי ריכוז. ${g('נסה', 'נסי', ctx.gender)}?`
    }
    return `${ctx.name}, ${minutes} דקות זה באמת מעט. אבל — גם 3 דקות של כרטיסיות שומרות על הרצף שלך ומחזקות את הזיכרון.\n\nמה ${g('מעדיף', 'מעדיפה', ctx.gender)} — 3 דקות של מילים, או לדלג היום?`
  }

  // ── Explicit real barrier (event, sick, appointment) ──
  const realBarrierSignals = ['אירוע', 'חולה', 'רופא', 'טיול', 'מסיבה', 'חתונה', 'נסיעה', 'מילואים']
  const hasRealBarrier = realBarrierSignals.some(s => lower.includes(s))
  if (hasRealBarrier) {
    return `${ctx.name}, לגמרי מובן.\n\nאני ${g('מוריד', 'מורידה', ctx.gender)} את המשימות שפחות דחופות ${g('לך', 'לך', ctx.gender)} ושומרת רק את מה שחשוב. מחר נחזור למלא.\n\nתרגול_מותאם`
  }

  // ── Determine resistance round — NEVER repeat the same level ──
  const round = getResistanceRound(messages)

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUND 1: Micro-commitment offer (first time saying no)
  // ═══════════════════════════════════════════════════════════════════════════
  if (round === 0) {
    const procrastinationSignals = ['לא בא לי', 'לא רוצה', 'עצלן', 'עצלנ', 'לא בא', 'חשק']
    const isProcrastination = procrastinationSignals.some(s => lower.includes(s))

    if (isProcrastination) {
      const quickTask = getSuggestedQuickTask(ctx, 5)
      return `${ctx.name}, אני מבינה. ימים כאלה קורים.\n\nאבל בוא${ctx.gender === 'female' ? 'י' : ''} נעשה עסקה — ${quickTask}\n\nאם אחרי זה עדיין לא בא ${g('לך', 'לך', ctx.gender)} — ${g('חופשי', 'חופשייה', ctx.gender)}. אבל בד"כ ברגע שמתחילים, ממשיכים. מה ${g('אומר', 'אומרת', ctx.gender)}?`
    }

    if (lower.includes('עסוק') || lower.includes('לא מספיק') || lower.includes('אין לי זמן') || lower.includes('אין זמן')) {
      return `${ctx.name}, אני שומעת. מה קורה — יום עמוס באמת, או פשוט לא ${g('מרגיש', 'מרגישה', ctx.gender)} את זה היום?`
    }

    if (lower.includes('לדלג') || lower.includes('מחר') || lower.includes('לא היום')) {
      return `${ctx.name}, לפני שמדלגים — כמה דקות ${g('פנוי', 'פנויה', ctx.gender)}? אפילו 5 דקות שומרות על הרצף ועל הזיכרון.\n\nאם באמת אי אפשר — אני אתאים את התוכנית ונמשיך מחר.`
    }

    return `${ctx.name}, בוא${ctx.gender === 'female' ? 'י' : ''} נבדוק — כמה זמן יש ${g('לך', 'לך', ctx.gender)} היום? אני אתאים את התוכנית.`
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUND 2: Validate + Explore (MI: shift from action to exploration)
  // STOP suggesting tasks. Ask what's going on underneath.
  // ═══════════════════════════════════════════════════════════════════════════
  if (round === 1) {
    const responses = [
      `${ctx.name}, שמעתי ${g('אותך', 'אותך', ctx.gender)}. בלי לחץ.\n\nאפשר לשאול — מה קורה היום? עייפות, עומס מדברים אחרים, או שמשהו ספציפי מציק?`,

      `הבנתי, ${ctx.name}. ${g('אתה', 'את', ctx.gender)} לא ${g('חייב', 'חייבת', ctx.gender)} לעשות כלום.\n\nרק מעניין אותי — זה יום קשה באופן כללי, או שמשהו בתרגול עצמו מרגיש כבד?`,

      `אוקיי, קיבלתי. אני לא ${g('הולך', 'הולכת', ctx.gender)} ללחוץ.\n\nסתם רגע — ${g('מתי', 'מתי', ctx.gender)} בפעם האחרונה ${g('תרגלת', 'תרגלת', ctx.gender)} והרגשת טוב אחרי? או שזה כבר הרבה זמן?`,
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUND 3: Coming Alongside (MI paradoxical technique)
  // Take their side. Hand back full autonomy. Trust the pendulum.
  // ═══════════════════════════════════════════════════════════════════════════
  if (round === 2) {
    const responses = [
      `${g('אתה יודע', 'את יודעת', ctx.gender)} מה, ${ctx.name}? יכול להיות שהיום באמת צריך הפסקה. וזה בסדר גמור.\n\nלמידה טובה דורשת גם ימים של מנוחה. אני ${g('פה', 'פה', ctx.gender)} מחר, בלי שום לחץ. 💙`,

      `סבבה, ${ctx.name}. היום יום מנוחה ממני.\n\nרק דבר אחד — אם בשלב כלשהו הערב פתאום בא ${g('לך', 'לך', ctx.gender)}, גם 3 דקות יספיקו. אבל בינתיים — יום טוב. 💙`,

      `${ctx.name}, אני שומעת ${g('אותך', 'אותך', ctx.gender)} ואני ${g('מכבד', 'מכבדת', ctx.gender)} את זה.\n\n${g('אתה', 'את', ctx.gender)} ${g('יודע', 'יודעת', ctx.gender)} את עצמך הכי טוב. אם ${g('אתה אומר', 'את אומרת', ctx.gender)} לא היום — אז לא היום.\nנתראה מחר? 💙`,
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUND 4+: Warm exit + plant a seed (data-driven insight)
  // Shift focus entirely. Don't mention studying. Plant a small seed.
  // ═══════════════════════════════════════════════════════════════════════════
  // Build a personalized "seed" based on student data
  let seed = ''
  if (ctx.recentVocabAccuracy !== null && ctx.recentVocabAccuracy > 0) {
    const weakWords = Math.floor((1 - ctx.recentVocabAccuracy) * 20)
    if (weakWords > 0) {
      seed = `\n\nאגב, ראיתי שיש ${g('לך', 'לך', ctx.gender)} ${weakWords} מילים שכמעט ${g('ידעת', 'ידעת', ctx.gender)} אבל עוד לא נעלו. כשתרצה — הן שם.`
    }
  }

  const responses = [
    `${ctx.name}, הבנתי לגמרי. אני לא מעלה את זה שוב היום.\n\nיום טוב, ואני פה מחר אם תרצה. 💙${seed}`,

    `סבבה ${ctx.name}. סגרנו.\n\nתדע${ctx.gender === 'female' ? 'י' : ''} שאני ${g('פה בשבילך', 'פה בשבילך', ctx.gender)} — גם ביום שלא מתרגלים.${seed}\n\nיום טוב 💙`,
  ]
  return responses[Math.floor(Math.random() * responses.length)]
}

/** Suggest a quick task based on what the student is WEAKEST at (personalized) */
function getSuggestedQuickTask(ctx: StudentContext, minutes: number): string {
  // Find weakest area based on student data
  type Area = { name: string; accuracy: number | null; task: string }
  const areas: Area[] = [
    { name: 'אוצר מילים', accuracy: ctx.recentVocabAccuracy, task: minutes >= 8 ? 'כרטיסיות מילים (4 דק׳)' : 'כרטיסיות מילים (3 דק׳)' },
    { name: 'שאלות בחינה', accuracy: ctx.recentExamAccuracy, task: minutes >= 8 ? '10 שאלות בחינה (5 דק׳)' : '5 שאלות בחינה (3 דק׳)' },
    { name: 'הבנת הנקרא', accuracy: ctx.recentReadingAccuracy, task: 'קטע קריאה קצר (5 דק׳)' },
  ]

  // Filter to tasks that fit the time
  const fitting = areas.filter(a => {
    if (a.name === 'הבנת הנקרא' && minutes < 10) return false
    return true
  })

  // Sort by weakness (null accuracy = unknown = should practice, lowest accuracy first)
  fitting.sort((a, b) => {
    const aScore = a.accuracy ?? 0
    const bScore = b.accuracy ?? 0
    return aScore - bScore
  })

  const weakest = fitting[0]
  if (!weakest) return 'רק 5 דקות של כרטיסיות מילים'

  // Personalize the suggestion with data
  const accNote = weakest.accuracy !== null
    ? ` (${weakest.name} ב-${Math.round(weakest.accuracy * 100)}% — שם כדאי לחזק)`
    : ''

  return `רק ${weakest.task}${accNote}`
}

/** Determine which mission types the student is strong at (for smart removal) */
export function getStrongMissionTypes(ctx: StudentContext): string[] {
  const strong: string[] = []
  if (ctx.recentVocabAccuracy !== null && ctx.recentVocabAccuracy >= 0.8) {
    strong.push('vocab_learn', 'vocab_practice')
  }
  if (ctx.recentExamAccuracy !== null && ctx.recentExamAccuracy >= 0.8) {
    strong.push('exam_sc', 'exam_restatement')
  }
  if (ctx.recentReadingAccuracy !== null && ctx.recentReadingAccuracy >= 0.8) {
    strong.push('reading')
  }
  return strong
}

// ── Response builders ─────────────────────────────────────────────────────────

function g(male: string, female: string, gender: 'male' | 'female' | null): string {
  return gender === 'female' ? female : male
}

function buildScheduleResponse(lower: string, ctx: StudentContext): string {
  // Explicit time amount — user wants to change daily minutes ("יש לי 20 דקות", "30 דקות")
  const minuteMatch = lower.match(/(\d+)\s*דק/)
  if (minuteMatch) {
    const min = parseInt(minuteMatch[1])
    if (min >= 5 && min <= 120) {
      // Marker: שינוי_זמן_{minutes} — coachApi.ts will actually regenerate the plan
      return `${min} דקות? סבבה! 😊 עדכנתי את התוכנית שלך.\nהנה התוכנית החדשה:\n\nשינוי_זמן_${min}`
    }
  }
  // General time-change requests (no specific number)
  if (lower.includes('זמן') || lower.includes('עסוק')) {
    return `לגמרי ${g('מבין', 'מבינה', ctx.gender)}! כמה דקות ${g('פנוי', 'פנויה', ctx.gender)} היום? ${g('תגיד', 'תגידי', ctx.gender)} לי ואני אתאים את התוכנית.`
  }

  // "What should I practice today" / "What's the plan" — show actual plan
  if (
    lower.includes('לתרגל') || lower.includes('מה לעשות') || lower.includes('מה עושים') ||
    lower.includes('מה יש היום') || lower.includes('מה להיום') || lower.includes('מה התוכנית') ||
    lower.includes('במה להתחיל') || lower.includes('מה הצעד הבא') || lower.includes('מה לי היום')
  ) {
    // Read current plan from localStorage to check completion status
    try {
      const raw = localStorage.getItem('znk-coach-data')
      if (raw) {
        const data = JSON.parse(raw)
        const plan = data?.plan as DailyPlan | null
        if (plan && plan.missions.length > 0) {
          const pending = plan.missions.filter(m => m.status !== 'completed')
          const completed = plan.missions.filter(m => m.status === 'completed')

          if (pending.length === 0) {
            return `🎉 ${g('סיימת', 'סיימת', ctx.gender)} את כל המשימות להיום! מעולה!\n\nאם ${g('רוצה', 'רוצה', ctx.gender)} להמשיך לתרגל — אפשר תמיד להיכנס למשחקי אוצר מילים או לשאלות בחינה נוספות.`
          }

          // Short text — the mission card above shows the full details
          const totalMin = pending.reduce((s, m) => s + m.estimatedMinutes, 0)
          const completedNote = completed.length > 0 ? ` (${g('סיימת', 'סיימת', ctx.gender)} ${completed.length} מתוך ${plan.missions.length})` : ''
          return `הנה התוכנית שלך 👆${completedNote}\nנשארו ${pending.length} משימות (~${totalMin} דק׳). ${g('לחץ', 'לחצי', ctx.gender)} על משימה כדי להתחיל!`
        }
      }
    } catch { /* fallback below */ }

    return `הנה התוכנית שלך 👆\n${g('לחץ', 'לחצי', ctx.gender)} על משימה כדי להתחיל!`
  }

  if (lower.includes('תוכנית') || lower.includes('משימ')) {
    return `📋 התוכנית היומית שלך כוללת משימות מותאמות אישית לפי הרמה שלך.\nאפשר תמיד לשנות — פשוט ${g('ספר', 'ספרי', ctx.gender)} לי כמה זמן ${g('פנוי', 'פנויה', ctx.gender)} היום!`
  }
  return `קיבלתי! 📋 אעדכן את התוכנית בהתאם.`
}

function buildProgressResponse(ctx: StudentContext): string {
  const parts: string[] = ['הנה סיכום ההתקדמות שלך 📊\n']

  // Elo levels
  const eloLabel = (elo: number) =>
    elo >= 1300 ? 'מתקדם 🌟' : elo >= 1000 ? 'בינוני 📈' : 'מתחיל 🌱'
  parts.push(`אוצר מילים: ${eloLabel(ctx.vocabElo)} (${ctx.vocabElo})`)
  parts.push(`שאלות בחינה: ${eloLabel(ctx.examElo)} (${ctx.examElo})`)
  parts.push(`הבנת הנקרא: ${eloLabel(ctx.readingElo)} (${ctx.readingElo})`)

  // Accuracy
  if (ctx.recentVocabAccuracy !== null) {
    parts.push(`\nדיוק אוצר מילים: ${Math.round(ctx.recentVocabAccuracy * 100)}%`)
  }
  if (ctx.recentExamAccuracy !== null) {
    parts.push(`דיוק בחינה: ${Math.round(ctx.recentExamAccuracy * 100)}%`)
  }

  // Streak
  if (ctx.currentCombo > 0) {
    parts.push(`\n🔥 רצף נוכחי: ${ctx.currentCombo} ימים`)
  }
  if (ctx.bestCombo > 0) {
    parts.push(`🏆 שיא אישי: ${ctx.bestCombo} ימים`)
  }

  // Reading
  if (ctx.totalReadingMinutes > 0) {
    parts.push(`📖 סה״כ קריאה: ${ctx.totalReadingMinutes} דקות`)
  }

  parts.push(`\nכל יום של תרגול ${g('מקרב אותך', 'מקרבת אותך', ctx.gender)} להצלחה! 💪`)
  return parts.join('\n')
}

function buildNavigationResponse(lower: string): string {
  if (lower.includes('מילים') || lower.includes('אוצר')) {
    return `📚 אוצר מילים נמצא בתפריט הראשי:\n• "למד מילים" — למידת מילים חדשות עם כרטיסיות\n• "תרגל מילים" — משחקי תרגול מגוונים\n• "כל המילים" — רשימה מלאה לפי יחידות\n• "המילים שלי" — מילים שהוספת בעצמך`
  }
  if (lower.includes('בחינה') || lower.includes('מבחן')) {
    return `📝 תרגול בחינה נמצא בתפריט הראשי:\n• השלמת משפטים (Sentence Completion)\n• ניסוח מחדש (Restatement)\n• הבנת הנקרא (Reading Comprehension)\n• סימולציית בחינה מלאה — חוויה כמו בבחינה האמיתית`
  }
  if (lower.includes('קריאה') || lower.includes('reading')) {
    return `📖 הקריאה נמצאת בתפריט הראשי:\n• ספריית קטעים — מסודר לפי רמה ונושא\n• יומן קריאה — מעקב אחרי הקריאה שלך`
  }
  if (lower.includes('סטטיסטיק') || lower.includes('התקדמות')) {
    return `📊 דף הסטטיסטיקות נמצא בתפריט הראשי — שם תראה גרפים של ההתקדמות שלך, ציונים, ורצפים.`
  }
  return `באפליקציה יש כמה חלקים עיקריים:\n📚 אוצר מילים — למידה ותרגול\n📝 תרגול בחינה — כל סוגי השאלות\n📖 קריאה — קטעים לפי רמה\n📊 סטטיסטיקות — מעקב התקדמות\n\nמה ${lower.includes('את') ? 'את מחפשת' : 'אתה מחפש'}?`
}

function buildGreetingResponse(lower: string, ctx: StudentContext): string {
  if (lower.includes('תודה')) {
    return `בכיף! 😊 אנחנו כאן ${g('בשבילך', 'בשבילך', ctx.gender)} תמיד.`
  }
  if (lower.includes('בוקר') || lower.includes('ערב') || lower.includes('שלום') || lower.includes('היי') || lower.includes('הי')) {
    const { greeting, emoji } = getTimeGreeting()
    return `${greeting}, ${ctx.name}! ${emoji} ${g('מוכן', 'מוכנה', ctx.gender)} ליום של למידה?`
  }
  if (lower.includes('ביי') || lower.includes('להתראות') || lower.includes('יאללה')) {
    return `להתראות! 👋 ${g('המשך', 'המשיכי', ctx.gender)} כך, ${g('אתה עושה', 'את עושה', ctx.gender)} עבודה מעולה! 💪`
  }
  return `היי ${ctx.name}! 😊 מה אפשר לעזור?`
}

function buildVocabHelpResponse(lower: string, ctx: StudentContext): string {
  // Check if asking about a specific English word
  const englishMatch = lower.match(/\b([a-zA-Z]{2,})\b/)

  if (lower.includes('מה זה') || lower.includes('פירוש') || englishMatch) {
    const word = englishMatch ? englishMatch[1] : ''
    if (word) {
      return `שאלה מצוינת!\n\nהמילה "${word}" — בוא${ctx.gender === 'female' ? 'י' : ''} נבדוק:\n• ${g('נסה', 'נסי', ctx.gender)} להיכנס לרשימת המילים ולחפש אותה\n• אם היא לא ברשימה, ${g('תוסיף', 'תוסיפי', ctx.gender)} אותה ל"מילים שלי"\n\nטיפ: כשנתקלים במילה חדשה, כדאי לרשום אותה מיד עם דוגמה למשפט — ככה היא נשמרת בזיכרון הרבה יותר טוב.`
    }
    return `מה המילה שאת${ctx.gender === 'female' ? '' : 'ה'} ${g('רוצה', 'רוצה', ctx.gender)} לדעת?\n${g('כתוב', 'כתבי', ctx.gender)} לי אותה ואני אסביר.`
  }

  if (lower.includes('הבדל בין')) {
    return `שאלה חשובה.\nהבדלים בין מילים דומות הם מהדברים הכי חשובים בבחינת אמירנט.\n\n${g('ספר', 'ספרי', ctx.gender)} לי — בין אילו מילים ${g('אתה מתלבט', 'את מתלבטת', ctx.gender)}? אני אפרק את ההבדלים.`
  }

  const accuracy = ctx.recentVocabAccuracy
  if (accuracy !== null && accuracy < 0.7) {
    return `שאלה טובה.\n\nאני רואה שאוצר המילים עדיין בתהליך — וזה לגמרי בסדר. ברמה של ${Math.round(accuracy * 100)}% דיוק, ההמלצה שלי:\n\n1. ${g('התמקד', 'התמקדי', ctx.gender)} ב-5 מילים חדשות ביום (לא יותר)\n2. ${g('חזור', 'חזרי', ctx.gender)} על מילים קשות עם כרטיסיות\n3. ${g('נסה', 'נסי', ctx.gender)} להשתמש בכל מילה במשפט\n\nמה המילה הספציפית?`
  }

  return `שאלה מעולה.\nאני כאן בדיוק בשביל זה.\n\n${g('ספר', 'ספרי', ctx.gender)} לי — אילו מילים ${g('מבלבלות אותך', 'מבלבלות אותך', ctx.gender)}? או מה הנושא? אני אתן הסבר ברור עם דוגמאות.`
}

function buildExamStrategyResponse(lower: string, ctx: StudentContext): string {
  if (lower.includes('ניסוח') || lower.includes('restatement')) {
    return `שאלות ניסוח מחדש — הטיפים שלי:\n\n1. ${g('קרא', 'קראי', ctx.gender)} את המשפט המקורי 2-3 פעמים\n2. ${g('חפש', 'חפשי', ctx.gender)} את מילת המפתח שמשנה את המשמעות\n3. שיטת ה-NOT: ${g('בדוק', 'בדקי', ctx.gender)} מה בטוח לא נכון ו${g('תסלק', 'תסלקי', ctx.gender)} תשובות\n4. ${g('שים', 'שימי', ctx.gender)} לב למילים כמו although, despite, however — הן מסמנות שינוי כיוון\n\nהטריק: 80% מהשאלות בונות על ניגוד (contrast) או סיבה-תוצאה. ${g('חפש', 'חפשי', ctx.gender)} את הקשר הלוגי.`
  }

  if (lower.includes('השלמת') || lower.includes('sentence completion') || lower.includes('sc')) {
    return `השלמת משפטים — הגישה שלי:\n\n1. ${g('קרא', 'קראי', ctx.gender)} את כל המשפט לפני שמסתכלים על התשובות\n2. ${g('נסה', 'נסי', ctx.gender)} לחשוב על מילה מתאימה בעצמך\n3. ${g('חפש', 'חפשי', ctx.gender)} רמזי הקשר: but/however → ניגוד, because/since → סיבה\n4. ${g('בדוק', 'בדקי', ctx.gender)} שהתשובה מתאימה גם דקדוקית וגם משמעותית\n\nטיפ: מילות קישור (connectors) הן 50% מהתשובות — ${g('למד', 'למדי', ctx.gender)} אותן היטב.`
  }

  if (lower.includes('הבנת הנקרא') || lower.includes('reading comprehension') || lower.includes('rc')) {
    return `הבנת הנקרא — האסטרטגיה שלי:\n\n1. ${g('קרא', 'קראי', ctx.gender)} את השאלות לפני הקטע\n2. ${g('סמן', 'סמני', ctx.gender)} מילות מפתח בשאלות\n3. ${g('קרא', 'קראי', ctx.gender)} את הקטע פעם אחת — ${g('אל תיתקע', 'אל תיתקעי', ctx.gender)} על מילים לא מוכרות\n4. לכל שאלה — ${g('חזור', 'חזרי', ctx.gender)} לפסקה הרלוונטית\n\nהטריק: התשובה כמעט תמיד נמצאת בטקסט — ${g('חפש', 'חפשי', ctx.gender)} paraphrase (ניסוח מחדש) של מה שכתוב.`
  }

  // General exam
  const examAccuracy = ctx.recentExamAccuracy
  let personalized = ''
  if (examAccuracy !== null) {
    if (examAccuracy >= 0.85) {
      personalized = `\n\nדרך אגב, ${ctx.name} — ${Math.round(examAccuracy * 100)}% דיוק בשאלות בחינה זה מעולה. ${g('תמשיך', 'תמשיכי', ctx.gender)} ככה.`
    } else if (examAccuracy >= 0.6) {
      personalized = `\n\n${ctx.name}, ${g('אתה', 'את', ctx.gender)} ב-${Math.round(examAccuracy * 100)}% דיוק — ${g('אתה', 'את', ctx.gender)} בדרך הנכונה. עוד קצת תרגול ותהיו מעל 85%.`
    } else {
      personalized = `\n\n${ctx.name}, אני רואה שיש מקום לשיפור בשאלות בחינה. בוא${ctx.gender === 'female' ? 'י' : ''} נתמקד בזה ביחד — זה לגמרי בר-שיפור.`
    }
  }

  return `הנה כמה טיפים כלליים לבחינת אמירנט:\n\n• תרגול יומי קצר (20-30 דק׳) עדיף על מרתון מדי פעם\n• ${g('למד', 'למדי', ctx.gender)} את מילות הקישור — הן מופיעות בכל סוגי השאלות\n• ${g('עשה', 'עשי', ctx.gender)} סימולציה מלאה לפחות פעם בשבוע\n• ${g('תחזור', 'תחזרי', ctx.gender)} על שגיאות — הן מלמדות הכי הרבה\n\nעל איזה חלק ${g('תרצה', 'תרצי', ctx.gender)} לדבר? SC, restatement, או הבנת הנקרא?${personalized}`
}

function buildContentHelpResponse(lower: string, ctx: StudentContext): string {
  if (lower.includes('דקדוק') || lower.includes('grammar') || lower.includes('זמנים') || lower.includes('tense')) {
    return `דקדוק — נושא חשוב.\n\nבבחינת אמירנט, הזמנים הכי חשובים הם:\n• Present Simple — עובדות והרגלים\n• Past Simple — אירועים שהסתיימו\n• Present Perfect — קשר עבר-הווה\n• Passive Voice — "נעשה" במקום "עשה"\n\n${g('ספר', 'ספרי', ctx.gender)} לי — באיזה זמן ${g('אתה מתבלבל', 'את מתבלבלת', ctx.gender)}? אני אביא דוגמאות ברורות.`
  }

  if (lower.includes('איך פותר') || lower.includes('איך לפתור') || lower.includes('לא הבנתי את השאלה')) {
    return `בוא${ctx.gender === 'female' ? 'י' : ''} נפרק את זה ביחד.\n\n${g('שלח', 'שלחי', ctx.gender)} לי את השאלה או ${g('תאר', 'תארי', ctx.gender)} מה לא ברור — ואני:\n1. אסביר את הגישה הנכונה\n2. אראה איך לזהות את התשובה\n3. אתן טיפ שיעזור בשאלות דומות\n\nכל שאלה שנפתרת ביחד = שאלה שלא תטעו בה בבחינה.`
  }

  if (lower.includes('למה התשובה') || lower.includes('למה זה')) {
    return `שאלה מעולה. הסקרנות הזו היא בדיוק מה שצריך.\n\n${g('ספר', 'ספרי', ctx.gender)} לי — באיזו שאלה מדובר? אני אפרק את ההיגיון מאחורי התשובה הנכונה ואסביר למה האחרות לא מתאימות.`
  }

  return `אשמח לעזור.\n\n${g('ספר', 'ספרי', ctx.gender)} לי — מה בדיוק ${g('אתה צריך', 'את צריכה', ctx.gender)} הסבר עליו? אני כאן לפרק כל נושא לחתיכות קטנות וברורות.`
}

// ── VPSE Framework: Validate → Probe → Support → Empower ──
// Based on MI (Motivational Interviewing), CBT chatbot research, and Israeli cultural context.
// Key principles:
// 1. NEVER jump to solutions — validate first, probe second
// 2. NEVER use toxic positivity ("הכל יהיה בסדר", "אתה כוכב")
// 3. ONE question per message — don't overwhelm
// 4. Use SPECIFIC affirmations based on student's actual data
// 5. Be warm but direct (Israeli dugriut style)
// 6. When student is dramatic ("אני הולך למות מהבחינה") — treat as normal expression, not crisis

function buildDifficultyResponse(lower: string, ctx: StudentContext): string {
  // Identify specific area if mentioned
  const area = lower.includes('מילים') || lower.includes('אוצר') ? 'vocab'
    : lower.includes('קריאה') || lower.includes('הבנת הנקרא') || lower.includes('קטע') ? 'reading'
    : lower.includes('בחינה') || lower.includes('שאל') || lower.includes('מבחן') ? 'exam'
    : lower.includes('השלמ') || lower.includes('sc') ? 'sc'
    : lower.includes('ניסוח') || lower.includes('restatement') ? 'restatement'
    : lower.includes('קישור') || lower.includes('connector') ? 'connectors'
    : null

  // ── Negative self-talk / catastrophizing → CBT-informed response ──
  if (lower.includes('טיפש') || lower.includes('לא מסוגל') || lower.includes('נכשל') || lower.includes('חסר תקווה')) {
    // Validate → gentle reality check → specific data
    const dataPoint = ctx.recentExamAccuracy !== null
      ? `\n\nבוא${ctx.gender === 'female' ? 'י' : ''} נבדוק — הדיוק שלך בשאלות בחינה הוא ${Math.round(ctx.recentExamAccuracy * 100)}%. זה לא "לא מסוגל". יש בסיס לעבוד איתו.`
      : ctx.recentVocabAccuracy !== null
        ? `\n\nבוא${ctx.gender === 'female' ? 'י' : ''} נבדוק — הדיוק שלך באוצר מילים הוא ${Math.round(ctx.recentVocabAccuracy * 100)}%. זה לא אפס. יש עם מה לעבוד.`
        : ''
    return `${ctx.name}, אני שומעת ${g('אותך', 'אותך', ctx.gender)}. זו תחושה קשה.${dataPoint}\n\nמה הדבר הספציפי שגרם ${g('לך', 'לך', ctx.gender)} להרגיש ככה?`
  }

  // ── "I don't understand" / "I can't" → Validate + probe for specifics ──
  if (lower.includes('לא מבין') || lower.includes('לא מצליח') || lower.includes('נתקע')) {
    if (area === 'vocab' || area === 'connectors') {
      return `${ctx.name}, אוקיי. ${g('ספר', 'ספרי', ctx.gender)} לי — מה בדיוק מרגיש הכי קשה? המילים לא נשארות בזיכרון, או שקשה להבין את המשמעות שלהן?`
    }
    if (area === 'reading') {
      return `${ctx.name}, אני שומעת. מה קורה כש${g('אתה קורא', 'את קוראת', ctx.gender)} — לא ${g('מבין', 'מבינה', ctx.gender)} את המילים עצמן, או ש${g('מבין', 'מבינה', ctx.gender)} מילים אבל לא את הרעיון הכללי?`
    }
    if (area === 'exam' || area === 'sc' || area === 'restatement') {
      return `${ctx.name}, אוקיי. ${g('תוכל', 'תוכלי', ctx.gender)} לתת לי דוגמה? באיזה סוג שאלות ${g('אתה נתקע', 'את נתקעת', ctx.gender)} — השלמת משפטים, ניסוח מחדש, או הבנת הנקרא?`
    }
    // No specific area — ask
    return `${ctx.name}, אני שומעת. קשה לי לפעמים נשמע כמו הרבה דברים שונים — מה בדיוק מרגיש הכי קשה עכשיו?`
  }

  // ── Generic "it's hard" / "I'm struggling" → Validate + single probe ──
  if (area) {
    const areaLabel = area === 'vocab' ? 'אוצר מילים'
      : area === 'reading' ? 'הבנת הנקרא'
      : area === 'exam' ? 'שאלות בחינה'
      : area === 'sc' ? 'השלמת משפטים'
      : area === 'restatement' ? 'ניסוח מחדש'
      : 'מילות קישור'
    return `${ctx.name}, אני שומעת. ${areaLabel} זה באמת לא פשוט.\n\n${g('ספר', 'ספרי', ctx.gender)} לי — מה בדיוק ב${areaLabel} מרגיש הכי מאתגר? ככה אוכל לעזור בצורה ממוקדת.`
  }

  return `${ctx.name}, אני שומעת ${g('אותך', 'אותך', ctx.gender)}. זה באמת לא קל.\n\nמה הדבר שהכי מתסכל ${g('אותך', 'אותך', ctx.gender)} ברגע הזה?`
}

function buildMotivationResponse(lower: string, ctx: StudentContext): string {
  // ── "I'm fed up" / "I don't feel like it" → Validate + probe for cause ──
  if (lower.includes('נמאס') || lower.includes('לא בא לי')) {
    return `${ctx.name}, זה קורה. ימים כאלה הם חלק מהתהליך.\n\nמה גרם ${g('לך', 'לך', ctx.gender)} להרגיש ככה דווקא עכשיו — החומר עצמו, עומס מדברים אחרים, או פשוט אין כוח?`
  }

  // ── "It's boring" / "annoying" → probe what specifically ──
  if (lower.includes('משעמם') || lower.includes('מעצבן') || lower.includes('לא מעניין')) {
    return `שמעתי ${g('אותך', 'אותך', ctx.gender)}. מה הדבר שהכי מעצבן — סוג התרגול, או שמרגיש שזה לא מתקדם?`
  }

  // ── Anxiety / fear → Validate + probe specifics ──
  if (lower.includes('לחוץ') || lower.includes('פחד') || lower.includes('מפחיד') || lower.includes('מלחיץ')) {
    return `${ctx.name}, אני שומעת ${g('אותך', 'אותך', ctx.gender)}. לחץ לפני בחינה זה דבר שהרבה תלמידים מרגישים.\n\nמה הכי מפחיד ${g('אותך', 'אותך', ctx.gender)} בנוגע לבחינה?`
  }

  // ── Dramatic expression ("I'll die") → Israeli style, don't panic ──
  if (lower.includes('למות') || lower.includes('אמות') || lower.includes('הורג')) {
    return `הא, אני מכירה את ההרגשה הזו. בוא${ctx.gender === 'female' ? 'י' : ''} נפרק את זה — מה הדבר שהכי מלחיץ?`
  }

  // ── Tired / exhausted → Validate + check energy ──
  if (lower.includes('עייף') || lower.includes('מותש') || lower.includes('אין כוח')) {
    return `${ctx.name}, מובן. כשאין כוח, אין טעם לדחוף בכוח.\n\nמה ${g('מעדיף', 'מעדיפה', ctx.gender)} — 5 דקות של משהו קליל רק לשמור על רצף, או פשוט יום מנוחה?`
  }

  // ── Generic low motivation → probe ──
  return `${ctx.name}, העובדה ש${g('אתה', 'את', ctx.gender)} כאן ומדבר${ctx.gender === 'female' ? 'ת' : ''} על זה — זה כבר צעד.\n\nמה מרגיש ${g('לך', 'לך', ctx.gender)} הכי מעכב ברגע הזה?`
}

function buildStudyStrategyResponse(lower: string, ctx: StudentContext): string {
  return `שאלה מעולה, ${ctx.name}.\n\nהשיטה שהכי עובדת לבחינת אמירנט:\n\nסדר יום מומלץ:\n• 10 דק׳ מילים חדשות (בוקר)\n• 10 דק׳ חזרה על מילים (אחה״צ)\n• 10 דק׳ שאלות בחינה (ערב)\n• קטע קריאה 2-3 פעמים בשבוע\n\nטיפים:\n• קצר ויומי עדיף על ארוך ולא סדיר\n• ${g('חזור', 'חזרי', ctx.gender)} על שגיאות — הכי חשוב\n• סימולציה מלאה פעם בשבוע\n• ${g('קרא', 'קראי', ctx.gender)} באנגלית מחוץ לאפליקציה — כתבות, כתוביות\n\nהמערכת שלנו מתאימה את עצמה לרמה שלך אוטומטית — פשוט ${g('תתרגל', 'תתרגלי', ctx.gender)} כל יום והיא תעשה את השאר.`
}

function buildGeneralResponse(ctx: StudentContext): string {
  return `תודה ששיתפת, ${ctx.name}.\n\nאני כאן ${g('בשבילך', 'בשבילך', ctx.gender)} — ${g('ספר', 'ספרי', ctx.gender)} לי איך אפשר לעזור ואני אדאג לזה.`
}

function buildEscalationResponse(reason: EscalationReason, ctx: StudentContext): RoutedResponse {
  const responses: Record<EscalationReason, string> = {
    explicit_request: `לגמרי, ${ctx.name}.\nאני מעבירה את ההודעה שלך לצוות של זינוק — מישהו מהצוות יחזור אליך בהקדם.\n\nבינתיים, אם יש משהו דחוף — אפשר גם לשלוח מייל ל-support@znk.co.il`,
    technical_issue: `היי ${ctx.name},\n\nקיבלתי — אני מעבירה את ההודעה שלך ישירות לצוות הטכני.\nמישהו יחזור אליך בהקדם האפשרי.\n\nבינתיים, ${g('תנסה', 'תנסי', ctx.gender)} לרענן את הדף — לפעמים זה עוזר.`,
    complaint: `${ctx.name}, אני לוקחת את זה ברצינות רבה.\n\nההודעה שלך הועברה ישירות להנהלת זינוק ומישהו בכיר יחזור אליך בהקדם.\n\nתודה שסיפרת — ביקורות עוזרות לנו להשתפר.`,
    sensitive_topic: `היי ${ctx.name},\n\nאני שומעת ${g('אותך', 'אותך', ctx.gender)}, ואני רוצה לוודא שמישהו מהצוות שלנו ידבר ${g('איתך', 'איתך', ctx.gender)} — כי אכפת לנו ממך.\n\nמישהו מצוות זינוק יחזור אליך בהקדם.`,
    repeated_frustration: `היי ${ctx.name},\n\nאני רואה שהדברים מרגישים מאתגרים לאחרונה, ואני רוצה לוודא שמישהו מהצוות ידבר ${g('איתך', 'איתך', ctx.gender)} אישית.\n\nמעבירה את ההודעה — מישהו יחזור אליך בהקדם.`,
  }

  return {
    persona: 'roni',
    response: responses[reason],
    category: 'escalation',
    shouldEscalate: true,
    escalationReason: reason,
  }
}

// ── Mock plan generation ──────────────────────────────────────────────────────

export function generateMockPlan(studentName: string): DailyPlan {
  const today = new Date().toISOString().split('T')[0]

  // No missions on Shabbat (Saturday)
  const dayOfWeek = new Date().getDay() // 0=Sun, 6=Sat
  if (dayOfWeek === 6) {
    return {
      id: `plan-${today}`,
      date: today,
      totalMinutes: 0,
      status: 'active',
      morningMessage: `שבת שלום, ${studentName}! 🕯️\nהיום יום מנוחה — אין משימות. נחזור ביום ראשון! 💪`,
      missions: [],
    }
  }

  // Read student preferences from profile store
  let dailyMinutes = 30
  let pacePreference: 'gradual' | 'strong' = 'gradual'
  let vocabLearnMethod: 'learnMode' | 'flashcards' = 'learnMode'
  let vocabElo = 1000
  let examDate: string | null = null
  let onboardingQuestionsCompleted = false

  try {
    const raw = localStorage.getItem('amirnet-student-profile')
    if (raw) {
      const parsed = JSON.parse(raw)
      const state = parsed?.state || parsed
      dailyMinutes = state.dailyMinutes || 30
      pacePreference = state.pacePreference || 'gradual'
      vocabLearnMethod = state.vocabLearnMethod || 'learnMode'
      vocabElo = state.vocabElo || 1000
      examDate = state.examDate || null
      onboardingQuestionsCompleted = state.onboardingQuestionsCompleted || false
    }
  } catch { /* use defaults */ }

  // ── Determine vocab unit based on Elo ──
  let vocabUnit: number
  let vocabCategory: string
  if (vocabElo < 900) {
    vocabUnit = Math.ceil(Math.random() * 3) // units 1-3
    vocabCategory = 'מילים בסיסיות'
  } else if (vocabElo < 1100) {
    vocabUnit = 2 + Math.ceil(Math.random() * 4) // units 2-5
    vocabCategory = 'מילים ברמה בינונית'
  } else {
    vocabUnit = 4 + Math.ceil(Math.random() * 5) // units 4-8
    vocabCategory = 'מילים מתקדמות'
  }

  // ── Determine reading level from Elo ──
  const readingLevel = vocabElo < 900 ? 1 : vocabElo < 1100 ? 2 : 3

  // ── Determine urgency from exam date ──
  let daysUntilExam = 90 // default
  if (examDate) {
    const diff = Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (diff > 0) daysUntilExam = diff
  }
  const isUrgent = daysUntilExam < 30
  const isMediumUrgency = daysUntilExam >= 30 && daysUntilExam < 60

  // ── Check if today is day 1 (no previous coach data) ──
  const coachData = localStorage.getItem('znk-coach-data')
  const isFirstDay = !coachData || !(JSON.parse(coachData || '{}')?.lastPlanDate)

  // ── Student maturity classification (performance-based) ──
  // Phase: new (0-150 active words), transition (150-400), veteran (400+)
  let activeWordCount = 0
  let rollingCorrectPct = 50
  try {
    const vocabRaw = localStorage.getItem('znk-vocab')
    if (vocabRaw) {
      const vs = JSON.parse(vocabRaw)?.state?.studentWords || {}
      const entries = Object.values(vs) as Array<{ status: string; correctCount: number; incorrectCount: number }>
      activeWordCount = entries.filter((w) => w.status !== 'new').length
      const totalAnswers = entries.reduce((s, w) => s + w.correctCount + w.incorrectCount, 0)
      const totalCorrect = entries.reduce((s, w) => s + w.correctCount, 0)
      if (totalAnswers > 20) rollingCorrectPct = Math.round((totalCorrect / totalAnswers) * 100)
    }
  } catch { /* defaults */ }

  const isNew = activeWordCount < 150
  const isVeteran = activeWordCount >= 400
  const isWeak = rollingCorrectPct < 65
  const isStrong = pacePreference === 'strong' || rollingCorrectPct >= 80

  // ── Time allocation ratios by student profile ──
  // Order: היכרות → אדפטיבי → שינון → שליפה (fixed, progressive unlock)
  // Ratios sum to 1.0 for vocab portion of daily time
  let vocabRatios: { flashcards: number; adaptive: number; learn: number; gravity: number }
  if (isNew && isWeak) {
    vocabRatios = { flashcards: 0.40, adaptive: 0.25, learn: 0.25, gravity: 0.10 }
  } else if (isNew) {
    vocabRatios = { flashcards: 0.35, adaptive: 0.25, learn: 0.25, gravity: 0.15 }
  } else if (isVeteran && isWeak) {
    vocabRatios = { flashcards: 0.15, adaptive: 0.35, learn: 0.30, gravity: 0.20 }
  } else if (isVeteran) {
    vocabRatios = { flashcards: 0.15, adaptive: 0.25, learn: 0.25, gravity: 0.35 }
  } else if (isWeak) {
    vocabRatios = { flashcards: 0.25, adaptive: 0.30, learn: 0.30, gravity: 0.15 }
  } else {
    vocabRatios = { flashcards: 0.25, adaptive: 0.25, learn: 0.25, gravity: 0.25 }
  }

  // Pre-exam boost: more gravity + adaptive
  if (isUrgent) {
    vocabRatios = { flashcards: 0.15, adaptive: 0.30, learn: 0.20, gravity: 0.35 }
  }

  // ── Calculate time budgets ──
  // Reading ALWAYS appears when student has 20+ minutes (critical for exam prep)
  const willHaveReading = dailyMinutes >= 20

  // Time allocation: vocab 45%, reading 25%, exam 30%
  const vocabPct = willHaveReading ? 0.45 : 0.60
  const examPct = willHaveReading ? 0.30 : 0.40
  const vocabMinutes = Math.round(dailyMinutes * vocabPct)
  const newWordsCount = isStrong
    ? (dailyMinutes >= 45 ? 25 : dailyMinutes >= 30 ? 20 : 15)
    : (dailyMinutes >= 30 ? 15 : dailyMinutes >= 20 ? 12 : 10)
  const practiceWordsCount = isStrong
    ? (dailyMinutes >= 45 ? 40 : dailyMinutes >= 30 ? 35 : 20)
    : (dailyMinutes >= 30 ? 30 : dailyMinutes >= 20 ? 25 : 20)

  // ── Build missions with 5 vocab modes (progressive unlock) ──
  const missions: Mission[] = []

  // Vocab Mission 1: כרטיסיות היכרות (Flashcards — always unlocked first)
  missions.push({
    id: `m-${today}-v1`,
    type: 'vocab_flashcards',
    title: `הכר ${newWordsCount} מילים חדשות`,
    subtitle: `יחידה ${vocabUnit} · ${vocabCategory}`,
    estimatedMinutes: Math.max(2, Math.round(vocabMinutes * vocabRatios.flashcards)),
    route: '/vocabulary/games/flashcards',
    routeParams: { unit: String(vocabUnit), count: String(newWordsCount) },
    status: 'pending',
    unlockOrder: 1,
  })

  // Vocab Mission 2: WORD HACK (associations — unlocks after flashcards)
  missions.push({
    id: `m-${today}-v2`,
    type: 'vocab_wordhack',
    title: 'WORD HACK',
    subtitle: `יחידה ${vocabUnit} · האקים לזיכרון`,
    estimatedMinutes: 4,
    route: '/vocabulary/games/wordHack',
    routeParams: { unit: String(vocabUnit), count: '10' },
    status: 'locked',
    unlockOrder: 2,
  })

  // Vocab Mission 3: תרגול אדפטיבי (Adaptive — unlocks after wordHack)
  missions.push({
    id: `m-${today}-v3`,
    type: 'vocab_adaptive',
    title: `תרגל ${practiceWordsCount} מילים`,
    subtitle: 'תרגול אדפטיבי · כל המילים',
    estimatedMinutes: Math.max(2, Math.round(vocabMinutes * vocabRatios.adaptive)),
    route: '/vocabulary/games/adaptivePractice',
    routeParams: { count: String(practiceWordsCount) },
    status: 'locked',
    unlockOrder: 3,
  })

  // Vocab Mission 4: שינון מילים חדשות (LearnMode — unlocks after adaptive)
  missions.push({
    id: `m-${today}-v4`,
    type: 'vocab_learn',
    title: `שנן ${newWordsCount} מילים`,
    subtitle: `יחידה ${vocabUnit} · שינון מעמיק`,
    estimatedMinutes: Math.max(2, Math.round(vocabMinutes * vocabRatios.learn)),
    route: '/vocabulary/games/learnMode',
    routeParams: { unit: String(vocabUnit), count: String(newWordsCount) },
    status: 'locked',
    unlockOrder: 4,
  })

  // Vocab Mission 5: שליפה מהירה (Gravity — unlocks after learn)
  missions.push({
    id: `m-${today}-v5`,
    type: 'vocab_gravity',
    title: 'שליפה מהירה',
    subtitle: 'כל המילים · מירוץ נגד הזמן',
    estimatedMinutes: Math.max(2, Math.round(vocabMinutes * vocabRatios.gravity)),
    route: '/vocabulary/games/gravity',
    status: 'locked',
    unlockOrder: 5,
  })

  // Mission 5: Reading — ALWAYS included when 20+ min (critical for exam prep)
  if (willHaveReading) {
    missions.push({
      id: `m-${today}-5`,
      type: 'reading',
      title: 'קרא קטע + שאלות',
      subtitle: readingLevel === 1 ? 'רמה קלה' : readingLevel === 2 ? 'רמה בינונית' : 'רמה מתקדמת',
      estimatedMinutes: Math.max(5, Math.round(dailyMinutes * 0.25)),
      route: '/reading',
      routeParams: { level: String(readingLevel) },
      status: 'pending',
    })
  }

  // Mission 6: Exam questions — mixed practice (SC + Restatement + RC)
  // Allocation follows real exam proportions (~36% SC, ~36% REST, ~28% RC)
  // adjusted for available pool (12 SC, 4 REST, 10 RC)
  {
    const total = isStrong
      ? (dailyMinutes >= 45 ? 20 : dailyMinutes >= 30 ? 15 : 12)
      : (isUrgent ? 15 : (dailyMinutes >= 30 ? 15 : dailyMinutes >= 20 ? 12 : 8))

    // Proportional allocation
    let sc: number, rest: number, rc: number
    if (total <= 8)       { sc = 3; rest = 2; rc = 3 }
    else if (total <= 10) { sc = 4; rest = 2; rc = 4 }
    else if (total <= 12) { sc = 5; rest = 3; rc = 4 }
    else if (total <= 15) { sc = 6; rest = 4; rc = 5 }
    else if (total <= 17) { sc = 8; rest = 4; rc = 5 }
    else                  { sc = 8; rest = 4; rc = 8 }

    const actualTotal = sc + rest + rc
    missions.push({
      id: `m-${today}-6`,
      type: 'exam_sc',
      title: `${actualTotal} שאלות בחינה`,
      subtitle: 'השלמת משפטים + ניסוח מחדש + הבנת הנקרא',
      estimatedMinutes: Math.max(5, Math.round(dailyMinutes * examPct)),
      route: '/exam/practice',
      routeParams: { sc: String(sc), rest: String(rest), rc: String(rc) },
      status: 'pending',
    })
  }

  // ── Ensure total matches dailyMinutes ──
  let totalMinutes = missions.reduce((sum, m) => sum + m.estimatedMinutes, 0)
  if (totalMinutes < dailyMinutes && missions.length > 0) {
    // Distribute leftover minutes proportionally across missions
    const deficit = dailyMinutes - totalMinutes
    const perMission = Math.floor(deficit / missions.length)
    let remainder = deficit - perMission * missions.length
    for (const m of missions) {
      m.estimatedMinutes += perMission + (remainder > 0 ? 1 : 0)
      if (remainder > 0) remainder--
    }
    totalMinutes = missions.reduce((sum, m) => sum + m.estimatedMinutes, 0)
  }

  const { greeting: timeGreeting, emoji: timeEmoji } = getTimeGreeting()
  const morningMessage = isFirstDay
    ? `הנה התוכנית שלך 👆\nנשארו ${missions.length} משימות (~${totalMinutes} דק׳). לחץ על משימה כדי להתחיל!`
    : `${timeGreeting}, ${studentName}! ${timeEmoji}\nהיום יש לך ${missions.length} משימות (~${totalMinutes} דק׳). יאללה!`

  return {
    id: `plan-${today}`,
    date: today,
    totalMinutes,
    status: 'active',
    morningMessage,
    missions,
  }
}

// ── Dictionary detection ──────────────────────────────────────────────────────

/** Extract an English word from a dictionary/vocab question. Returns null if not a dictionary question. */
export function extractDictionaryWord(text: string): string | null {
  const lower = text.toLowerCase().trim()

  // "מה זה X" / "מה הפירוש של X" / "תרגם X" / "פירוש X" / "מה המילה X"
  const hebrewPatterns = [
    /(?:מה (?:זה|הפירוש|המשמעות|התרגום|פירוש) (?:של |המילה )?)\s*([a-zA-Z]{2,})/i,
    /(?:תרגום|פירוש|תרגם|מה המילה)\s+([a-zA-Z]{2,})/i,
    /(?:מילה|word)\s+([a-zA-Z]{2,})/i,
    // "איך אומרים X" / "מה אומר X" / "מה אומרת X"
    /(?:איך (?:אומרים|נקרא|קוראים|מתרגמים))\s+([a-zA-Z]{2,})/i,
    /(?:מה (?:אומר|אומרת|משמע))\s+([a-zA-Z]{2,})/i,
    // English patterns: "what is X" / "translate X" / "define X" / "meaning of X"
    /(?:what (?:is|does)|translate|define|meaning of)\s+([a-zA-Z]{2,})/i,
  ]

  for (const pattern of hebrewPatterns) {
    const match = lower.match(pattern)
    if (match) return match[1].toLowerCase()
  }

  // If message is mostly Hebrew + contains exactly one English word + is short (dictionary-style)
  if (lower.length < 80) {
    const hebrewChars = (lower.match(/[\u0590-\u05FF]/g) || []).length
    const englishWords = lower.match(/\b[a-zA-Z]{2,}\b/g)
    if (hebrewChars >= 2 && englishWords && englishWords.length === 1) {
      // Any Hebrew text + one English word → likely a dictionary question
      return englishWords[0].toLowerCase()
    }
  }

  // Bare English word by itself (or with ?)
  if (/^[a-zA-Z]{2,}\s*\??$/.test(lower)) {
    return lower.replace(/[?\s]/g, '').toLowerCase()
  }

  return null
}

/** Check if student is confirming they want to add a word (follow-up to dictionary response) */
export function isDictionaryAddConfirmation(text: string, recentMessages: ChatMessage[]): {
  confirmed: boolean
  word?: string
  hebrew?: string
  masterWordId?: number | null
} {
  // Strip emoji/symbols (✓✗ etc.) so button text like "כן ✓" matches
  const lower = text.toLowerCase().trim().replace(/[✓✗✔✘☑️☐⬜⬛🔲✅❌]/gu, '').trim()
  const yesPatterns = /^(כן|בטח|כמובן|יאללה|יא|yes|yeah|ok|אוקיי|בוודאי|תוסיף|תוסיפי|sure|למה לא|ברור)\s*[!.]*$/
  if (!yesPatterns.test(lower)) {
    return { confirmed: false }
  }

  // Look for the last bot/dana message that was a dictionary response
  const recentDict = [...recentMessages].reverse().find(
    m => (m.sender === 'bot' || m.sender === 'dana') && m.metadata?.dictionaryWord
  )
  if (!recentDict) return { confirmed: false }

  return {
    confirmed: true,
    word: recentDict.metadata!.dictionaryWord as string,
    hebrew: recentDict.metadata!.dictionaryHebrew as string,
    masterWordId: (recentDict.metadata!.masterWordId as number | null) ?? null,
  }
}

// ── Legacy compat (used by old coachApi import) ───────────────────────────────

export function matchBotResponse(text: string): { persona: 'bot' | 'roni' | 'dana', response: string } {
  const ctx = getStudentContext()
  const result = routeAndRespond(text, ctx, [])
  return { persona: result.persona, response: result.response }
}
