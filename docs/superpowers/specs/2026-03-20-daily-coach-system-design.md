# Daily Coach System — Design Spec

## Overview

A smart daily coaching system for ZNK (English bagrut exam prep app) that combines an automated planning bot, AI-powered "team members," and real human staff escalation — all delivered through a floating chat widget.

**Target audience:** ~20-year-old post-military students, many with ADHD/learning disabilities, preparing for the English bagrut exam.

**Core value:** Students feel supported by a professional team that understands them, while 95% of interactions are handled automatically.

---

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌────────────┐
│  React App   │────>│  WordPress REST  │────>│  Claude AI │
│  (Widget)    │<────│  API (Plugin)    │<────│  API       │
└──────────────┘     └────────┬─────────┘     └────────────┘
                              │
                    ┌─────────┼──────────┐
                    v         v          v
              ┌─────────┐ ┌────────┐ ┌────────────┐
              │ DB      │ │ Email  │ │ WP Admin   │
              │ Chats   │ │ Staff  │ │ Staff      │
              │ Plans   │ │ Alerts │ │ Dashboard  │
              └─────────┘ └────────┘ └────────────┘
```

### Why WordPress Plugin

- Student already has WordPress + LearnDash credentials — single auth
- LearnDash enrollment = access control (removed from course = no widget)
- Staff already uses WP Admin — dashboard lives there naturally
- Email via wp_mail — no new service needed
- No new infrastructure — runs on existing server

### Auth & Access

- JWT-based login using WordPress credentials
- Every API request checks LearnDash enrollment status
- Course removal = immediate widget access revocation

---

## The 3 Entities in Chat

| Entity | Name | Icon | When responds | Delay | Powered by |
|--------|------|------|---------------|-------|------------|
| **Plan Bot** | "המערכת" | 🤖 | 24/7, immediate | 0-2s | Local algorithm |
| **Coach** | "רוני" | 👩‍💻 | Sun-Thu 8-22, Fri until 13 | 2-8 min | Claude API |
| **Exam Expert** | "דנה" | 👨‍🎓 | Same hours as Roni | 3-10 min | Claude API |

### Who Answers What

**Plan Bot** handles:
- Schedule changes ("I only have 20 minutes today")
- Plan updates and mission status
- Automatic encouragement ("Great job! 3/4 done!")
- Technical plan questions

**Roni (Coach)** handles:
- Vocabulary learning questions
- Motivation and emotional support
- ADHD-related struggles
- General learning strategy

**Dana (Exam Expert)** handles:
- Exam question types (restatement, sentence completion)
- Reading comprehension strategies
- Exam-specific tips and techniques

### Persona Selection

`PersonaRouter` in the WordPress plugin analyzes the student message content and selects the appropriate persona. Claude API receives persona-specific system prompts.

### Off-Hours Behavior

- **Bot:** Responds immediately, always
- **"Team members":** Message queued, student sees "רוני תענה לך מחר בבוקר 💤"
- Next morning: response appears as if Roni read and replied

### Off-hours definition
- After 22:00 until 08:00 (daily)
- Friday after 13:00 until Saturday 20:00

---

## Communication Style

All AI personas follow ZNK's communication principles:

- **Professional but warm** — not robotic, not condescending
- **Encourages elaboration** — "Tell me more, what exactly did you feel when you got stuck?"
- **Gender-aware** — uses existing `g()` utility for Hebrew gendered text
- **Natural Hebrew** — no excessive formality
- **Measured emoji use** — present but not overdone
- **Sensitive to struggles** — especially ADHD-related challenges

---

## Daily Plan Algorithm

### Generation

- WordPress cron runs at 02:00 nightly
- Local algorithm (no Claude API) — fast, free, consistent
- Creates personalized plan for each active student

### Inputs

| Parameter | Source |
|-----------|--------|
| Days until exam | Student profile |
| Available time today | Default 30 min, adjustable via chat |
| Words due for review | SM-2 algorithm (existing in codebase) |
| Elo rating | Calculated from adaptive practice |
| Weak words | accuracy < 70% in last 3 exposures |
| Units learned/unlearned | Existing store |
| Staff overrides | DB — instructions from real staff |

### Time Allocation (30 min example)

Following the 85% accuracy rule (maintaining ~85% success rate):

```
├── 8 min  New words (10 words from next unit)
├── 7 min  Word practice (SM-2 — words due for review)
├── 8 min  Reading (passage + questions, difficulty-matched)
├── 7 min  Exam questions (SC + restatement, Elo-based)
```

### Automatic Adjustments

- **Time constraint:** "Only 15 min" → reduces to 2 tasks, prioritizes review + one exam type
- **Struggling with topic:** Repeated failures in restatement → more restatement in coming days, lower difficulty
- **All complete:** Offers bonus mission (weak words / bonus questions)
- **Friday:** Lighter plan (review only, no new material)

### Morning Message

- Generated via Claude API once daily (during plan creation)
- Claude receives: performance summary, streak, weak words, staff instructions
- Returns: warm personalized message (2-3 sentences)
- Stored in DB, displayed when student opens widget

---

## Message System (Extensible)

### Message Schema

```
message {
  id
  student_id
  sender: 'bot' | 'roni' | 'dana' | 'staff:{name}'
  content
  channel: 'widget'
  priority: 'normal' | 'high'
  delivery_targets: []
  created_at
  delivered_at
  read_at
}
```

### Current Channel

- `widget` — the chat widget inside the React app

### Future Channels (no core logic changes needed)

| Channel | When | Example |
|---------|------|---------|
| **Push** | Native app | "Roni: Hey, I checked and you have 3 words worth reviewing" |
| **WhatsApp** | Reminders + encouragement | "Good morning! Your plan is waiting (25 min)" |
| **Email** | Weekly summary | "Your week: +45 words, 4-day streak" |

### Delivery Architecture

- `MessageService` creates all messages
- `DeliveryService` routes through adapters: `WidgetAdapter`, `PushAdapter`, `WhatsAppAdapter`, `EmailAdapter`
- Adding a channel = adding an adapter, no changes to message creation logic
- Per-student channel preferences and quiet hours

### Delivery Rules

| Message type | Widget | Push | WhatsApp |
|-------------|--------|------|----------|
| Daily plan | Always | Morning only | Morning only |
| "Team" response | Always | Always (within hours) | No |
| "Haven't practiced" reminder | — | Afternoon | Afternoon |
| Weekly summary | — | — | Email only |

### Unread Tracking

- Every widget message tracked: `delivered_at` + `read_at`
- If student doesn't open widget → after X hours, send via push/whatsapp
- Prevents spam while ensuring delivery

---

## Escalation to Real Staff

### Automatic Triggers

- Repeated frustration: 3+ negative messages in a session
- Student explicitly asks to talk to someone
- AI confidence is low (Claude returns low-confidence signal)
- Student inactive 3+ days (automatic email)

### Escalation Flow

1. AI responds normally (student doesn't notice escalation)
2. Email sent to relevant staff member with link to conversation in WP Admin
3. Staff can: read conversation, override AI response, write directly, add instructions for bot
4. Staff response appears in widget with their real name

---

## WordPress Plugin Structure

```
znk-coach/
├── znk-coach.php              — Plugin registration, hooks
├── api/
│   ├── auth.php               — JWT login, enrollment check
│   ├── messages.php           — Send/receive messages
│   ├── daily-plan.php         — Daily plan API
│   └── staff-override.php     — Staff overrides
├── services/
│   ├── PlanGenerator.php      — Daily plan algorithm
│   ├── ClaudeService.php      — Claude API calls
│   ├── MessageService.php     — Message creation
│   ├── DeliveryService.php    — Channel delivery
│   ├── EscalationService.php  — Escalation detection + email
│   └── PersonaRouter.php      — Who answers: bot/roni/dana
├── cron/
│   └── daily-plan-cron.php    — Runs at 02:00, creates plans
├── admin/
│   ├── dashboard.php          — Main staff dashboard
│   ├── student-chat.php       — View conversation + respond
│   └── student-settings.php   — Bot instructions per student
└── db/
    └── schema.sql             — Custom tables
```

---

## Staff Dashboard (WP Admin)

### Features

- **Student list** with status indicators (active, at-risk, inactive)
- **Conversation view** — full chat history per student
- **Override AI** — edit/delete AI response, write replacement
- **Direct reply** — write message as real staff (shows real name)
- **Bot instructions** — per-student directives ("be gentler", "more reading practice")
- **Performance overview** — words learned, accuracy, weak areas, streak
- **Alert badges** — warning icon on students needing attention

---

## React Widget Component

### Placement

- `CoachWidget` component rendered in `Shell.tsx`
- Visible on all non-practice pages
- Hidden during practice/exam sessions (no distraction)
- Reappears when returning to navigation pages

### Display Modes

| Mode | Mobile | Desktop |
|------|--------|---------|
| **Closed** | FAB button (bottom-left, above nav) + badge | Same, bottom-left |
| **Open** | Bottom sheet ~80% screen, drag-to-dismiss | Floating window 380px |
| **In practice** | Hidden completely | Hidden completely |

### Auto-Open Behavior

- Opens automatically on first daily visit
- If student closes → stays closed, badge pulses
- New "team" message → badge jumps + subtle sound

### State Management

```typescript
interface CoachStore {
  // Widget state
  isOpen: boolean
  unreadCount: number

  // Daily plan
  dailyPlan: DailyPlan | null
  missions: Mission[]
  completedMissions: string[]

  // Conversation
  messages: Message[]
  isTyping: boolean

  // Actions
  fetchDailyPlan(): Promise<void>
  sendMessage(text: string): Promise<void>
  completeMission(id: string): Promise<void>
  markAsRead(): void
}
```

### API Endpoints

```
POST /wp-json/znk-coach/v1/auth/login
GET  /wp-json/znk-coach/v1/plan/today
GET  /wp-json/znk-coach/v1/messages
POST /wp-json/znk-coach/v1/messages
POST /wp-json/znk-coach/v1/missions/{id}/complete
```

### Data Fetching

- Polling every 30 seconds for new messages
- No WebSocket needed — intentional delays make polling sufficient
- Plan fetched once on widget open, cached for session

---

## Widget UI Summary

### Header
- Stacked team avatars (3 overlapping circles)
- "צוות זינוק" with online indicator
- Exam countdown + day in program

### Chat Body
- Bot messages: white bubble, 🤖 avatar, "בוט התוכנית" label
- Team messages: white bubble, persona avatar, "רוני · מצוות זינוק" label
- Student messages: purple bubble, right-aligned
- System messages: subtle bar ("התוכנית עודכנה · 33 דק' → 20 דק'")
- Mission buttons: colored cards with completion animation
- Progress bar: gradient fill with count

### Input Area
- Text input with placeholder "כתוב הודעה לצוות..."
- Send button (purple gradient)
- Enter to send, Shift+Enter for newline
- Footer: "צוות זינוק · בוט + 3 אנשי צוות · זמן מענה ממוצע: 6 דקות"

---

## Mockups

- Desktop widget: `.superpowers/brainstorm/85755-1773970062/coach-widget-v1.html`
- Mobile bottom sheet: `.superpowers/brainstorm/85755-1773970062/coach-widget-mobile-v1.html`
- Mobile with chat + team: `.superpowers/brainstorm/85755-1773970062/coach-widget-mobile-v2.html`

---

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Backend | WordPress Plugin | Existing server, LearnDash auth, staff already in WP Admin |
| AI for team personas | Claude API with delay | Feels human, instant would break illusion |
| Daily plan algorithm | Local (no AI) | Fast, free, consistent, works offline |
| Morning message | Claude API (once daily) | Worth the cost for personalization |
| Real-time updates | Polling (30s) | Intentional delays make WebSocket unnecessary |
| Off-hours | Queue + deliver next morning | Critical for human illusion |
| Channel architecture | Adapter pattern | Future-proof for push/WhatsApp/email |
| Escalation | Auto-detect + email staff | Students don't notice, staff intervenes when free |

---

## Files to Create/Modify

### New (WordPress Plugin)
- `znk-coach/` — entire plugin directory (see structure above)

### New (React)
- `src/features/coach/CoachWidget.tsx` — main widget component
- `src/features/coach/CoachFab.tsx` — floating action button
- `src/features/coach/ChatBody.tsx` — message list
- `src/features/coach/ChatInput.tsx` — text input
- `src/features/coach/MissionCard.tsx` — mission buttons
- `src/features/coach/SystemMessage.tsx` — system update messages
- `src/stores/coachStore.ts` — Zustand store
- `src/services/coachApi.ts` — API client

### Modified
- `src/components/layout/Shell.tsx` — add CoachWidget
- `src/stores/studentProfileStore.ts` — add WordPress auth fields

---

## Verification

1. `npm run build` — no errors
2. Widget appears on home page, hidden during practice
3. FAB shows badge with mission count
4. Mobile: bottom sheet opens/closes with drag
5. Desktop: floating window opens/closes
6. Daily plan displays with missions
7. Clicking mission navigates to practice, marks complete on return
8. Student can type message and receive bot response
9. "Team" responses arrive with appropriate delay
10. Off-hours messages queued and delivered next morning
11. Staff dashboard shows conversations in WP Admin
12. Staff can override AI response
13. Escalation email sent on repeated frustration
14. LearnDash enrollment check blocks unenrolled students
