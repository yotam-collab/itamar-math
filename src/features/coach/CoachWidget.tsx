// src/features/coach/CoachWidget.tsx

import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useCoachStore } from '../../stores/coachStore'
import { useStudentProfileStore } from '../../stores/studentProfileStore'
import { appendMessages } from '../../services/coachApi'
import { playSound } from '../../utils/sounds'
import { g } from '../../utils/gender'
import { resizeImage, fileToBase64, extractWordsFromImage } from '../../services/ocrService'
import { Robot, UserCircle, GraduationCap } from '@phosphor-icons/react'
import CoachFab from './CoachFab'
import ChatBubble from './ChatBubble'
import SystemMessage from './SystemMessage'
import TypingIndicator from './TypingIndicator'
import MissionCard from './MissionCard'
import ChatInput from './ChatInput'
import type { Mission, ChatMessage } from '../../services/mockCoachData'
import { useProgramDay } from '../../utils/useProgramDay'

// ── Canvas confetti burst (no external library) ──
function fireConfetti() {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  const colors = ['#6B3FA0', '#EE2B73', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6']
  const particles: { x: number; y: number; vx: number; vy: number; color: string; size: number; rotation: number; vr: number; life: number }[] = []

  for (let i = 0; i < 80; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 12 - 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1,
    })
  }

  let frame = 0
  function animate() {
    if (frame++ > 120) { canvas.remove(); return }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const p of particles) {
      p.x += p.vx
      p.vy += 0.25 // gravity
      p.y += p.vy
      p.rotation += p.vr
      p.life -= 0.008
      if (p.life <= 0) continue
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.globalAlpha = p.life
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      ctx.restore()
    }
    requestAnimationFrame(animate)
  }
  requestAnimationFrame(animate)
}

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
  const autoOpenFired = useRef(false)

  const studentName = useStudentProfileStore(s => s.studentName) || 'תלמיד'
  const onboarded = useStudentProfileStore(s => s.onboarded)
  const {
    isOpen, dailyPlan, messages, isTyping, typingPersona,
    openWidget, closeWidget, fetchPlan, sendMessage, completeMission,
    getCompletedCount, getTotalCount, getRemainingMinutes,
  } = useCoachStore()

  // Hide during practice or when not yet onboarded
  const isHidden = !onboarded || HIDDEN_ROUTES.some(r => location.pathname.includes(r))

  // Days-in-program / countdown — shared source of truth via useProgramDay.
  // When the student didn't pick an exam date during onboarding, showCountdown
  // is false and we render a softer "no date set" copy instead of fake numbers.
  const { daysUntilExam: examDays, dayInProgram, showCountdown } = useProgramDay()
  const coachHeaderTagline = showCountdown && examDays !== null && dayInProgram !== null
    ? `הבחינה בעוד ${examDays} יום · יום ${dayInProgram} בתוכנית`
    : 'בוא נשים אותך על מסלול — צ׳אט עם המאמן'

  // Fetch plan on mount (only after onboarding)
  useEffect(() => {
    if (!onboarded) return
    fetchPlan(studentName)
  }, [fetchPlan, studentName, onboarded])

  // Escape key closes the widget — guarantees an escape route on phones
  // where the X button could fall under a hardware keyboard / browser chrome.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeWidget() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, closeWidget])

  // Check if desktop (md breakpoint = 768px)
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768

  // Wait for onboarding tour to finish before auto-opening chat
  const [tourDone, setTourDone] = useState(() => localStorage.getItem('amirnet-tour-completed') === 'true')
  useEffect(() => {
    if (tourDone) return
    // Poll for tour completion (set by OnboardingTour on close)
    const interval = setInterval(() => {
      if (localStorage.getItem('amirnet-tour-completed') === 'true') {
        setTourDone(true)
        clearInterval(interval)
      }
    }, 500)
    return () => clearInterval(interval)
  }, [tourDone])

  // Auto-open logic:
  // Desktop: always open by default
  // Mobile: first-ever (gradual intro) vs daily (1.5s delay)
  useEffect(() => {
    if (!onboarded || isHidden || autoOpenFired.current || !tourDone) return

    const store = useCoachStore.getState()

    // First-time ever: gradual chat intro with onboarding questions
    if (!store.hasEverOpened) {
      autoOpenFired.current = true
      const delay = isDesktop ? 2000 : 10_000
      const timer = setTimeout(() => {
        if (useCoachStore.getState().hasEverOpened) return

        const now = () => new Date().toISOString()
        const mkId = () => `welcome-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`

        // Read exam date for context
        let weeksUntilExam = ''
        try {
          const raw = localStorage.getItem('amirnet-student-profile')
          if (raw) {
            const s = JSON.parse(raw)?.state
            if (s?.examDate) {
              const days = Math.ceil((new Date(s.examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              if (days > 0) weeksUntilExam = `יש לנו ${Math.ceil(days / 7)} שבועות עד הבחינה. `
            } else if (s?.psychoCourseDate && s.psychoCourseDate !== 'none') {
              const days = Math.ceil((new Date(s.psychoCourseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              if (days > 0) weeksUntilExam = `יש לנו ${Math.ceil(days / 7)} שבועות עד שמתחיל הקורס. `
            }
          }
        } catch { /* ignore */ }

        // Step 1: Premium welcome — frames the 4 questions as a signal of
        // personalization, not a form. Tone per research (Gollwitzer
        // implementation intentions, Deci & Ryan SDT): no "I'm a bot"
        // apology, no exclamation overload, no cutesy emoji robots.
        const weeksLine = weeksUntilExam ? `\n\n${weeksUntilExam.trim()}` : ''
        const introMsg = {
          id: mkId(), sender: 'bot' as const, type: 'text' as const,
          content: `היי ${studentName}.\n\nלפני שאני בונה ${g('לך', 'לך')} תוכנית — יש לי 4 שאלות קצרות.\nזה לא סקר. אני שואל כדי שהתוכנית תהיה שלך, לא של תלמיד ממוצע.${weeksLine}`,
          createdAt: now(),
        }
        appendMessages([introMsg])
        useCoachStore.setState(s => ({ messages: [...s.messages, introMsg] }))
        openWidget()

        // Step 2: After 2.5s → Q1 · Motivation (new, highest-value question
        // per research: activates self-determination before mechanics,
        // gives the coach anchor language for future resistance-recovery).
        setTimeout(() => {
          useCoachStore.setState({ isTyping: true, typingPersona: 'bot' })
          setTimeout(() => {
            useCoachStore.setState({ isTyping: false, typingPersona: null })
            const q1Msg = {
              id: mkId(), sender: 'bot' as const, type: 'text' as const,
              content: `מה מחכה ${g('לך', 'לך')} אחרי אמירנט?\n(אני שואל כי אזכיר ${g('לך', 'לך')} את זה כשיהיה קשה)`,
              metadata: {
                onboardingQuestion: 'motivation',
                buttons: [
                  'אוניברסיטה / תואר מסוים 🎓',
                  'פקולטה יוקרתית (רפואה · הנדסה · משפטים) 🧬',
                  'לעצמי — רוצה לסגור את זה 💪',
                  'משהו אחר — אסביר',
                ],
              },
              createdAt: now(),
            }
            appendMessages([q1Msg])
            useCoachStore.setState(s => ({ messages: [...s.messages, q1Msg] }))
          }, 1500)
        }, 2500)
      }, delay)
      return () => { clearTimeout(timer); autoOpenFired.current = false }
    }

    // Desktop: always open
    if (isDesktop && !store.isOpen) {
      autoOpenFired.current = true
      const timer = setTimeout(() => openWidget(), 500)
      return () => { clearTimeout(timer); autoOpenFired.current = false }
    }

    // Mobile returning user: auto-open on first visit of the day
    const today = new Date().toISOString().split('T')[0]
    if (!isDesktop && store.lastOpenDate !== today && dailyPlan) {
      autoOpenFired.current = true
      const timer = setTimeout(() => openWidget(), 1500)
      return () => { clearTimeout(timer); autoOpenFired.current = false }
    }
  }, [onboarded, isHidden, dailyPlan, openWidget, studentName, isDesktop, tourDone])

  // ── All-done confetti celebration ──
  const prevCompletedRef = useRef(0)
  const confettiFiredRef = useRef(false)
  useEffect(() => {
    if (!dailyPlan) return
    // Only count original (non-bonus) missions for confetti trigger
    const regularMissions = dailyPlan.missions.filter(m => !m.id.startsWith('bonus-'))
    const completed = regularMissions.filter(m => m.status === 'completed').length
    const total = regularMissions.length
    const prevCompleted = prevCompletedRef.current
    prevCompletedRef.current = completed

    // Fire confetti only when transitioning to all regular missions done (once per day)
    if (completed === total && total > 0 && prevCompleted > 0 && prevCompleted < total && !confettiFiredRef.current) {
      confettiFiredRef.current = true
      playSound('complete')
      try { navigator.vibrate?.([100, 50, 100, 50, 200]) } catch { /* ignore */ }
      setTimeout(fireConfetti, 300)
    }
  }, [dailyPlan])

  // Scroll to bottom when new messages
  useEffect(() => {
    if (bodyRef.current && isOpen) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [messages, isTyping, isOpen])

  // ── OCR: handle image capture for word scanning ──
  // NOTE: hooks must be called unconditionally (before any early return)
  const [isScanning, setIsScanning] = useState(false)
  const handleImageCapture = useCallback(async (file: File) => {
    setIsScanning(true)
    try {
      // Resize for faster upload
      const resized = await resizeImage(file)
      const base64 = await fileToBase64(resized as File)

      // Add a "scanning" message
      const scanMsg: ChatMessage = {
        id: `scan-${Date.now()}`,
        sender: 'bot',
        type: 'text',
        content: '🔍 סורק את התמונה...',
        createdAt: new Date().toISOString(),
      }
      useCoachStore.setState(s => ({ messages: [...s.messages, scanMsg] }))

      // Call OCR
      const result = await extractWordsFromImage(base64)

      // Remove scanning message
      useCoachStore.setState(s => ({
        messages: s.messages.filter(m => m.id !== scanMsg.id),
      }))

      console.log('[OCR result]', { success: result.success, words: result.words.length, error: result.error, rawText: result.rawText?.slice(0, 200) })

      if (!result.success || result.words.length === 0) {
        const noWordsMsg: ChatMessage = {
          id: `scan-result-${Date.now()}`,
          sender: 'bot',
          type: 'text',
          content: !result.success
            ? `שגיאה בסריקה: ${result.error || 'נסה שוב'}`
            : 'לא מצאתי מילים באנגלית בתמונה. נסה לצלם טקסט ברור יותר 📸',
          createdAt: new Date().toISOString(),
        }
        useCoachStore.setState(s => ({ messages: [...s.messages, noWordsMsg] }))
        return
      }

      // Auto-translate all found words and show results
      const { translateWord } = await import('../../utils/translationCache')
      const wordsData = (await import('../../data/vocabulary/words.json')).default as Array<{ english: string; hebrew: string }>

      // Lookup common words dict
      const COMMON: Record<string, string> = {
        test:'מבחן',exam:'בחינה',hello:'שלום',goodbye:'להתראות',yes:'כן',no:'לא',
        please:'בבקשה',thanks:'תודה',school:'בית ספר',teacher:'מורה',student:'תלמיד',
        book:'ספר',word:'מילה',sentence:'משפט',answer:'תשובה',question:'שאלה',
        good:'טוב',bad:'רע',easy:'קל',hard:'קשה',new:'חדש',old:'ישן',
        big:'גדול',small:'קטן',fast:'מהיר',slow:'איטי',help:'עזרה',
        time:'זמן',day:'יום',night:'לילה',year:'שנה',today:'היום',
        work:'עבודה',life:'חיים',love:'אהבה',change:'שינוי',
        man:'איש',woman:'אישה',child:'ילד',friend:'חבר',family:'משפחה',
        house:'בית',water:'מים',food:'אוכל',money:'כסף',place:'מקום',
        city:'עיר',world:'עולם',people:'אנשים',name:'שם',
        think:'לחשוב',know:'לדעת',want:'לרצות',need:'צריך',
        come:'לבוא',go:'ללכת',see:'לראות',take:'לקחת',give:'לתת',
        make:'לעשות',say:'לומר',read:'לקרוא',write:'לכתוב',
        learn:'ללמוד',speak:'לדבר',listen:'להקשיב',remember:'לזכור',
        try:'לנסות',start:'להתחיל',stop:'לעצור',finish:'לסיים',
        create:'ליצור',edit:'לערוך',free:'חינם / חופשי',open:'לפתוח',close:'לסגור',
        send:'לשלוח',save:'לשמור',delete:'למחוק',share:'לשתף',
        find:'למצוא',search:'לחפש',add:'להוסיף',remove:'להסיר',
        play:'לשחק',run:'לרוץ',walk:'ללכת',move:'לזוז',
        happy:'שמח',sad:'עצוב',tired:'עייף',ready:'מוכן',
        important:'חשוב',different:'שונה',possible:'אפשרי',
        problem:'בעיה',idea:'רעיון',story:'סיפור',plan:'תוכנית',
        documents:'מסמכים',document:'מסמך',file:'קובץ',page:'עמוד',
        image:'תמונה',video:'וידאו',music:'מוזיקה',
      }

      const translations: string[] = []
      for (const w of result.words.slice(0, 10)) { // max 10 words
        const lower = w.toLowerCase()
        // 1. Master vocab
        const master = wordsData.find(m => m.english.toLowerCase() === lower)
        if (master) {
          translations.push(`**${w}** — ${master.hebrew}`)
          continue
        }
        // 2. Common words
        if (COMMON[lower]) {
          translations.push(`**${w}** — ${COMMON[lower]}`)
          continue
        }
        // 3. API translation
        try {
          const tr = await translateWord(w)
          if (tr) { translations.push(`**${w}** — ${tr}`); continue }
        } catch { /* ignore */ }
        translations.push(`**${w}** — ?`)
      }

      const resultMsg: ChatMessage = {
        id: `scan-result-${Date.now()}`,
        sender: 'bot',
        type: 'text',
        content: `📸 מצאתי ${result.words.length} מילים:\n\n${translations.join('\n')}\n\nרוצה לתרגל מילה? כתוב אותה ואוסיף לרשימה שלך`,
        createdAt: new Date().toISOString(),
      }
      useCoachStore.setState(s => ({ messages: [...s.messages, resultMsg] }))
      playSound('correct')
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `scan-error-${Date.now()}`,
        sender: 'bot',
        type: 'text',
        content: 'לא הצלחתי לסרוק את התמונה. נסה שוב 📸',
        createdAt: new Date().toISOString(),
      }
      useCoachStore.setState(s => ({ messages: [...s.messages, errorMsg] }))
    } finally {
      setIsScanning(false)
    }
  }, [])

  // Early return AFTER all hooks (React rules of hooks)
  if (isHidden) return null

  const handleMissionStart = (mission: Mission) => {
    // Save the mission ID so GameResultScreen can complete it when the student actually finishes
    localStorage.setItem('znk-active-mission', mission.id)
    closeWidget()
    const url = mission.routeParams && Object.keys(mission.routeParams).length > 0
      ? `${mission.route}?${new URLSearchParams(mission.routeParams).toString()}`
      : mission.route
    navigate(url)
    // Do NOT mark complete here — only on actual game/practice completion
  }

  const completed = getCompletedCount()
  const total = getTotalCount()
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

  const renderMessage = (msg: ChatMessage) => {
    if (msg.type === 'system_update' || msg.type === 'plan_update') {
      return <SystemMessage key={msg.id} message={msg} />
    }
    if (msg.type === 'mission_card' && dailyPlan) {
      const justCompletedId = msg.metadata?.justCompleted as string | undefined
      const isBonus = msg.metadata?.isBonus as boolean | undefined
      const missionsToShow = isBonus
        ? dailyPlan.missions.filter(m => m.id.startsWith('bonus-'))
        : dailyPlan.missions.filter(m => !m.id.startsWith('bonus-'))
      const remainingMin = missionsToShow
        .filter(m => m.status !== 'completed')
        .reduce((s, m) => s + m.estimatedMinutes, 0)
      return (
        <div key={msg.id} className="flex items-end gap-1.5 animate-fadeIn">
          <div style={{ width: 26, flexShrink: 0 }} />
          <div
            className="w-full rounded-2xl bg-white"
            style={{
              padding: '11px 13px',
              boxShadow: '3px 3px 10px rgba(130,120,160,0.08), -2px -2px 6px rgba(255,255,255,0.8)',
              ...(isBonus ? { border: '1.5px solid rgba(107,63,160,0.2)' } : {}),
            }}
          >
            <div className="text-[11.5px] font-bold text-gray-500 mb-1.5">
              {isBonus ? '⚡' : '📋'} {isBonus ? 'משימות בונוס' : 'התוכנית שלך להיום'} · <span style={{ color: isBonus ? '#E91E78' : '#6B3FA0' }}>
                {remainingMin > 0 ? `~${remainingMin} דק׳` : 'הושלמה!'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {missionsToShow.map(m => (
                <MissionCard
                  key={m.id}
                  mission={m}
                  onStart={handleMissionStart}
                  justCompleted={m.id === justCompletedId}
                />
              ))}
            </div>
            {/* Progress bar (only for regular missions, not bonus) */}
            {!isBonus && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(107,63,160,0.1)' }}>
                  <div
                    className="h-full rounded-full transition-[transform,box-shadow,background-color,border-color,opacity] duration-500"
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
            )}
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

      {/* Backdrop — visible on BOTH mobile and desktop now. Previously
          `md:hidden` left desktop with no click-blocker, so clicks intended
          for the practice content sometimes landed on the chat panel
          instead. The desktop backdrop is more transparent so the page
          stays legible behind the floating chat window. */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 transition-opacity duration-300"
          style={{ background: 'rgba(27, 58, 107, 0.20)' }}
          onClick={closeWidget}
        />
      )}

      {/* Sheet / Window — Mobile: bottom sheet centered, Desktop: floating left */}
      <div
        className={`coach-widget-panel fixed z-50 flex flex-col transition-[transform,box-shadow,background-color,border-color,opacity] duration-400 ${
          isOpen ? 'open' : 'pointer-events-none'
        }`}
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
              { icon: <Robot weight="fill" size={16} color="white" />, bg: 'linear-gradient(135deg, #1B3A6B, #6B3FA0)', right: 0, z: 3 },
              { icon: <UserCircle weight="fill" size={16} color="white" />, bg: 'linear-gradient(135deg, #EE2B73, #FF6B9D)', right: 12, z: 2 },
              { icon: <GraduationCap weight="fill" size={16} color="white" />, bg: 'linear-gradient(135deg, #5B21B6, #8B5CF6)', right: 24, z: 1 },
            ].map((av, i) => (
              <div
                key={i}
                className="absolute flex items-center justify-center rounded-full"
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
            <div className="text-[10px] text-white/50">{coachHeaderTagline}</div>
          </div>
          <button
            onClick={closeWidget}
            aria-label="סגור צ׳אט מאמן"
            className="flex items-center justify-center rounded-full text-white border-none cursor-pointer flex-shrink-0"
            style={{ width: 44, height: 44, fontSize: 20, lineHeight: 1, background: 'rgba(255,255,255,0.18)' }}
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
        <ChatInput onSend={sendMessage} onImageCapture={handleImageCapture} disabled={isTyping || isScanning} />
      </div>
    </>
  )
}
