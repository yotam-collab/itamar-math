import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCoachStore } from '../../stores/coachStore'
import { useStudentProfileStore } from '../../stores/studentProfileStore'
import { useGamificationStore, BADGE_DEFINITIONS } from '../../stores/gamificationStore'
import { useVocabStore } from '../../stores/vocabStore'
import { useExamStore } from '../../stores/examStore'
import { useReadingStore } from '../../stores/readingStore'
import { getProficiencyLabel, getRollingAccuracy, eloToLevel } from '../../utils/adaptiveDifficulty'
import { playSound } from '../../utils/sounds'
import { g } from '../../utils/gender'
import { asset } from '../../utils/assetUrl'
import { useProgramDay } from '../../utils/useProgramDay'
import { getRestDayReason, restDayMessage, type RestDayReason } from '../../utils/restDays'
import type { Mission } from '../../services/mockCoachData'
import {
  Rocket, Fire, Lightning, Target, CheckCircle, Lock,
  Cards, BookOpenText, ListChecks, PencilSimpleLine, Exam,
  ChartLineUp, Trophy, ClipboardText, CalendarBlank,
} from '@phosphor-icons/react'

/* ═══════════════════════════════════════════════════════════════════
   JOURNEY PAGE · Unified Plan + Stats
   Preserves the ZNK neo-brutalist visual language (yellow / navy / pink,
   2px black borders, hard offset shadows).
   ═══════════════════════════════════════════════════════════════════ */

const Z = {
  yellow: '#FFE600', yellowSoft: '#FFF7A0',
  navy: '#0d294b', navyLight: '#1a3d6b',
  pink: '#EE2B73', pinkLight: '#FF4D8E', pinkSoft: '#f8b4bc',
  purple: '#6C63FF', teal: '#38B2AC',
  correct: '#10B981', wrong: '#EF4444', warning: '#F59E0B',
  white: '#FFFFFF', black: '#000000',
  bg: '#F0F4F8', cyan: '#95d7e3', peach: '#fece95',
} as const

const fontDisplay = "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif"
const fontBody = "'Satoshi', 'DM Sans', sans-serif"

const hs = (n = 4) => `${n}px ${n}px 0 0 ${Z.black}`
const WEEKDAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const WEEKDAYS_HE_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

const MISSION_ICONS: Record<string, { Icon: typeof Cards; bg: string }> = {
  vocab_flashcards: { Icon: Cards, bg: '#FFE4E6' },
  vocab_wordhack:   { Icon: Target, bg: '#CFFAFE' },
  vocab_adaptive:   { Icon: Target, bg: '#FFEDD5' },
  vocab_learn:      { Icon: BookOpenText, bg: '#FFE4E6' },
  vocab_gravity:    { Icon: Lightning, bg: '#EDE9FE' },
  vocab_practice:   { Icon: Target, bg: '#FFEDD5' },
  reading:          { Icon: BookOpenText, bg: Z.cyan },
  exam_sc:          { Icon: ListChecks, bg: '#E8DEF8' },
  exam_restatement: { Icon: ListChecks, bg: '#E8DEF8' },
}

/* ═══════════════════════════════════════════════════════════════════ */

export function JourneyPage() {
  const navigate = useNavigate()
  const { dailyPlan, fetchPlan } = useCoachStore()
  const { examDate, studentName, vocabElo, readingElo, examElo } = useStudentProfileStore()
  const { xp, level, currentStreak, longestStreak, badges } = useGamificationStore()
  const { words, studentWords } = useVocabStore()
  const { getRecentAttempts, getAverageScore } = useExamStore()
  const { getCompletedCount: getReadingCompleted } = useReadingStore()

  const name = studentName || g('תלמיד', 'תלמידה')

  useEffect(() => { fetchPlan(name) }, [fetchPlan, name])

  // Hero title — char-by-char typing animation. Matches the "X — Y"
  // mentor-voice pattern across the other gateways:
  //   /reading    → "כל קטע — עוד נקודה לפטור"
  //   /vocabulary → "כל מילה שתזכור — מילה פחות בבחינה"
  //   /exam       → "כל שאלה פה — טעות פחות בבחינה"
  // "זוחל" was deflating (opposite of the brand word "זינוק"); this
  // version is active, gender-agnostic, and ties directly to the exam
  // goal the student already tracks (134 = exemption threshold).
  // Headline now uses static text + `.znk-h1-accent` shimmer span (matches
  // /exam, /vocabulary). The earlier typewriter effect was retired during
  // gateway-CTA + headline unification on 2026-04-28.

  // Derived data — sourced from the shared useProgramDay hook so the
  // header chip on the journey page agrees with the coach widget tagline
  // and any other place that surfaces "day in program". Previously this
  // page computed its own days-until-exam and the coach widget had a
  // HARDCODED "יום 12 · 47 ימים", which produced a visible contradiction
  // between the two screens for the same student.
  const { daysUntilExam, dayInProgram, showCountdown } = useProgramDay()
  const programDayLabel = showCountdown && dayInProgram !== null
    ? `יום ${dayInProgram} בתוכנית`
    : 'בלי תאריך בחינה'
  // examDate still drives unrelated logic on this page (week split etc.),
  // keep the destructure even though we no longer compute daysUntilExam locally.
  void examDate

  const missions = dailyPlan?.missions.filter(m => !m.id.startsWith('bonus-')) || []
  /* Mobile: collapse all-but-the-active mission to keep the primary
     CTA above the fold. Choice persists in localStorage. */
  const [missionsExpanded, setMissionsExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    if (window.innerWidth > 720) return true
    return window.localStorage.getItem('jp.missionsExpanded') === '1'
  })
  const toggleMissions = () => {
    setMissionsExpanded(v => {
      const nv = !v
      try { window.localStorage.setItem('jp.missionsExpanded', nv ? '1' : '0') } catch { /* ok */ }
      return nv
    })
  }
  const completedCount = missions.filter(m => m.status === 'completed').length
  const totalCount = missions.length
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const remainingMin = missions.filter(m => m.status !== 'completed').reduce((s, m) => s + m.estimatedMinutes, 0)
  const totalXP = missions.reduce((s, _m, i) => s + (30 + i * 10), 0) // synthetic XP per mission
  const completedXP = missions.slice(0, completedCount).reduce((s, _m, i) => s + (30 + i * 10), 0)

  // XP bar
  const xpInLevel = xp % 500
  const xpToNext = 500 - xpInLevel
  const xpPct = Math.round((xpInLevel / 500) * 100)

  // Quick stats
  const totalWords = words.length
  const masteredWords = Object.values(studentWords).filter(sw => sw.repetitions >= 3).length
  const scoreSum = getAverageScore('sc') + getAverageScore('restatement') + getAverageScore('rc') + getAverageScore('full')
  const scoreCount = [
    getAverageScore('sc') > 0 ? 1 : 0,
    getAverageScore('restatement') > 0 ? 1 : 0,
    getAverageScore('rc') > 0 ? 1 : 0,
    getAverageScore('full') > 0 ? 1 : 0,
  ].reduce((a, b) => a + b, 0)
  const overallAvg = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0
  const totalAttempts = getRecentAttempts(1000).length + masteredWords + getReadingCompleted()

  // Upcoming 7 days — detailed plan per day with actual tasks.
  // Previously used an offset-based template table (index 5 = "Friday",
  // index 6 = "Shabbat") which only worked if TODAY happened to be Sunday.
  // Replaced with DAY-OF-WEEK keyed templates + real rest-day detection
  // via getRestDayReason() (Shabbat + Jewish Yom Tov + Yom HaAtzmaut etc).
  type DayTask = { label: string; bg: string; color: string }
  const weekPlan = useMemo(() => {
    const start = new Date()
    // Templates indexed by day-of-week (0 = Sunday … 6 = Saturday).
    // Israeli school week: Sun-Thu full, Friday lighter, Saturday rest (handled
    // separately via restDay detection — this template is just a fallback).
    const TEMPLATES_BY_DOW: Record<number, { tasks: DayTask[]; minutes: number }> = {
      // Sunday — start of week: mixed foundations
      0: { tasks: [
        { label: '15 מילים חדשות', bg: '#FED5DC', color: '#9D174D' },
        { label: 'תרגול אדפטיבי', bg: '#FCE2C0', color: '#92400E' },
        { label: 'הבנת הנקרא', bg: '#CFFAFE', color: '#0F766E' },
      ], minutes: 30 },
      // Monday — vocab + exam basics
      1: { tasks: [
        { label: 'חזרה על מילים', bg: '#FCE2C0', color: '#92400E' },
        { label: 'הבנת הנקרא', bg: '#CFFAFE', color: '#0F766E' },
        { label: 'השלמת משפטים', bg: '#E0D4FF', color: '#5B21B6' },
      ], minutes: 25 },
      // Tuesday — new words + restatement
      2: { tasks: [
        { label: '15 מילים חדשות', bg: '#FED5DC', color: '#9D174D' },
        { label: 'ניסוח מחדש', bg: '#E0D4FF', color: '#5B21B6' },
        { label: 'תרגול אדפטיבי', bg: '#FCE2C0', color: '#92400E' },
      ], minutes: 30 },
      // Wednesday — review + reading + SC
      3: { tasks: [
        { label: 'חזרה על מילים', bg: '#FCE2C0', color: '#92400E' },
        { label: 'הבנת הנקרא', bg: '#CFFAFE', color: '#0F766E' },
        { label: 'השלמת משפטים', bg: '#E0D4FF', color: '#5B21B6' },
      ], minutes: 25 },
      // Thursday — new words + restatement + reading
      4: { tasks: [
        { label: '15 מילים חדשות', bg: '#FED5DC', color: '#9D174D' },
        { label: 'ניסוח מחדש', bg: '#E0D4FF', color: '#5B21B6' },
        { label: 'הבנת הנקרא', bg: '#CFFAFE', color: '#0F766E' },
      ], minutes: 30 },
      // Friday — lighter (half-day in Israeli schools)
      5: { tasks: [
        { label: 'חזרה על מילים', bg: '#FCE2C0', color: '#92400E' },
        { label: 'קריאה קלה', bg: '#CFFAFE', color: '#0F766E' },
      ], minutes: 15 },
      // Saturday — handled as rest day via restDay detection, not this template
      6: { tasks: [], minutes: 0 },
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i)
      const dow = d.getDay()
      const restReason: RestDayReason | null = getRestDayReason(d)
      const template = TEMPLATES_BY_DOW[dow] || TEMPLATES_BY_DOW[0]
      return {
        dayShort: WEEKDAYS_HE_SHORT[dow],
        dayName: WEEKDAYS_HE[dow],
        dayNum: d.getDate(),
        isToday: i === 0,
        isTomorrow: i === 1,
        isSat: dow === 6,
        // Rest-day metadata — UI uses this to render a "מנוחה" card instead
        // of tasks. Covers Shabbat + Yom Tov + Yom HaZikaron + Yom HaAtzmaut.
        restReason,
        restMessage: restReason ? restDayMessage(restReason) : null,
        tasks: restReason ? [] : template.tasks,
        minutes: restReason ? 0 : template.minutes,
      }
    })
  }, [])

  // Weekly plan until the exam — progressive themes
  const periodPlan = useMemo(() => {
    if (!daysUntilExam || daysUntilExam <= 0) return []
    const total = Math.ceil(daysUntilExam / 7)
    return Array.from({ length: total }, (_, i) => {
      const weeksFromExam = total - i
      let theme = ''
      if (weeksFromExam === 1) theme = '🎯 שבוע הבחינה · סיבוב אחרון וראש קר'
      else if (weeksFromExam === 2) theme = '🚀 סימולציות מלאות · כמו ביום עצמו'
      else if (weeksFromExam <= 4) theme = '💪 תרגול אינטנסיבי · חיזוק חולשות'
      else if (weeksFromExam <= 6) theme = '📝 מעבר על כל סוגי השאלות'
      else theme = '📚 יסודות · אוצר מילים + הבנת הנקרא'
      return { num: i + 1, theme, current: i === 0, totalWeeks: total }
    }).slice(0, 8)
  }, [daysUntilExam])

  // Weekly streak calendar
  const today = new Date()
  const todayIdx = today.getDay() // 0=Sunday … 6=Saturday
  const weekCells = WEEKDAYS_HE_SHORT.map((day, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (todayIdx - i))
    const inStreakRange = currentStreak > 0 && (todayIdx - i) < currentStreak && i <= todayIdx
    return {
      day,
      dayNum: d.getDate(),
      done: inStreakRange,
      isToday: i === todayIdx,
      future: i > todayIdx,
    }
  })

  // Skills
  const skills = [
    {
      key: 'vocab' as const, label: 'אוצר מילים', emoji: '📚', accent: Z.pink, bg: '#FFE4E6',
      elo: vocabElo, acc: getRollingAccuracy('vocab'), level: eloToLevel(vocabElo),
      prof: getProficiencyLabel(vocabElo), path: '/vocabulary',
    },
    {
      key: 'exam' as const, label: 'שאלות בחינה', emoji: '📝', accent: Z.purple, bg: '#E8DEF8',
      elo: examElo, acc: getRollingAccuracy('exam'), level: eloToLevel(examElo),
      prof: getProficiencyLabel(examElo), path: '/exam',
    },
    {
      key: 'reading' as const, label: 'הבנת הנקרא', emoji: '📖', accent: Z.teal, bg: Z.cyan,
      elo: readingElo, acc: getRollingAccuracy('reading'), level: eloToLevel(readingElo),
      prof: getProficiencyLabel(readingElo), path: '/reading',
    },
  ]

  // Achievements (badges)
  const badgeList = BADGE_DEFINITIONS.slice(0, 6).map(b => ({
    ...b,
    earned: badges.includes(b.id),
  }))

  // Recent activity
  const recentAttempts = getRecentAttempts(4)

  // Handlers
  const handleMissionClick = (m: Mission) => {
    if (m.status === 'completed' || m.status === 'locked') return
    playSound('click')
    localStorage.setItem('znk-active-mission', m.id)
    if (m.routeParams && Object.keys(m.routeParams).length > 0) {
      const qs = new URLSearchParams(m.routeParams).toString()
      navigate(`${m.route}?${qs}`)
    } else {
      navigate(m.route)
    }
  }

  return (
    <div className="jp" style={{ margin: -16 }}>
      <style>{cssBlock}</style>

      <div className="jp-wrap">

        {/* ── HERO ── */}
        <section className="jp-hero fade">
          <div className="jp-hero-inner">
            <div>
              {/* Section crown — pixel-identical to /reading, /exam,
                  /exam/full, /vocabulary so every gateway shares one
                  "you are in zone X" identifier. Replaces the earlier
                  small .jp-kicker pill which was visually inconsistent
                  with the other gateway crowns. */}
              <span className="jp-section-crown" aria-label="אזור תוכנית אישית">
                <span className="jp-section-crown-ico" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18" />
                    <path d="M7 17l4-6 4 3 5-7" />
                    <circle cx="7" cy="17" r="1.5" />
                    <circle cx="11" cy="11" r="1.5" />
                    <circle cx="15" cy="14" r="1.5" />
                    <circle cx="20" cy="7" r="1.5" />
                  </svg>
                </span>
                <span className="jp-section-crown-text">
                  <small>אמירנט · התוכנית שלי</small>
                  <b>{programDayLabel}</b>
                </span>
              </span>
              <h1>
                {/* Gateway-page H1 — accent shimmer on the leading phrase,
                    unified with /exam and /vocabulary via the global
                    `.znk-h1-accent` class (src/index.css). Replaces the
                    earlier typing animation per design unification. */}
                {studentName ? `${studentName}, ` : ''}
                <span className="znk-h1-accent">כל יום</span> פה =<br />
                עוד נקודה ל-134.
              </h1>
              <p className="lede">
                {currentStreak >= 3
                  ? `${currentStreak} ימים ברצף — ${g('אל תוריד', 'אל תורידי')} רגל מהגז. הנה מה עושים היום, ולאן זה מוביל.`
                  : `הכל במקום אחד: מה לעשות היום, איפה ${g('אתה', 'את')} עכשיו, והצעד הבא.`}
              </p>
              {/* Primary mobile CTA — jumps straight to the next active
                  mission. Hidden on desktop (the missions list provides
                  enough affordance there). On mobile this is the
                  ABOVE-THE-FOLD hook the student is looking for. */}
              {(() => {
                const nextMission = missions.find(m => m.status !== 'completed' && m.status !== 'locked')
                /* Three states — the CTA ALWAYS renders so it's always
                   above the fold. Active mission → jump to it. All
                   missions done → scroll to bonus / preview. No
                   missions at all → scroll to (empty) missions section
                   so the user sees the empty-state UI. */
                const label = nextMission
                  ? 'יאללה, לתרגול הבא'
                  : missions.length > 0
                    ? 'סיימת היום — מה הלאה?'
                    : 'הצג את התוכנית שלי'
                const handleCta = () => {
                  if (nextMission) { handleMissionClick(nextMission); return }
                  const tgt = document.querySelector('.jp-missions') || document.querySelector('.jp-schedule')
                  tgt?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                return (
                  <button type="button" className="jp-hero-cta znk-cta-primary znk-tooltip" onClick={handleCta}>
                    <span className="znk-tip" data-placement="bottom" role="tooltip">
                      התרגול הבא שלך — לפי המסע ולפי המקום שבו אתה עומד היום
                    </span>
                    <span>{label}</span>
                    {/* Arrow LEFT — forward direction in RTL (unified across gateways) */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                  </button>
                )
              })()}
            </div>
            <div className="jp-hero-side">
              {daysUntilExam !== null && daysUntilExam > 0 && (
                <div className="jp-countdown" data-tip={`עוד ${daysUntilExam} ימים לתאריך הבחינה. כל יום שעובר בלי תרגול — יום פחות.`}>
                  <div>
                    <div className="num">{daysUntilExam}</div>
                    <div className="lbl">ימים לאמירנט</div>
                  </div>
                  <div className="body">בקצב הזה {g('אתה מגיע', 'את מגיעה')} {g('מוכן', 'מוכנה')} בדיוק בזמן.</div>
                </div>
              )}
              <div className="jp-xp" data-tip={`רמה ${level} · ${xp.toLocaleString()} XP. כל רמה פותחת הישגים ויכולות חדשות. עוד ${xpToNext} XP לרמה הבאה.`}>
                <div className="jp-xp-head">
                  <b>רמה {level} · {xp.toLocaleString()} XP</b>
                  <small>עוד {xpToNext} XP לרמה {level + 1}</small>
                </div>
                <div className="jp-xp-track"><div style={{ width: `${xpPct}%` }} /></div>
                <div className="jp-xp-note">⭐ עוד {Math.max(1, 5 - completedCount)} משימות והישג חדש נפתח</div>
              </div>
            </div>
            {/* ZNK character — exclusive to Journey page */}
            <img
              className="jp-hero-char"
              src={asset('char-hakalot.png')}
              alt=""
              aria-hidden="true"
            />
          </div>
        </section>

        {/* ── QUICK STATS ── */}
        <section className="jp-quick fade d1">
          <div className={`jp-qs pink`} data-tip={currentStreak > 0 ? `${currentStreak} ימים רצוף ${g('נכנסת','נכנסת')} לתרגל. אל תשבור/י את הרצף — הוא שריר.` : `יום ראשון לרצף חדש מחכה לך. תרגול אחד היום מתחיל את הספירה.`}>
            <span className="ico"><Fire weight="fill" size={18} /></span>
            <b>{currentStreak}</b>
            <span>ימי רצף</span>
          </div>
          <div className="jp-qs yellow" data-tip={`כל תרגול מוסיף נקודות זינוק. ${xpToNext} XP ורמה חדשה נפתחת.`}>
            <span className="ico"><Lightning weight="fill" size={18} /></span>
            <b>{xp.toLocaleString()}</b>
            <span>נקודות זינוק</span>
          </div>
          <div className="jp-qs cyan" data-tip={overallAvg > 0 ? `ממוצע הציון בכל התרגולים. היעד: 85%+ לפטור.` : `עוד אין מספיק נתונים — כמה תרגולים והמספר יתחיל לדבר.`}>
            <span className="ico"><Target weight="fill" size={18} /></span>
            <b>{overallAvg || '—'}{overallAvg > 0 ? '%' : ''}</b>
            <span>דיוק ממוצע</span>
          </div>
          <div className="jp-qs" data-tip={`סה״כ סיבובי תרגול שסגרת באפליקציה. כל אחד מקרב לפטור.`}>
            <span className="ico"><Trophy weight="fill" size={18} /></span>
            <b>{totalAttempts}</b>
            <span>תרגולים</span>
          </div>
        </section>

        {/* ── TODAY MISSIONS ── */}
        {missions.length > 0 && (
          <>
            <div className="jp-shead">
              <h2>
                <span className="ico"><ListChecks weight="duotone" size={20} /></span>
                התוכנית של היום
              </h2>
              <small>{totalCount - completedCount} משימות · ~{remainingMin} דק׳ · +{totalXP - completedXP} XP</small>
            </div>

            <section className={`jp-missions fade d1 ${missionsExpanded ? '' : 'collapsed'}`}>
              <div className="jp-missions-top">
                <h3>
                  {progressPct === 100
                    ? `🎉 יום מלא! כל המשימות סגורות.`
                    : `${remainingMin} דקות היום = יום שלם קדימה`}
                </h3>
                <span className="meta">{completedCount}/{totalCount} · +{completedXP} XP</span>
              </div>
              <div className="jp-missions-progress">
                <span>🎯</span>
                <div className="bar"><div style={{ width: `${progressPct}%` }} /></div>
                <b>{progressPct}%</b>
              </div>

              <div className="jp-missions-rail">
                {missions.map((m, i) => {
                  const meta = MISSION_ICONS[m.type] || MISSION_ICONS.vocab_flashcards
                  const Icon = meta.Icon
                  const isDone = m.status === 'completed'
                  const isLocked = m.status === 'locked'
                  const isActive = !isDone && !isLocked && (missions.find(mm => mm.status !== 'completed' && mm.status !== 'locked')?.id === m.id)
                  const missionXP = 30 + i * 10
                  const lockedTip = `זה ייפתח ברגע ${g('שתסיים', 'שתסיימי')} את המשימה שמעליו. אנחנו פותחים צעד-צעד כדי שכל דבר ייבנה על קודמיו.`
                  return (
                    <div
                      key={m.id}
                      className={`jp-mission ${isDone ? 'done' : ''} ${isLocked ? 'locked' : ''} ${isActive ? 'active' : ''}`}
                      onClick={() => handleMissionClick(m)}
                      data-tip={isLocked ? lockedTip : undefined}
                      title={isLocked ? lockedTip : undefined}
                    >
                      <div className="ico" style={{ background: isDone ? Z.correct : isLocked ? '#E5E7EB' : meta.bg, color: isDone || isLocked ? '#fff' : Z.black }}>
                        {isDone ? <CheckCircle weight="fill" size={26} /> : isLocked ? <Lock weight="fill" size={22} /> : <Icon weight="duotone" size={26} />}
                      </div>
                      <div>
                        <b>{m.title}</b>
                        <small>{m.subtitle} · {m.estimatedMinutes} דק׳{isLocked ? ' · ייפתח אחרי המשימה שמעליו' : ''}</small>
                      </div>
                      <span className="xp">+{missionXP} XP</span>
                      <span className={`pill ${isDone ? 'done' : isLocked ? 'locked' : ''}`}>
                        {isDone ? 'הושלם ✓' : isLocked ? '🔒 ממתין' : g('להתחיל', 'להתחיל')}
                      </span>
                    </div>
                  )
                })}
              </div>
              {missions.length > 1 && (
                <button
                  type="button"
                  className="jp-missions-toggle znk-tooltip"
                  onClick={toggleMissions}
                  aria-expanded={missionsExpanded}
                >
                  <span className="znk-tip" data-placement="top" role="tooltip">
                    {missionsExpanded ? 'נחסוך מקום למסך' : 'תראה את כל מה שמחכה לך היום'}
                  </span>
                  {missionsExpanded
                    ? 'הסתר משימות נוספות ↑'
                    : `+${missions.length - 1} משימות נוספות ↓`}
                </button>
              )}
              {/* Primary practice CTA pinned to the bottom of the missions
                  tile — yellow glowing pill matching the hero CTA so the
                  student has a second clear "start practicing" anchor right
                  where their eye lands when reading the tile. */}
              {(() => {
                const next = missions.find(m => m.status !== 'completed' && m.status !== 'locked')
                if (!next) return null
                return (
                  <button
                    type="button"
                    className="jp-missions-cta"
                    onClick={() => handleMissionClick(next)}
                  >
                    <span>⚡ התחל לתרגל</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                  </button>
                )
              })()}
            </section>
          </>
        )}

        {/* ── WEEKLY STREAK ── */}
        <section className="jp-week fade d2">
          <div className="jp-week-head">
            <h3>
              <span className="ico" style={{ background: Z.pink }}><Fire weight="fill" size={16} color="#fff" /></span>
              {currentStreak >= 1 ? `רצף של ${currentStreak} ימים` : g('תתחיל רצף היום', 'תתחילי רצף היום')}
            </h3>
            <small>{longestStreak > 0 && `🏆 שיא: ${longestStreak} ימים`}</small>
          </div>
          <div className="jp-week-grid">
            {weekCells.map((c, i) => (
              <div
                key={i}
                className={`jp-day ${c.done ? 'done' : ''} ${c.isToday ? 'today' : ''} ${c.future ? 'future' : ''}`}
                data-tip={
                  c.done ? `יום ${c.day} — סגור ✓ תרגלת והרצף חי.`
                  : c.isToday ? `היום! עוד לא מאוחר — תרגול אחד סוגר את היום.`
                  : c.future ? `יום ${c.day} עדיין מחכה — כשתגיע, תעשה את שלך.`
                  : `יום ${c.day} — לא תרגלת. חבל, אבל הרצף הבא בידיים שלך.`
                }
              >
                <small>{c.day}</small>
                <b>{c.dayNum}</b>
                <div className="mark">{c.done ? '🔥' : c.isToday ? '⚡' : c.future ? '·' : '—'}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── UPCOMING PLAN: WEEK + PERIOD ── */}
        <div className="jp-shead">
          <h2>
            <span className="ico"><CalendarBlank weight="duotone" size={20} /></span>
            התוכנית שלפניך
          </h2>
          <small>השבוע הקרוב והמסלול עד אמירנט</small>
        </div>
        <section className="jp-schedule fade d2">
          {/* Week — detailed list with tasks per day */}
          <div className="jp-sched-block">
            <h4>השבוע הקרוב</h4>
            <div className="jp-sched-list">
              {weekPlan.map((d, i) => {
                const todayMin = d.isToday ? Math.max(remainingMin, d.minutes) : d.minutes
                const todayDone = d.isToday && completedCount === totalCount && totalCount > 0
                const isRest = !!d.restReason
                return (
                  <div
                    key={i}
                    className={`jp-sched-row ${d.isToday ? 'today' : ''} ${d.isTomorrow ? 'tomorrow' : ''} ${isRest ? 'rest' : ''}`}
                    onClick={() => {
                      if (d.isToday) {
                        const tgt = document.querySelector('.jp-missions')
                        tgt?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                    }}
                    role={d.isToday ? 'button' : undefined}
                    tabIndex={d.isToday ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (d.isToday && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        const tgt = document.querySelector('.jp-missions')
                        tgt?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                    }}
                  >
                    <div className="jp-sched-row-head">
                      <div className={`jp-sched-daynum ${d.isToday ? 'today' : d.isTomorrow ? 'tomorrow' : ''} ${isRest ? 'rest' : ''}`}>{d.dayNum}</div>
                      <div className="jp-sched-daylabel">
                        <b>{d.isToday ? 'היום' : d.isTomorrow ? 'מחר' : `יום ${d.dayName}`}</b>
                        {isRest && (
                          <small>{d.restReason?.hebrewName}</small>
                        )}
                        {!isRest && d.isToday && totalCount > 0 && (
                          <small>{completedCount}/{totalCount} משימות {todayDone ? '— סיימת' : 'הושלמו'}</small>
                        )}
                      </div>
                      <span className={`jp-sched-time ${isRest ? 'rest' : d.isToday ? (todayDone ? 'done' : 'active') : ''}`}>
                        {isRest ? 'יום מנוחה' : d.isToday ? (todayDone ? 'הושלם!' : `${todayMin} דק׳`) : `~${d.minutes} דק׳`}
                      </span>
                    </div>
                    {isRest && d.restMessage && (
                      <div className="jp-sched-rest">
                        <b>{d.restMessage.title}</b>
                        <small>{d.restMessage.subtitle}</small>
                      </div>
                    )}
                    {!isRest && d.isToday && missions.length > 0 && (
                      <div className="jp-sched-tasks">
                        {missions.map(m => {
                          const isDone = m.status === 'completed'
                          return (
                            <span key={m.id} className={`jp-task-chip ${isDone ? 'done' : ''}`}>
                              {m.title}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    {!isRest && !d.isToday && d.tasks.length > 0 && (
                      <div className="jp-sched-tasks">
                        {d.tasks.map((t, ti) => (
                          <span
                            key={ti}
                            className="jp-task-chip"
                            style={{ background: t.bg, color: t.color, borderColor: t.color + '33' }}
                          >
                            {t.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Period */}
          {periodPlan.length > 0 && (
            <div className="jp-sched-block">
              <h4>המסלול עד אמירנט · {periodPlan.length} {periodPlan.length === 1 ? 'שבוע' : 'שבועות'}</h4>
              <div className="jp-sched-weeks">
                {periodPlan.map((w) => {
                  const weeksFromExam = w.totalWeeks - (w.num - 1)
                  const tip = w.current
                    ? `השבוע הנוכחי. ${w.theme.replace(/^[^·]+·\s*/, '')} — המיקוד שלך כרגע.`
                    : weeksFromExam === 1
                    ? `שבוע הבחינה — ברגע שמגיעים לפה, רק סיבוב רענון. בלי פאניקה.`
                    : `עוד ${weeksFromExam - 1} שבועות והשבוע הזה יגיע. תכין/י את הבסיס עכשיו.`
                  return (
                    <div key={w.num} className={`jp-sched-wrow ${w.current ? 'current' : ''}`} data-tip={tip}>
                      <span className="n">שבוע {w.num}</span>
                      <span className="t">{w.theme}</span>
                      {w.current && <span className="now">← כעת</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {/* ── SKILLS ── */}
        <div className="jp-shead">
          <h2>
            <span className="ico"><ChartLineUp weight="duotone" size={20} /></span>
            הרמה שלך בכל כישור
          </h2>
          <small>שלושה כישורים, רמה אחת אמיתית</small>
        </div>
        <section className="jp-skills fade d2">
          {skills.map(s => (
            <div key={s.key} className="jp-skill" style={{ ['--acc' as any]: s.accent, ['--accBg' as any]: s.bg }}
              onClick={() => navigate(s.path)}>
              <div className="top">
                <div className="sico" style={{ background: s.bg }}>{s.emoji}</div>
                <div>
                  <div className="sname">{s.label}</div>
                  <div className="slabel">{s.prof} · רמה {s.level}</div>
                </div>
              </div>
              <div className="elo">{s.elo}<span className="eloUnit">ELO</span></div>
              <div className="track"><div style={{ width: `${Math.min(100, Math.max(5, Math.round(((s.elo - 600) / 1200) * 100)))}%` }} /></div>
              <div className="meta">
                <span>{s.acc !== null ? `${Math.round(s.acc * 100)}% דיוק` : 'טרם תורגל'}</span>
                <span>→ תרגול</span>
              </div>
            </div>
          ))}
        </section>

        {/* ── ACHIEVEMENTS ── */}
        <div className="jp-shead">
          <h2>
            <span className="ico"><Trophy weight="duotone" size={20} /></span>
            הישגים
          </h2>
          <small>{g('הרווחת', 'הרווחת')} {badges.length}/{BADGE_DEFINITIONS.length}</small>
        </div>
        <section className="jp-ach-grid fade d3">
          {badgeList.map(b => (
            <div key={b.id} className={`jp-ach ${b.earned ? 'done' : 'locked'}`}>
              <div className="ico">{b.icon}</div>
              <b>{b.name}</b>
              <small>{b.earned ? 'הושלם' : b.description}</small>
            </div>
          ))}
        </section>

        {/* ── RECENT ACTIVITY ── */}
        {recentAttempts.length > 0 && (
          <>
            <div className="jp-shead">
              <h2>
                <span className="ico"><ChartLineUp weight="duotone" size={20} /></span>
                פעילות אחרונה
              </h2>
              <small>השבוע {g('שלך', 'שלך')}</small>
            </div>
            <section className="jp-activity fade d4">
              <div className="jp-activity-head">
                <h3>השבוע {g('שלך', 'שלך')} במספרים</h3>
                <small>תרגולים אחרונים</small>
              </div>
              {recentAttempts.map(a => {
                const pct = Math.round((a.score / a.totalQuestions) * 100)
                const colorClass = pct >= 70 ? 'ok' : pct >= 50 ? 'warn' : 'bad'
                const meta: Record<string, { icon: string; label: string; c: string }> = {
                  sc: { icon: '✏️', label: 'השלמת משפטים', c: 'vocab' },
                  rc: { icon: '📖', label: 'הבנת הנקרא', c: 'read' },
                  restatement: { icon: '🔄', label: 'ניסוח מחדש', c: 'exam' },
                  full: { icon: '🚀', label: 'פרק בחינה אמיתי', c: 'exam' },
                }
                const m = meta[a.type] || meta.full
                const d = new Date(a.completedAt)
                return (
                  <div key={a.id} className={`jp-activity-row c-${m.c}`}>
                    <div className="ico">{m.icon}</div>
                    <div>
                      <h5>{m.label}</h5>
                      <small>{d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })} · {a.score}/{a.totalQuestions}</small>
                    </div>
                    <span className="xp">+{a.score * 15 + 10} XP</span>
                    <span className={`score ${colorClass}`}>{pct}%</span>
                  </div>
                )
              })}
            </section>
          </>
        )}

        {/* ── FOOTER CTA ── */}
        <section className="jp-foot fade d5">
          <h3>
            {totalCount - completedCount > 0
              ? `עוד ${totalCount - completedCount} משימות וסגרת את היום.`
              : `יום מלא. כל הכבוד. 🎯`}
          </h3>
          <p>
            {totalCount - completedCount > 0
              ? `כמה דקות עכשיו = שבוע סגור בלי פרצות.`
              : `מחר יום חדש, משימות חדשות. נתראה.`}
          </p>
          {totalCount - completedCount > 0 && (
            <button className="btn" onClick={() => {
              const next = missions.find(m => m.status !== 'completed' && m.status !== 'locked')
              if (next) handleMissionClick(next)
            }}>
              יאללה, לתרגול הבא ←
            </button>
          )}
        </section>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════ */

const cssBlock = `
@import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,700,800&f[]=satoshi@400,500,700&display=swap');

.jp{
  --Zy:${Z.yellow}; --Zys:${Z.yellowSoft};
  --Zn:${Z.navy}; --Zp:${Z.pink}; --Zps:${Z.pinkSoft};
  --Zpu:${Z.purple}; --Zt:${Z.teal};
  --Zk:${Z.correct}; --Zw:${Z.wrong}; --Zwr:${Z.warning};
  --Zb:${Z.bg}; --Zc:${Z.cyan}; --Zpe:${Z.peach};
  --ff-d:${fontDisplay}; --ff-b:${fontBody};
  background:${Z.bg}; color:${Z.black}; min-height: 100dvh;
  padding-bottom: 60px;
  font-family: var(--ff-b);
}

@keyframes fadeSlideUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes streakFire { 0%,100%{ transform: scale(1); } 50%{ transform: scale(1.15); } }
@keyframes barGrow { from { width: 0%; } }

.fade{ animation: fadeSlideUp .55s ease-out both; }
.fade.d1{ animation-delay: .08s; }
.fade.d2{ animation-delay: .16s; }
.fade.d3{ animation-delay: .24s; }
.fade.d4{ animation-delay: .32s; }
.fade.d5{ animation-delay: .40s; }

.jp-wrap{ max-width: 1120px; margin: 0 auto; padding: 20px 16px 40px; }

/* ══ HERO ══ */
.jp-hero{
  position: relative; overflow: hidden;
  background: ${Z.navy}; color: #fff;
  border: 2px solid ${Z.black}; box-shadow: ${hs(6)};
  border-radius: 28px; padding: 32px 28px; margin-bottom: 20px;
}
.jp-hero::before{
  content: ""; position: absolute; top: -40px; right: -40px;
  width: 160px; height: 160px; border-radius: 50%;
  background: ${Z.pink}; opacity: .25;
}
.jp-hero-inner{ display: grid; grid-template-columns: 1.3fr 1fr auto; gap: 28px; align-items: flex-end; position: relative; }
@media (max-width: 820px){ .jp-hero-inner{ grid-template-columns: 1fr; } }

.jp-kicker{
  display: inline-flex; align-items: center; gap: 8px;
  background: ${Z.yellow}; color: ${Z.black};
  border: 2px solid ${Z.black}; border-radius: 8px;
  padding: 5px 12px; font-family: var(--ff-d);
  font-size: 11px; font-weight: 800; letter-spacing: .06em;
  box-shadow: ${hs(2)}; margin-bottom: 12px;
}
.jp-kicker .dot{ width: 8px; height: 8px; border-radius: 50%; background: ${Z.pink}; border: 1px solid ${Z.black}; }

/* ── Gateway section crown — pixel-identical to /reading .rh-section-crown,
   /exam .eh-section-crown, /exam/full .feh-section-crown, /vocabulary
   .vh-section-crown. One crown system across all five gateways. ── */
.jp-section-crown{
  display: inline-flex; align-items: center; gap: 14px;
  padding: 14px 22px 14px 18px;
  background: linear-gradient(135deg, ${Z.yellow} 0%, #FFC72C 100%);
  color: ${Z.black};
  border: 3px solid ${Z.black};
  border-radius: 999px;
  box-shadow: 5px 5px 0 0 ${Z.black};
  margin-bottom: 16px;
  animation: jpCrownIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.jp-section-crown-ico{
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border-radius: 50%;
  background: linear-gradient(135deg, ${Z.black}, ${Z.navy});
  color: ${Z.yellow};
  box-shadow: inset 0 1px 2px rgba(255,255,255,0.15);
  flex-shrink: 0;
}
.jp-section-crown-ico svg{ width: 24px; height: 24px; }
.jp-section-crown-text{ display: flex; flex-direction: column; gap: 2px; line-height: 1; text-align: right; }
.jp-section-crown-text small{
  font-family: var(--ff-d);
  font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
  color: rgba(0,0,0,0.65);
}
.jp-section-crown-text b{
  font-family: var(--ff-d);
  font-size: 26px; font-weight: 900; letter-spacing: -0.015em;
  color: ${Z.black};
  line-height: 1.05;
}
@keyframes jpCrownIn {
  0% { opacity: 0; transform: translateY(-8px) scale(0.95); }
  60% { opacity: 1; transform: translateY(0) scale(1.03); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@media (max-width: 720px) {
  .jp-section-crown {
    padding: 6px 12px 6px 8px;
    gap: 8px;
    margin-bottom: 6px;
    border-width: 2px;
    box-shadow: 3px 3px 0 0 ${Z.black};
  }
  .jp-section-crown-ico { width: 26px; height: 26px; }
  .jp-section-crown-ico svg { width: 15px; height: 15px; }
  .jp-section-crown-text small { font-size: 8.5px; letter-spacing: 0.12em; }
  .jp-section-crown-text b { font-size: 14px; line-height: 1.1; }
}

/* ════════════════════════════════════════════════════════════════════
   MOBILE REORGANIZATION (2026-04-24) — /journey was very crowded:
   hero (crown + h1 + lede + countdown + xp + char) + 4 quick-stats +
   today-missions header + missions list + weekly grid + schedule + ...
   The student had to scroll past ~600px before hitting the first
   "להתחיל" mission CTA. Fix:
     1. Compress hero — hide lede + countdown + xp on mobile (those move
        to dedicated sections lower down).
     2. Smaller h1, no typing-flicker tax above the fold.
     3. Tighter quick-stats grid spacing.
     4. Reorder via CSS order so the today-missions section sits
        IMMEDIATELY after the compressed hero, putting the first
        "להתחיל" button above the fold on iPhone SE (≥667 viewport).
   ════════════════════════════════════════════════════════════════════ */
@media (max-width: 720px) {
  .jp{ margin: -12px !important; }
  .jp-wrap{ padding: 12px 12px 30px; gap: 0; display: flex; flex-direction: column; }

  /* Compress hero */
  .jp-hero{ padding: 14px 16px 16px; margin-bottom: 0; border-radius: 20px; }
  .jp-hero-inner{ gap: 10px; grid-template-columns: 1fr; }
  .jp-hero h1{
    font-size: clamp(22px, 6.2vw, 28px) !important;
    line-height: 1.1 !important;
    letter-spacing: -0.025em;
    gap: 8px;
  }
  .jp-hero h1 .ico{ width: 32px; height: 32px; font-size: 18px; }
  .jp-hero .lede{
    /* secondary on mobile — pushes missions below the fold */
    display: none;
  }
  .jp-hero-side,
  .jp-hero .jp-hero-side,
  .jp-hero-inner > .jp-hero-side{
    /* countdown + xp ("level meter") duplicate info shown later in
       quick-stats AND were colliding with the bottom-left character
       on mobile. Hidden hard on mobile with redundant selectors so
       no later rule can sneak past. */
    display: none !important;
  }

  /* Mobile order — v4 (2026-04-26). Per user feedback:
       — Today's plan + missions need to be ABOVE the quick-stats row.
       — Activity feed must sit at the very BOTTOM of the page.
     Each section gets an explicit order so default-0 elements never
     leak in front of order:1. */
  .jp-wrap > .jp-hero                        { order: 1; }
  .jp-wrap > div.jp-shead:nth-of-type(1)     { order: 2; }   /* "התוכנית של היום" */
  .jp-wrap > .jp-missions                    { order: 3; }
  .jp-wrap > .jp-quick                       { order: 4; margin-top: 14px; }
  .jp-wrap > div.jp-shead:nth-of-type(2)     { order: 5; }   /* "השבוע הקרוב" */
  .jp-wrap > .jp-week                        { order: 6; }
  .jp-wrap > .jp-schedule                    { order: 7; }
  /* Hidden sections + their sheads — kept ordered for stability. */
  .jp-wrap > div.jp-shead:nth-of-type(3)     { order: 8; }
  .jp-wrap > .jp-skills                      { order: 9; }
  .jp-wrap > div.jp-shead:nth-of-type(4)     { order: 10; }
  .jp-wrap > .jp-ach-grid                    { order: 11; }
  /* The 5th shead is "פעילות אחרונה" — without an explicit order it
     defaults to 0 and renders BEFORE the hero. Pin it to 98 so it
     sits right next to (and just before) its activity section. */
  .jp-wrap > div.jp-shead:nth-of-type(5)     { order: 98 !important; }
  .jp-wrap > .jp-activity                    { order: 99 !important; }

  /* Tighter today-section heading */
  .jp-shead{ margin: 14px 4px 10px; }
  .jp-shead h2{ font-size: 17px; gap: 8px; }
  .jp-shead h2 .ico{ width: 28px; height: 28px; }
  .jp-shead small{ font-size: 11px; }

  /* Missions card on mobile — restyled to match the dashboard's
     .dash-track strip: dark purple gradient + white text + a single
     yellow CTA. The yellow "X דקות היום = יום שלם קדימה" banner is
     hidden because the hero already carries the positive message
     (per user feedback 2026-04-26). */
  .jp-missions{
    border-radius: 20px;
    border: 0 !important;
    background:
      radial-gradient(circle at 88% 10%, rgba(255,230,0,0.18), transparent 45%),
      radial-gradient(circle at 12% 88%, rgba(238,43,115,0.22), transparent 50%),
      linear-gradient(135deg, #1a0b3a 0%, #3a1a6b 45%, #7c3aed 95%) !important;
    box-shadow: 0 14px 36px -12px rgba(91,33,182,0.45), inset 0 1px 0 rgba(255,255,255,0.08) !important;
    color: #fff;
    overflow: hidden;
  }
  /* Hide the yellow banner with the positive-message h3 — duplicate
     of what the hero already says. */
  .jp-missions-top{ display: none !important; }
  /* Progress bar restyled for the dark surface. */
  .jp-missions-progress{
    padding: 14px 18px !important;
    background: rgba(255,255,255,0.08) !important;
    border-bottom: 1px solid rgba(255,255,255,0.12) !important;
  }
  .jp-missions-progress .bar{
    background: rgba(255,255,255,0.14) !important;
    border-color: transparent !important;
  }
  .jp-missions-progress .bar > div{
    background: linear-gradient(90deg, #10B981 0%, #FFE600 55%, #EE2B73 100%) !important;
    border-color: transparent !important;
  }
  .jp-missions-progress b{ color: #FFE600 !important; }
  /* Hide the duplicate primary CTA inside the missions card —
     the hero already has the equivalent action. */
  .jp-missions-cta{ display: none !important; }
  /* Hide the "+N more" toggle — the rail shows all missions. */
  .jp-missions-toggle{ display: none !important; }
  .jp-missions-progress{ padding: 12px 16px; gap: 10px; }
  .jp-missions-progress .bar{ height: 12px; }
  .jp-missions-progress b{ font-size: 12.5px; }

  /* Mission rail — mirrors the dashboard .dash-rail mini-bubble pattern
     so ALL 6 daily missions fit on a single row of an iPhone SE viewport
     without horizontal scrolling. 36px circular bubble + 2-line title
     below + connecting progress-line behind. Active state gets the same
     pink-fill + yellow-ring + soft pulse used on the dashboard. */
  .jp-missions-rail{
    display: flex !important;
    flex-direction: row !important;
    align-items: flex-start !important;
    justify-content: space-between !important;
    gap: 4px !important;
    padding: 16px 14px 14px !important;
    position: relative;
    overflow-x: visible !important;
    overflow-y: visible !important;
  }
  /* Connecting line behind the bubbles — subtle white track that the
     active state sits on top of. */
  .jp-missions-rail::before{
    content: '';
    position: absolute;
    top: 34px;
    left: 28px;
    right: 28px;
    height: 3px;
    background: rgba(255,255,255,0.14);
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.18);
    border-radius: 999px;
    pointer-events: none;
    z-index: 0;
  }

  .jp-mission{
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: flex-start !important;
    gap: 5px !important;
    flex: 1 1 0 !important;
    width: auto !important;
    min-width: 0 !important;
    max-width: 16.6%;
    padding: 0 !important;
    background: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
    cursor: pointer;
    position: relative;
    z-index: 1;
    transition: transform .18s ease;
  }
  .jp-mission:active{ transform: scale(0.96) !important; }

  .jp-mission .ico{
    width: 36px !important;
    height: 36px !important;
    border-radius: 50% !important;
    border: 2.5px solid rgba(255,255,255,0.28) !important;
    box-shadow: 0 3px 8px rgba(0,0,0,0.32) !important;
    flex-shrink: 0;
  }
  .jp-mission .ico svg{ width: 18px !important; height: 18px !important; }
  .jp-mission > div:nth-of-type(2){
    text-align: center;
    width: 100%;
    min-width: 0;
  }
  .jp-mission b{
    color: rgba(255,255,255,0.85) !important;
    font-size: 9.5px !important;
    font-weight: 800 !important;
    line-height: 1.15 !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.005em;
    padding: 0 1px;
  }
  /* Hide every secondary affordance — subtitle, XP badge, status pill.
     The bubble color + 2-line title carry all the information density
     this card needs at iPhone-SE width. */
  .jp-mission small,
  .jp-mission .xp,
  .jp-mission .pill{ display: none !important; }

  /* Active — pink fill + yellow ring + soft pulse (mirrors dashboard) */
  .jp-mission.active .ico{
    background: linear-gradient(135deg, #EE2B73, #FF6B9D) !important;
    border-color: #FFE600 !important;
    box-shadow:
      0 4px 14px rgba(238,43,115,0.55),
      0 0 0 3px rgba(255,230,0,0.22),
      inset 0 1px 2px rgba(255,255,255,0.28) !important;
    animation: jpMissionActivePulse 1.8s ease-in-out infinite;
  }
  .jp-mission.active b{ color: #FFE600 !important; }
  @keyframes jpMissionActivePulse{
    0%, 100%{
      box-shadow:
        0 4px 14px rgba(238,43,115,0.55),
        0 0 0 3px rgba(255,230,0,0.22),
        inset 0 1px 2px rgba(255,255,255,0.28);
    }
    50%{
      box-shadow:
        0 6px 18px rgba(238,43,115,0.7),
        0 0 0 7px rgba(255,230,0,0.10),
        inset 0 1px 2px rgba(255,255,255,0.28);
    }
  }

  .jp-mission.done{ opacity: 0.7; }
  .jp-mission.done .ico{
    background: linear-gradient(135deg, #10B981, #34D399) !important;
    border-color: #FFE600 !important;
  }
  .jp-mission.done b{ text-decoration: line-through; text-decoration-color: rgba(255,255,255,0.4); }
  .jp-mission.locked{ opacity: 0.45; cursor: not-allowed; }
  .jp-mission.locked .ico{ filter: grayscale(0.6); background: rgba(255,255,255,0.06) !important; }

  /* Quick stats: tighter, pushed below */
  .jp-quick{ gap: 8px; margin-bottom: 16px; }
  .jp-qs{ padding: 11px 12px; border-radius: 14px; }
  .jp-qs b{ font-size: 22px; }
  .jp-qs span{ font-size: 11px; }

  /* ════════════════════════════════════════════════════════════════
     Journey mobile cleanup (2026-04-26 spec) — kill the noise.
     ════════════════════════════════════════════════════════════════ */

  /* Hide skills + achievements on mobile — too much vertical real
     estate for secondary content. The activity feed STAYS visible at
     the bottom of the page (per user feedback 2026-04-26).
     Their corresponding section heads (.jp-shead nth-of-type 3/4) are
     ALSO hidden so the user doesn't see lonely titles with no content. */
  .jp-skills, .jp-ach-grid{ display: none !important; }
  .jp-wrap > div.jp-shead:nth-of-type(3),
  .jp-wrap > div.jp-shead:nth-of-type(4){ display: none !important; }

  /* The .jp-foot footer CTA tile duplicates the hero CTA we added at
     the top — remove it on mobile to avoid two "יאללה לתרגול הבא"
     buttons on the same page. Desktop keeps it. */
  .jp-foot{ display: none !important; }

  /* Hide the SECOND .jp-sched-block (long-term roadmap). The first
     block (this-week schedule) remains. */
  .jp-schedule .jp-sched-block + .jp-sched-block{ display: none; }

  /* Only TODAY's row is interactive (scrolls to missions). Other day
     rows get NO chevron and NO cursor — they're decorative previews,
     not actionable. This kills the "menu that doesn't tap" lie. */
  .jp-sched-row{ cursor: default; }
  .jp-sched-row.today{ cursor: pointer; }
  .jp-sched-row.today::after{
    content: '‹';
    margin-inline-start: auto;
    font-size: 22px; font-weight: 900; line-height: 1;
    color: ${Z.navy}; opacity: 0.55;
    align-self: center;
  }
  .jp-sched-row.today:hover::after,
  .jp-sched-row.today:active::after{ opacity: 0.95; transform: translateX(2px); }
  /* Non-today, non-rest rows: subtly de-emphasize so they read as
     reference/preview, not actions. */
  .jp-sched-row:not(.today):not(.rest){
    box-shadow: none !important;
    border-color: rgba(13,41,75,0.15) !important;
    background: rgba(255,255,255,0.6) !important;
  }

  /* Task chips on mobile — flat decorative labels, NOT buttons. They
     show "what's planned for the day" but aren't tappable, so we strip
     the border + shadow + bright bg so they don't promise interaction. */
  .jp-task-chip{
    background: rgba(13,41,75,0.05) !important;
    color: ${Z.navy} !important;
    border: 0 !important;
    box-shadow: none !important;
    font-weight: 600 !important;
    padding: 4px 10px !important;
    opacity: 0.85;
  }
  .jp-task-chip.done{
    background: rgba(16,185,129,0.12) !important;
    color: ${Z.correct} !important;
    text-decoration: line-through;
    text-decoration-color: rgba(16,185,129,0.4);
  }

  /* Flatten the weekly grid on mobile to a slim 60px strip — it
     duplicates the schedule below so it doesn't earn its full card. */
  .jp-week{
    padding: 12px 14px;
    border-radius: 14px;
  }
  .jp-week-head h3{ font-size: 14px; }
  .jp-week-grid{ gap: 4px; margin-top: 10px; }
  .jp-day{ padding: 6px 0; }
  .jp-day b{ font-size: 13px; }

  /* Layout — tighter overall gaps, no per-section margins */
  .jp-wrap{ gap: 14px; }
  .jp-shead{ margin: 4px 4px 6px !important; }

  /* On mobile we use a horizontal rail showing ALL missions — override
     the collapse rule that hides everything past the first mission. */
  .jp-missions.collapsed .jp-mission:not(:nth-of-type(1)){ display: flex !important; }

  .jp-missions-toggle{
    display: block;
    width: 100%;
    margin: 0;
    padding: 12px 14px;
    background: rgba(13,41,75,0.04);
    border: 0;
    border-top: 2px dashed rgba(13,41,75,0.15);
    color: ${Z.navy};
    font-family: var(--ff-d);
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    text-align: center;
  }
  .jp-missions-toggle:hover{ background: rgba(13,41,75,0.08); }
}

/* Desktop: hide the toggle entirely. */
.jp-missions-toggle{ display: none; }

/* Primary CTA pinned to the bottom of the today-missions tile — same
   yellow-glow language as the hero CTA + the dashboard daily-plan CTA.
   Visible on every breakpoint. */
.jp-missions-cta{
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: calc(100% - 24px);
  margin: 14px 12px 12px;
  padding: 14px 22px;
  border: 2.5px solid ${Z.black};
  border-radius: 14px;
  background: linear-gradient(135deg, #FFF3A0 0%, #FFE600 45%, #FFB800 100%);
  color: ${Z.black};
  font-family: var(--ff-d);
  font-weight: 900;
  font-size: 15px;
  letter-spacing: -0.005em;
  cursor: pointer;
  box-shadow: 4px 4px 0 0 ${Z.black}, 0 0 28px rgba(255,230,0,0.45);
  text-shadow: 0 1px 0 rgba(255,255,255,0.5);
  transition: transform .15s var(--ease-out), box-shadow .15s var(--ease-out);
}
.jp-missions-cta:hover{ transform: translate(-1px,-1px); box-shadow: 5px 5px 0 0 ${Z.black}, 0 0 36px rgba(255,230,0,0.55); }
.jp-missions-cta:active{ transform: translate(2px,2px); box-shadow: 1px 1px 0 0 ${Z.black}; }

@media (max-width: 420px){
  .jp-hero h1{
    font-size: 20px !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-wrap: nowrap;
  }
  /* Narrow-phone rail tightening (matches dashboard's <380px scaling) */
  .jp-missions-rail{ gap: 2px !important; padding: 14px 10px 12px !important; }
  .jp-missions-rail::before{ left: 22px !important; right: 22px !important; top: 32px !important; }
  .jp-mission .ico{ width: 32px !important; height: 32px !important; }
  .jp-mission .ico svg{ width: 16px !important; height: 16px !important; }
  .jp-mission b{ font-size: 9px !important; }
}

.jp-hero h1{
  /* Gateway-page H1 — unified with /, /vocabulary, /exam, /exam/full.
     900 weight + -.03em tracking + 1.05 leading + responsive clamp. */
  font-family: var(--ff-d); font-size: clamp(28px, 4.2vw, 44px);
  font-weight: 900; letter-spacing: -0.03em; line-height: 1.05; color: #fff;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
.jp-hero h1 .ico{
  width: 44px; height: 44px; border-radius: 12px;
  background: ${Z.yellow}; color: ${Z.black};
  border: 2px solid ${Z.black}; box-shadow: ${hs(3)};
  display: inline-flex; align-items: center; justify-content: center; font-size: 24px;
  animation: jpIcoPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes jpIcoPop{
  from{ opacity: 0; transform: scale(0.95) rotate(-20deg); }
  to{ opacity: 1; transform: scale(1) rotate(0); }
}
.jp-hero .lede{ margin-top: 12px; font-family: var(--ff-b); font-size: 15px; line-height: 1.55; color: rgba(255,255,255,0.82); max-width: 520px; }

/* Primary mobile-first CTA in the hero — yellow glowing pill that
   takes the student straight to their next active mission. Hidden on
   desktop where the full missions list provides enough affordance. */
.jp-hero-cta{
  display: none;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  margin-top: 18px;
  padding: 14px 22px;
  border: 2.5px solid ${Z.black};
  border-radius: 14px;
  background: linear-gradient(135deg, #FFF3A0 0%, #FFE600 45%, #FFB800 100%);
  color: ${Z.black};
  font-family: var(--ff-d);
  font-weight: 900;
  font-size: 15.5px;
  letter-spacing: -0.005em;
  cursor: pointer;
  box-shadow: 5px 5px 0 0 ${Z.black}, 0 0 32px rgba(255,230,0,0.45);
  text-shadow: 0 1px 0 rgba(255,255,255,0.5);
  transition: transform .15s var(--ease-out), box-shadow .15s var(--ease-out);
}
.jp-hero-cta:hover{ transform: translate(-1px,-1px); box-shadow: 6px 6px 0 0 ${Z.black}, 0 0 40px rgba(255,230,0,0.55); }
.jp-hero-cta:active{ transform: translate(2px,2px); box-shadow: 2px 2px 0 0 ${Z.black}; }
@media (max-width: 720px){
  .jp-hero-cta{ display: inline-flex; }
}

/* ── Typing caret (text is revealed char-by-char by JS) ── */
.jp-typing{ display: inline; position: relative; }
.jp-caret{
  display: inline-block; width: 3px; height: 0.9em;
  vertical-align: -2px; margin-inline-start: 4px;
  background: ${Z.yellow};
}
.jp-caret.blink{ animation: jpCaretBlink 0.75s step-end infinite; }
@keyframes jpCaretBlink{ 0%,50%{ opacity: 1; } 51%,100%{ opacity: 0; } }

/* ── Mentor character in hero ── */
.jp-hero-char{
  width: clamp(280px, 30vw, 360px); height: auto;
  align-self: flex-end; justify-self: end;
  margin-bottom: -20px; pointer-events: none;
  filter: drop-shadow(4px 4px 0 ${Z.black});
  animation: jpCharBob 4s ease-in-out 0.5s infinite;
  grid-column: -1;
}
@keyframes jpCharBob{
  0%,100%{ transform: translateY(0) rotate(-1deg); }
  50%{ transform: translateY(-5px) rotate(1.5deg); }
}
/* Mobile: keep the character visible — user feedback (2026-04-26):
   the original rule had specificity issues + wrong padding direction
   (padding-inline-start in RTL is the RIGHT side, which collided with
   the title). Now the char is pinned to BOTTOM-LEFT so it's
   decorative and doesn't fight the title for space at all — the
   title flows full-width above. */
@media (max-width: 820px){
  .jp-hero{ position: relative !important; overflow: hidden !important; }
  .jp-hero .jp-hero-char,
  .jp-hero-char{
    display: block !important;
    position: absolute !important;
    top: 6px !important;
    bottom: auto !important;
    left: 6px !important;
    right: auto !important;
    width: 96px !important;
    max-width: 96px !important;
    height: auto !important;
    align-self: auto !important;
    justify-self: auto !important;
    margin: 0 !important;
    z-index: 1 !important;
    pointer-events: none !important;
    grid-column: auto !important;
    filter: drop-shadow(0 6px 12px rgba(0,0,0,0.3));
  }
  /* Reserve LEFT space for the char so the title text doesn't run
     under it. In RTL, padding-inline-end is the LEFT side. Bumped from
     110px → 128px so the title has clear breathing room from the char. */
  .jp-hero-inner > div:first-child{
    padding-inline-start: 0 !important;
    padding-inline-end: 128px !important;
  }
}

.jp-hero-side{ display: flex; flex-direction: column; gap: 10px; }
.jp-countdown{
  display: flex; align-items: center; gap: 16px;
  background: ${Z.yellow}; color: ${Z.black};
  border: 2px solid ${Z.black}; box-shadow: ${hs(4)};
  border-radius: 20px; padding: 16px 20px;
}
.jp-countdown .num{ font-family: var(--ff-d); font-size: 42px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
.jp-countdown .lbl{ font-family: var(--ff-d); font-weight: 700; font-size: 13px; letter-spacing: .04em; }
.jp-countdown .body{ flex: 1; font-size: 12px; font-weight: 600; color: ${Z.navy}; line-height: 1.4; }

.jp-xp{
  background: #fff; color: ${Z.black};
  border: 2px solid ${Z.black}; box-shadow: ${hs(4)};
  border-radius: 20px; padding: 14px 18px;
}
.jp-xp-head{ display: flex; justify-content: space-between; align-items: baseline; font-family: var(--ff-d); }
.jp-xp-head b{ font-size: 15px; font-weight: 800; }
.jp-xp-head small{ font-size: 11px; font-weight: 600; opacity: .65; }
.jp-xp-track{ margin-top: 8px; height: 12px; background: ${Z.bg}; border: 2px solid ${Z.black}; border-radius: 6px; overflow: hidden; }
.jp-xp-track > div{ height: 100%; background: ${Z.pink}; border-inline-end: 2px solid ${Z.black}; transition: width 1.2s ease; animation: barGrow 1.2s ease; }
.jp-xp-note{ font-size: 11px; font-weight: 600; color: ${Z.navy}; margin-top: 8px; }

/* ══ QUICK STATS ══ */
.jp-quick{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
@media (max-width: 640px){ .jp-quick{ grid-template-columns: repeat(2, 1fr); } }
.jp-qs{
  background: #fff; border: 2px solid ${Z.black}; box-shadow: ${hs(3)};
  border-radius: 16px; padding: 14px 16px;
  display: flex; flex-direction: column; gap: 3px;
}
.jp-qs .ico{ display: inline-flex; align-items: center; }
.jp-qs b{ font-family: var(--ff-d); font-size: 24px; font-weight: 800; letter-spacing: -0.02em; line-height: 1; margin-top: 4px; }
.jp-qs span{ font-size: 11px; font-weight: 700; color: ${Z.navy}; opacity: .7; letter-spacing: .04em; }
.jp-qs.pink{ background: ${Z.pink}; color: #fff; }
.jp-qs.pink span{ color: rgba(255,255,255,0.85); opacity: 1; }
.jp-qs.yellow{ background: ${Z.yellow}; color: ${Z.black}; }
.jp-qs.cyan{ background: ${Z.cyan}; }

/* ══ SECTION HEAD ══ */
.jp-shead{ display: flex; justify-content: space-between; align-items: flex-end; margin: 28px 4px 14px; gap: 12px; }
.jp-shead h2{ font-family: var(--ff-d); font-size: clamp(20px, 3vw, 28px); font-weight: 800; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px; }
.jp-shead h2 .ico{ width: 36px; height: 36px; border-radius: 10px; background: ${Z.yellow}; border: 2px solid ${Z.black}; box-shadow: ${hs(2)}; display: inline-flex; align-items: center; justify-content: center; }
.jp-shead small{ font-family: var(--ff-b); font-size: 12px; font-weight: 600; color: ${Z.navy}; opacity: .7; }

/* ══ MISSIONS ══ */
.jp-missions{
  background: #fff; border: 2px solid ${Z.black}; box-shadow: ${hs(6)};
  border-radius: 24px; overflow: hidden;
}
.jp-missions-top{
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 22px; background: ${Z.yellow};
  border-bottom: 2px solid ${Z.black};
}
.jp-missions-top h3{ font-family: var(--ff-d); font-weight: 800; font-size: 17px; letter-spacing: -0.01em; }
.jp-missions-top .meta{ font-family: var(--ff-d); font-size: 13px; font-weight: 700; background: #fff; border: 2px solid ${Z.black}; border-radius: 8px; padding: 4px 12px; box-shadow: ${hs(2)}; }
.jp-missions-progress{ display: flex; align-items: center; gap: 12px; padding: 14px 22px; border-bottom: 2px solid ${Z.black}; background: #FFFDF0; }
.jp-missions-progress .bar{ flex: 1; height: 14px; background: #fff; border: 2px solid ${Z.black}; border-radius: 4px; overflow: hidden; }
.jp-missions-progress .bar > div{ height: 100%; background: ${Z.pink}; border-inline-end: 2px solid ${Z.black}; transition: width 1s ease; }
.jp-missions-progress b{ font-family: var(--ff-d); font-size: 14px; font-weight: 800; color: ${Z.navy}; }

.jp-mission{
  display: grid; grid-template-columns: 52px 1fr auto auto; gap: 14px; align-items: center;
  padding: 14px 22px; border-bottom: 2px solid rgba(0,0,0,0.08);
  cursor: pointer; transition: background .2s ease;
}
.jp-mission:last-child{ border-bottom: 0; }
.jp-mission:hover{ background: #FFFDF0; }
.jp-mission.done{ background: #F0FDF4; opacity: .75; }
.jp-mission.done b{ text-decoration: line-through; }
.jp-mission.locked{ opacity: .55; cursor: not-allowed; }
.jp-mission .ico{
  width: 52px; height: 52px; border-radius: 14px;
  border: 2px solid ${Z.black}; box-shadow: ${hs(3)};
  display: flex; align-items: center; justify-content: center;
}
.jp-mission b{ font-family: var(--ff-d); font-size: 15px; font-weight: 800; display: block; }
.jp-mission small{ font-size: 12px; color: ${Z.navy}; opacity: .7; }
.jp-mission .xp{ font-family: var(--ff-d); font-size: 11px; font-weight: 800; color: ${Z.pink}; background: #fff; border: 2px solid ${Z.black}; border-radius: 999px; padding: 4px 10px; }
.jp-mission .pill{ font-family: var(--ff-d); font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 10px; background: ${Z.navy}; color: #fff; border: 2px solid ${Z.black}; box-shadow: ${hs(2)}; transition: all .15s var(--ease-out); }
.jp-mission:hover .pill{ transform: translate(1.5px,1.5px); box-shadow: 0 0 0 0 ${Z.black}; }
.jp-mission .pill.done{ background: ${Z.correct}; }
.jp-mission .pill.locked{ background: #9CA3AF; }

/* ══ WEEK ══ */
.jp-week{
  margin-top: 22px;
  background: #fff; border: 2px solid ${Z.black}; box-shadow: ${hs(6)};
  border-radius: 24px; padding: 20px 22px;
}
.jp-week-head{ display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.jp-week-head h3{ font-family: var(--ff-d); font-size: 18px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
.jp-week-head h3 .ico{ width: 30px; height: 30px; border-radius: 9px; background: ${Z.pink}; border: 2px solid ${Z.black}; box-shadow: ${hs(2)}; display: inline-flex; align-items: center; justify-content: center; }
.jp-week-head small{ font-size: 12px; font-weight: 700; color: ${Z.navy}; opacity: .7; }
.jp-week-grid{ display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-top: 16px; }
.jp-day{
  padding: 12px 6px; text-align: center; border-radius: 12px;
  background: ${Z.bg}; border: 2px solid ${Z.black}; position: relative;
  transition: transform .2s var(--ease-out);
}
.jp-day:hover{ transform: translateY(-2px); }
.jp-day small{ display: block; font-family: var(--ff-d); font-size: 10px; font-weight: 700; letter-spacing: .06em; color: ${Z.navy}; opacity: .6; margin-bottom: 4px; }
.jp-day b{ font-family: var(--ff-d); font-size: 18px; font-weight: 800; display: block; }
.jp-day .mark{ font-size: 16px; margin-top: 2px; }
.jp-day.done{ background: ${Z.yellow}; box-shadow: ${hs(3)}; }
.jp-day.today{ background: ${Z.pink}; color: #fff; box-shadow: ${hs(3)}; }
.jp-day.today small{ color: rgba(255,255,255,0.85); opacity: 1; }
.jp-day.future{ opacity: .55; }

/* ══ Smart tooltip — shows on hover, hugs the element ══ */
[data-tip]{ position: relative; }
[data-tip]::before, [data-tip]::after{
  position: absolute; pointer-events: none;
  opacity: 0; transition: opacity .18s var(--ease-out), transform .18s var(--ease-out);
  z-index: 100;
}
[data-tip]::before{
  content: attr(data-tip);
  bottom: calc(100% + 10px);
  right: 50%; transform: translateX(50%) translateY(4px);
  background: ${Z.navy}; color: #fff;
  padding: 8px 12px; border-radius: 10px;
  border: 2px solid ${Z.black}; box-shadow: ${hs(3)};
  font-family: var(--ff-d); font-size: 11px; font-weight: 700;
  line-height: 1.45; text-align: center;
  white-space: normal; width: max-content; max-width: 240px;
}
[data-tip]::after{
  content: ""; bottom: calc(100% + 4px);
  right: 50%; transform: translateX(50%) translateY(4px);
  border: 6px solid transparent; border-top-color: ${Z.black};
  width: 0; height: 0;
}
[data-tip]:hover::before, [data-tip]:hover::after,
[data-tip]:focus-visible::before, [data-tip]:focus-visible::after{
  opacity: 1; transform: translateX(50%) translateY(0);
}
@media (max-width: 640px){ [data-tip]::before, [data-tip]::after{ display: none; } }

/* ══ SCHEDULE · upcoming week + period plan ══ */
.jp-schedule{
  display: flex; flex-direction: column; gap: 20px;
  margin-bottom: 22px; padding: 20px 22px;
  background: #fff; border: 2px solid ${Z.black}; box-shadow: ${hs(6)};
  border-radius: 22px;
}
.jp-sched-block h4{
  font-family: var(--ff-d); font-size: 14px; font-weight: 800;
  color: ${Z.navy}; margin-bottom: 12px; letter-spacing: -0.01em;
}
/* Detailed vertical list — each day shows its actual tasks */
.jp-sched-list{
  display: flex; flex-direction: column;
  border: 2px solid ${Z.black}; border-radius: 14px; overflow: hidden;
  background: ${Z.white};
}
.jp-sched-row{
  padding: 14px 16px;
  border-bottom: 1.5px solid rgba(0,0,0,0.08);
  transition: background .15s ease;
}
.jp-sched-row:last-child{ border-bottom: none; }
.jp-sched-row.today{ background: ${Z.yellowSoft}; }
.jp-sched-row:hover{ background: rgba(0,0,0,0.02); }
.jp-sched-row.today:hover{ background: ${Z.yellowSoft}; }
.jp-sched-row-head{ display: flex; align-items: center; gap: 12px; }
.jp-sched-daynum{
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--ff-d); font-size: 15px; font-weight: 800;
  background: ${Z.bg}; color: ${Z.navy};
  border: 2px solid rgba(0,0,0,0.1); flex-shrink: 0;
}
.jp-sched-daynum.today{ background: ${Z.pink}; color: ${Z.white}; border-color: ${Z.pink}; box-shadow: ${hs(2)}; }
.jp-sched-daynum.tomorrow{ background: ${Z.navy}; color: ${Z.white}; border-color: ${Z.navy}; }
.jp-sched-daylabel{ flex: 1; min-width: 0; }
.jp-sched-daylabel b{ font-family: var(--ff-d); font-size: 14px; font-weight: 800; color: ${Z.black}; display: block; }
.jp-sched-daylabel small{ font-family: var(--ff-b); font-size: 11px; font-weight: 600; color: ${Z.navy}; opacity: 0.6; display: block; margin-top: 2px; }
.jp-sched-time{
  font-family: var(--ff-d); font-size: 11px; font-weight: 800;
  padding: 4px 10px; border-radius: 6px;
  background: ${Z.bg}; color: ${Z.navy};
  border: 1px solid rgba(0,0,0,0.08); white-space: nowrap;
}
.jp-sched-time.active{ background: ${Z.pink}; color: ${Z.white}; border-color: ${Z.pink}; box-shadow: ${hs(2)}; }
.jp-sched-time.done{ background: ${Z.correct}; color: ${Z.white}; border-color: ${Z.correct}; box-shadow: ${hs(2)}; }
/* Rest-day row styling — Shabbat + Yom Tov + Zionist memorial days */
.jp-sched-row.rest{ background: linear-gradient(135deg, rgba(108,99,255,0.05), rgba(238,43,115,0.04)); }
.jp-sched-row.rest:hover{ background: linear-gradient(135deg, rgba(108,99,255,0.08), rgba(238,43,115,0.06)); }
.jp-sched-daynum.rest{ background: ${Z.purple}; color: ${Z.white}; border-color: ${Z.purple}; opacity: 0.75; }
.jp-sched-time.rest{
  background: transparent; color: ${Z.purple};
  border-color: ${Z.purple}; border-style: dashed;
  font-weight: 900; letter-spacing: 0.04em;
}
.jp-sched-rest{
  padding: 10px 12px; margin: 10px 0 0 52px;
  border-radius: 10px; background: rgba(108,99,255,0.08);
  border: 1.5px dashed rgba(108,99,255,0.35);
  display: flex; flex-direction: column; gap: 3px; line-height: 1.35;
}
.jp-sched-rest b{ font-family: var(--ff-d); font-size: 13.5px; font-weight: 900; color: ${Z.navy}; }
.jp-sched-rest small{ font-family: var(--ff-b); font-size: 11.5px; font-weight: 600; color: ${Z.navy}; opacity: 0.7; }
.jp-sched-tasks{
  display: flex; gap: 6px; flex-wrap: wrap;
  margin-top: 10px; padding-inline-start: 52px;
}
.jp-task-chip{
  font-family: var(--ff-b); font-size: 11px; font-weight: 700;
  padding: 4px 10px; border-radius: 6px;
  background: #F3F4F6; color: ${Z.navy};
  border: 1.5px solid rgba(0,0,0,0.06);
}
.jp-task-chip.done{
  background: #D1FAE5; color: #065F46;
  text-decoration: line-through; opacity: 0.65;
}

.jp-sched-weeks{ display: flex; flex-direction: column; gap: 8px; }
.jp-sched-wrow{
  display: grid; grid-template-columns: 72px 1fr auto;
  align-items: center; gap: 12px;
  padding: 12px 14px; border-radius: 12px;
  background: ${Z.bg}; border: 2px solid ${Z.black};
  transition: transform .15s var(--ease-out);
}
.jp-sched-wrow:hover{ transform: translateX(-2px); }
.jp-sched-wrow.current{ background: ${Z.yellow}; box-shadow: ${hs(3)}; }
.jp-sched-wrow .n{ font-family: var(--ff-d); font-weight: 800; font-size: 13px; color: ${Z.pink}; }
.jp-sched-wrow.current .n{ color: ${Z.black}; }
.jp-sched-wrow .t{ font-size: 13px; font-weight: 600; color: ${Z.navy}; line-height: 1.3; }
.jp-sched-wrow .now{ font-family: var(--ff-d); font-size: 11px; font-weight: 800; color: ${Z.black}; letter-spacing: .04em; white-space: nowrap; }

@media (max-width: 640px){
  .jp-sched-row{ padding: 12px 14px; }
  .jp-sched-daynum{ width: 34px; height: 34px; font-size: 13px; }
  .jp-sched-daylabel b{ font-size: 13px; }
  .jp-sched-daylabel small{ font-size: 10px; }
  .jp-sched-time{ font-size: 10px; padding: 3px 8px; }
  .jp-sched-tasks{ padding-inline-start: 0; gap: 4px; margin-top: 8px; }
  .jp-task-chip{ font-size: 10px; padding: 3px 8px; }
  .jp-sched-wrow{ grid-template-columns: 60px 1fr auto; gap: 8px; padding: 10px 12px; }
  .jp-sched-wrow .t{ font-size: 12px; }
}

/* ══ SKILLS ══ */
.jp-skills{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
@media (max-width: 820px){ .jp-skills{ grid-template-columns: 1fr; } }
.jp-skill{
  padding: 22px 24px; background: #fff;
  border: 2px solid ${Z.black}; box-shadow: ${hs(6)};
  border-radius: 22px; position: relative; overflow: hidden;
  transition: all .25s var(--ease-out); cursor: pointer;
}
.jp-skill:hover{ transform: translateY(-4px); box-shadow: ${hs(8)}; }
.jp-skill::before{ content: ""; position: absolute; bottom: -30px; inset-inline-start: -30px; width: 110px; height: 110px; border-radius: 50%; background: var(--acc); opacity: .14; }
.jp-skill .top{ display: flex; align-items: center; gap: 12px; position: relative; }
.jp-skill .sico{ width: 46px; height: 46px; border-radius: 12px; background: var(--accBg); border: 2px solid ${Z.black}; box-shadow: ${hs(3)}; display: flex; align-items: center; justify-content: center; font-size: 22px; }
.jp-skill .sname{ font-family: var(--ff-d); font-size: 15px; font-weight: 800; }
.jp-skill .slabel{ font-size: 11px; font-weight: 700; color: ${Z.navy}; opacity: .65; letter-spacing: .04em; }
.jp-skill .elo{ font-family: var(--ff-d); font-size: 38px; font-weight: 800; letter-spacing: -0.02em; line-height: 1; margin-top: 14px; position: relative; }
.jp-skill .eloUnit{ font-size: 13px; font-weight: 700; color: ${Z.navy}; opacity: .6; margin-inline-start: 4px; }
.jp-skill .track{ margin-top: 12px; height: 10px; background: ${Z.bg}; border: 2px solid ${Z.black}; border-radius: 4px; overflow: hidden; position: relative; }
.jp-skill .track > div{ height: 100%; background: var(--acc); border-inline-end: 2px solid ${Z.black}; transition: width 1.2s ease; animation: barGrow 1.2s ease; }
.jp-skill .meta{ display: flex; justify-content: space-between; font-family: var(--ff-d); font-size: 11px; font-weight: 700; color: ${Z.navy}; opacity: .7; margin-top: 8px; }

/* ══ ACHIEVEMENTS ══ */
.jp-ach-grid{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
@media (max-width: 820px){ .jp-ach-grid{ grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 520px){ .jp-ach-grid{ grid-template-columns: repeat(2, 1fr); } }
.jp-ach{
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 16px 10px; background: #fff;
  border: 2px solid ${Z.black}; box-shadow: ${hs(3)};
  border-radius: 16px; text-align: center;
  transition: all .25s var(--ease-out); position: relative;
}
.jp-ach:hover{ transform: translateY(-3px); box-shadow: ${hs(5)}; }
.jp-ach.locked{ opacity: .4; filter: grayscale(0.5); }
.jp-ach .ico{ width: 50px; height: 50px; border-radius: 14px; background: ${Z.peach}; border: 2px solid ${Z.black}; box-shadow: ${hs(2)}; display: flex; align-items: center; justify-content: center; font-size: 22px; }
.jp-ach.done .ico{ background: ${Z.correct}; color: #fff; }
.jp-ach.done::after{ content: "✓"; position: absolute; top: 6px; inset-inline-end: 6px; width: 20px; height: 20px; border-radius: 50%; background: ${Z.correct}; color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 2px solid ${Z.black}; }
.jp-ach b{ font-family: var(--ff-d); font-size: 12px; font-weight: 800; }
.jp-ach small{ font-size: 10px; color: ${Z.navy}; opacity: .7; font-weight: 600; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* ══ ACTIVITY ══ */
.jp-activity{ background: #fff; border: 2px solid ${Z.black}; box-shadow: ${hs(6)}; border-radius: 22px; overflow: hidden; }
.jp-activity-head{
  padding: 14px 22px; background: ${Z.navy}; color: #fff;
  border-bottom: 2px solid ${Z.black};
  display: flex; justify-content: space-between; align-items: center;
}
.jp-activity-head h3{ font-family: var(--ff-d); font-weight: 800; font-size: 16px; }
.jp-activity-head small{ font-size: 11px; opacity: .75; letter-spacing: .04em; }
.jp-activity-row{
  display: grid; grid-template-columns: 44px 1fr auto auto; gap: 12px;
  align-items: center; padding: 14px 22px;
  border-bottom: 2px solid rgba(0,0,0,0.06);
  transition: background .2s ease;
}
.jp-activity-row:last-child{ border-bottom: 0; }
.jp-activity-row:hover{ background: ${Z.bg}; }
.jp-activity-row .ico{
  width: 44px; height: 44px; border-radius: 12px;
  background: var(--cb); color: var(--ca);
  border: 2px solid ${Z.black}; box-shadow: ${hs(2)};
  display: flex; align-items: center; justify-content: center; font-size: 20px;
}
.jp-activity-row.c-vocab{ --ca: ${Z.pink}; --cb: #FFE4E6; }
.jp-activity-row.c-read{ --ca: ${Z.teal}; --cb: ${Z.cyan}; }
.jp-activity-row.c-exam{ --ca: ${Z.purple}; --cb: #E8DEF8; }
.jp-activity-row h5{ font-family: var(--ff-d); font-size: 14px; font-weight: 800; }
.jp-activity-row small{ font-size: 11px; color: ${Z.navy}; opacity: .7; font-weight: 500; }
.jp-activity-row .xp{ font-family: var(--ff-d); font-size: 11px; font-weight: 800; color: ${Z.pink}; background: #fff; border: 2px solid ${Z.black}; border-radius: 999px; padding: 4px 10px; box-shadow: ${hs(2)}; }
.jp-activity-row .score{ font-family: var(--ff-d); font-size: 13px; font-weight: 800; padding: 5px 12px; border-radius: 8px; border: 2px solid ${Z.black}; box-shadow: ${hs(2)}; }
.jp-activity-row .score.ok{ background: ${Z.correct}; color: #fff; }
.jp-activity-row .score.warn{ background: ${Z.warning}; color: #fff; }
.jp-activity-row .score.bad{ background: ${Z.wrong}; color: #fff; }

/* ══ FOOT CTA ══ */
.jp-foot{
  margin-top: 28px; padding: 28px 26px;
  background: ${Z.pink}; color: #fff;
  border: 2px solid ${Z.black}; box-shadow: ${hs(8)};
  border-radius: 24px; text-align: center;
  position: relative; overflow: hidden;
}
.jp-foot::before{
  content: ""; position: absolute; top: -40px; right: -40px;
  width: 140px; height: 140px; border-radius: 50%;
  background: ${Z.yellow}; border: 2px solid ${Z.black};
}
.jp-foot h3{ font-family: var(--ff-d); font-size: clamp(20px, 3vw, 30px); font-weight: 800; letter-spacing: -0.02em; position: relative; z-index: 1; }
.jp-foot p{ font-size: 14px; opacity: .9; margin-top: 8px; max-width: 520px; margin-inline: auto; position: relative; z-index: 1; }
.jp-foot .btn{
  margin-top: 16px; padding: 12px 28px; border-radius: 10px;
  background: ${Z.yellow}; color: ${Z.black};
  border: 2px solid ${Z.black}; box-shadow: ${hs(4)};
  font-family: var(--ff-d); font-weight: 800; font-size: 14px; letter-spacing: .04em;
  cursor: pointer; position: relative; z-index: 1;
  transition: all .18s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.jp-foot .btn:hover{ transform: translate(3px,3px); box-shadow: 0 0 0 0 ${Z.black}; }
`
