import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { playSound } from '../../utils/sounds'
import type { Mission } from '../../services/mockCoachData'
import { g } from '../../utils/gender'
import { fireConfetti } from '../../utils/confetti'
import { asset } from '../../utils/assetUrl'
import { ExamReviewBlock } from './review/ExamReviewBlock'

/* ═══════════════════════════════════════════════════════════════════
   EXAM RESULT SCREEN · Arcade Victory × Neo-Brutalist Pop
   ───────────────────────────────────────────────────────────────────
   Shown after a session of exam practice questions
   (SC · Restatement · RC · Mixed). Language is tuned to the
   exam-prep mindset: "דיוק", "רמת פטור", "עד 134".
   ═══════════════════════════════════════════════════════════════════ */

export type ExamQuestionType = 'sc' | 'restatement' | 'rc' | 'mixed'

export interface WrongQuestion {
  stem: string            // the question text / sentence
  userAnswer: string
  correctAnswer: string
  explanation?: string
}

/** Full question record for the post-session review interface. Covers both
 *  correct AND incorrect answers — the review UI needs ALL of them so the
 *  student can see their whole performance, not just errors.
 *
 *  Extended (2026-04-24) for the new matrix + card review UI:
 *  — `options` + `correctIdx` + `userIdx` let the card view render EVERY
 *    choice (not just the picked one + the right one), which is the teaching
 *    surface that distractor-analysis research says actually moves the needle.
 *  — `optionAnalysis` carries the per-option Hebrew explanation that already
 *    exists in `src/data/exam/*.json` but was being discarded by the old UI.
 *  — `passage` + `passageTitle` restore RC context that the student needs
 *    to re-read the relevant sentence before we show the answer.
 *  — `timeSpentMs` feeds a compact "זמן שהקדשת" label in the card header. */
export interface ReviewQuestion {
  stem: string
  userAnswer: string
  correctAnswer: string
  /** Was the student's answer correct? Drives the ✓/✗ badge + row colour. */
  correct: boolean
  /** Optional long-form explanation — shown when the row is expanded. */
  explanation?: string
  /** Sub-type so the review can display a per-question label when the
   *  session is mixed (e.g., FullExam with SC + Restatement + RC). */
  qType?: 'sc' | 'restatement' | 'rc'
  /** All 4 multiple-choice options as they were presented to the student. */
  options?: string[]
  /** Index of the correct option in `options`. */
  correctIdx?: number
  /** Index of the student's pick in `options`, or null if skipped / timed out. */
  userIdx?: number | null
  /** Per-option Hebrew analysis ("למה הדיסטרקטור הזה טועה / למה הנכונה נכונה").
   *  Parallel to `options`. Discarded by the old UI; surfaced by the new one. */
  optionAnalysis?: string[]
  /** For RC questions — the full passage text + (optional) title, shown in a
   *  side drawer on desktop / bottom sheet on mobile. */
  passage?: string
  passageTitle?: string
  /** Milliseconds the student spent on this question. Optional — shown only
   *  when the caller can measure it (FullExamSimulator does). */
  timeSpentMs?: number
}

interface ExamResultScreenProps {
  questionType: ExamQuestionType
  score: number
  total: number
  startTime: number
  xpEarned: number
  wrongQuestions: WrongQuestion[]
  /** Full per-question record for the deep review. Optional for back-compat:
   *  if not provided the screen falls back to the legacy wrong-only view. */
  allQuestions?: ReviewQuestion[]
  /** Displayed for FullExam sessions (scored on the 50-150 Amir scale). */
  estimatedAmirScore?: number
  isPersonalBest?: boolean
  onBack: () => void
  onRetry: () => void
  onPlayDifferent?: () => void
}

/* ── ZNK tokens (same palette as game result) ── */
const Z = {
  yellow: '#FFE600', yellowSoft: '#FFF3A3', yellowDeep: '#F5C900',
  pink: '#EE2B73', pinkLight: '#FF4D8E', pinkSoft: '#FFD0DE',
  navy: '#0d294b', navyLight: '#1E3A5F',
  purple: '#6B3FA0', purpleLight: '#8B5CF6',
  correct: '#10B981', correctSoft: '#D1FAE5',
  warning: '#F59E0B',
  wrong: '#EF4444', wrongSoft: '#FEE2E2',
  white: '#FFFFFF', black: '#000000',
  bg: '#FFF7E8', cream: '#FFF1CC', gold: '#FFD700',
} as const

const FONT_DISPLAY = "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif"
const FONT_BODY = "'Heebo', 'Satoshi', sans-serif"
const hs = (n = 4, color: string = Z.black) => `${n}px ${n}px 0 0 ${color}`

/* ── Exam-flavoured tier ── */
interface Tier {
  labels: string[]
  subtitles: string[]
  badge: string
  emoji: string
  confetti: { particles: number; duration: number; spread: 'narrow' | 'medium' | 'wide' }
}

function getTier(pct: number): Tier {
  if (pct === 100) return {
    labels: [
      'פטור בכיס! 🏆',
      g('שולט בכל שאלה', 'שולטת בכל שאלה'),
      'Perfect!',
      'סיימת בלי טעות!',
      g('זה ראש של 140+', 'זה ראש של 140+'),
    ],
    subtitles: [
      'אפס טעויות — בדיוק רמת הפטור.',
      g('אתה מוכן ליום הבחינה.', 'את מוכנה ליום הבחינה.'),
      'נקודה מושלמת על השאלות האלה.',
    ],
    badge: 'LEGENDARY',
    emoji: '🏆',
    confetti: { particles: 200, duration: 3500, spread: 'wide' },
  }
  if (pct >= 85) return {
    labels: [
      g('אלוף!', 'אלופה!'),
      'רמת פטור!',
      'Solid!',
      g('עבודה רצינית!', 'עבודה רצינית!'),
    ],
    subtitles: [
      'ציון ברמת פטור. עוד כמה סיבובים כאלה.',
      g('אתה מתקרב למטרה של 134.', 'את מתקרבת למטרה של 134.'),
    ],
    badge: 'GOLD',
    emoji: '⭐',
    confetti: { particles: 140, duration: 2500, spread: 'wide' },
  }
  if (pct >= 70) return {
    labels: [
      'יפה מאוד! 💪',
      'כל הכבוד!',
      g('מתקדם יפה!', 'מתקדמת יפה!'),
      'כמעט שם!',
    ],
    subtitles: [
      g('השיפור ניכר — ממשיך בדיוק ככה.', 'השיפור ניכר — ממשיכה בדיוק ככה.'),
      'עוד תרגול ועוד דיוק — הנה הדרך.',
    ],
    badge: 'SILVER',
    emoji: '💪',
    confetti: { particles: 90, duration: 2000, spread: 'medium' },
  }
  if (pct >= 50) return {
    labels: [
      'התקדמת! 📈',
      'הדרך נכונה!',
      'צעד אחר צעד!',
    ],
    subtitles: [
      'כל סיבוב = עוד לבנה בקיר. סבלנות.',
      g('השיפור מגיע. אתה קרוב.', 'השיפור מגיע. את קרובה.'),
    ],
    badge: 'BRONZE',
    emoji: '📈',
    confetti: { particles: 60, duration: 1500, spread: 'narrow' },
  }
  return {
    labels: ['עוד סיבוב!', 'בונים שריר!', g('אל תוותר!', 'אל תוותרי!')],
    subtitles: [
      g('טעויות עכשיו = דיוק מאוחר יותר. אתה בונה שרירים.', 'טעויות עכשיו = דיוק מאוחר יותר. את בונה שרירים.'),
      'השאלות שטעית בהן הן המורות הכי טובות.',
    ],
    badge: 'GROWING',
    emoji: '🔥',
    confetti: { particles: 40, duration: 1200, spread: 'narrow' },
  }
}

const TYPE_LABEL: Record<ExamQuestionType, { title: string; subtitle: string; nextRoute: string; nextLabel: string }> = {
  sc: {
    title: 'השלמת משפטים',
    subtitle: 'Sentence Completion',
    nextRoute: '/exam/restatement',
    nextLabel: 'עבור לניסוח מחדש',
  },
  restatement: {
    title: 'ניסוח מחדש',
    subtitle: 'Restatement',
    nextRoute: '/exam/rc',
    nextLabel: 'עבור להבנת הנקרא',
  },
  rc: {
    title: 'הבנת הנקרא',
    subtitle: 'Reading Comprehension',
    nextRoute: '/exam/sc',
    nextLabel: 'עבור להשלמת משפטים',
  },
  mixed: {
    title: 'סימולציה מעורבת',
    subtitle: 'Mixed Practice',
    nextRoute: '/exam/full',
    nextLabel: 'פרק בחינה מלא',
  },
}

const MISSION_EMOJI: Record<string, string> = {
  vocab_flashcards: '📇', vocab_wordhack: '🎯', vocab_adaptive: '🧠',
  vocab_learn: '📚', vocab_gravity: '⚡', vocab_practice: '🎯',
  reading: '📖', exam_sc: '✏️', exam_restatement: '🔄',
}

/* ═══════════════════════════════════════════════════════════════ */

export function ExamResultScreen({
  questionType,
  score, total, startTime, xpEarned, wrongQuestions,
  allQuestions,
  estimatedAmirScore,
  isPersonalBest,
  onBack, onRetry, onPlayDifferent,
}: ExamResultScreenProps) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const elapsed = Math.round((Date.now() - startTime) / 1000)
  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
  const tier = useMemo(() => getTier(pct), [pct])
  const typeInfo = TYPE_LABEL[questionType]

  const navigate = useNavigate()
  const [nextMission, setNextMission] = useState<Mission | null>(null)
  const [dailyMissions, setDailyMissions] = useState<Mission[]>([])
  const [missionState, setMissionState] = useState<'none' | 'has-next' | 'all-done'>('none')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [displayPct, setDisplayPct] = useState(0)

  const celebrationLabel = useMemo(() => tier.labels[Math.floor(Math.random() * tier.labels.length)], [tier])
  const celebrationSubtitle = useMemo(() => tier.subtitles[Math.floor(Math.random() * tier.subtitles.length)], [tier])

  /* Count-up for score ring */
  useEffect(() => {
    if (pct === 0) return
    let n = 0
    const step = Math.max(1, Math.ceil(pct / 40))
    const id = setInterval(() => {
      n += step
      if (n >= pct) { n = pct; clearInterval(id) }
      setDisplayPct(n)
    }, 22)
    return () => clearInterval(id)
  }, [pct])

  /* Mount effects — celebration + daily plan (once) */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    try { playSound('complete') } catch { /* ok */ }
    try { fireConfetti(tier.confetti) } catch { /* ok */ }
    try {
      const activeMissionId = localStorage.getItem('znk-active-mission')
      import('../../stores/coachStore').then(async ({ useCoachStore }) => {
        if (activeMissionId) {
          localStorage.removeItem('znk-active-mission')
          await useCoachStore.getState().completeMission(activeMissionId)
        }
        const plan = useCoachStore.getState().dailyPlan
        if (plan) {
          const missions = plan.missions.filter(m => !m.id.startsWith('bonus-'))
          setDailyMissions(missions)
          const next = missions.find(m => m.status !== 'completed' && m.status !== 'locked')
          if (next) { setNextMission(next); setMissionState('has-next') }
          else { setMissionState('all-done') }
        }
      }).catch(() => { /* ok */ })
    } catch { /* ok */ }
  }, [])

  const handleNextMission = () => {
    if (!nextMission) return
    playSound('click')
    localStorage.setItem('znk-active-mission', nextMission.id)
    const url = nextMission.routeParams && Object.keys(nextMission.routeParams).length > 0
      ? `${nextMission.route}?${new URLSearchParams(nextMission.routeParams).toString()}`
      : nextMission.route
    navigate(url)
  }

  const handleMissionClick = (m: Mission) => {
    if (m.status === 'locked') return
    playSound('click')
    localStorage.setItem('znk-active-mission', m.id)
    const url = m.routeParams && Object.keys(m.routeParams).length > 0
      ? `${m.route}?${new URLSearchParams(m.routeParams).toString()}`
      : m.route
    navigate(url)
  }

  const handleGoToType = () => {
    playSound('click')
    navigate(typeInfo.nextRoute)
  }

  const missionStats = useMemo(() => {
    const done = dailyMissions.filter(m => m.status === 'completed').length
    const totalM = dailyMissions.length
    const remainingMin = dailyMissions
      .filter(m => m.status !== 'completed' && m.status !== 'locked')
      .reduce((s, m) => s + m.estimatedMinutes, 0)
    return { done, total: totalM, remainingMin }
  }, [dailyMissions])

  /* Always-visible "next step" shortcut above the fold. Highest priority:
     the next daily-plan mission → retry → switch to different type. */
  const topNextExam = nextMission
    ? { label: `הבא: ${nextMission.title}`, sub: `~${nextMission.estimatedMinutes} דק׳`, action: handleNextMission }
    : wrongQuestions.length > 0
    ? { label: 'סיבוב ממוקד', sub: `חזור על ${wrongQuestions.length} השאלות שטעית בהן`, action: onRetry }
    : { label: typeInfo.nextLabel, sub: 'שריר שלם יותר = פחות הפתעות בבחינה', action: handleGoToType }

  return (
    <div className="exr" dir="rtl">
      <style>{cssBlock}</style>

      {/* ═══ HERO ═══ */}
      <section className="exr-hero">
        <div className="exr-type-ribbon">
          <span className="exr-type-ico">📝</span>
          <div>
            <small>סיימת תרגול</small>
            <b>{typeInfo.title}</b>
          </div>
        </div>

        <div className="exr-starburst" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} style={{ transform: `rotate(${i * 30}deg)` }} />
          ))}
        </div>
        <div className="exr-sparkles" aria-hidden="true">
          <i style={{ top: '12%', left: '8%' }} />
          <i style={{ top: '20%', right: '12%' }} />
          <i style={{ top: '70%', left: '14%' }} />
          <i style={{ top: '62%', right: '8%' }} />
        </div>

        <div className="exr-hero-inner">
          <div className="exr-char-wrap">
            <div className="exr-badge-stamp" data-badge={tier.badge}>
              <span>{tier.emoji}</span>
              <b>{tier.badge}</b>
            </div>
            <img className="exr-char" src={asset('char-english.png')} alt="" aria-hidden="true" />
          </div>

          <div className="exr-score-bubble">
            <div className="exr-score-ring">
              <svg viewBox="0 0 120 120" className="exr-score-svg">
                <defs>
                  <linearGradient id="exrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={Z.yellow} />
                    <stop offset="100%" stopColor={Z.pink} />
                  </linearGradient>
                </defs>
                <circle cx="60" cy="60" r="48" fill="none" stroke={Z.black} strokeWidth="4" />
                <circle
                  cx="60" cy="60" r="48" fill="none"
                  stroke="url(#exrGrad)" strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${(displayPct / 100) * 301.6} 301.6`}
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dasharray .5s cubic-bezier(.34,1.56,.64,1)' }}
                />
              </svg>
              <div className="exr-score-num">
                <b>{displayPct}</b>
                <span>%</span>
              </div>
            </div>
          </div>
        </div>

        <h1 className="exr-title">{celebrationLabel}</h1>
        <p className="exr-subtitle">{celebrationSubtitle}</p>

        <div className="exr-score-meta">
          <span>{score}/{total} נכונות</span>
          {isPersonalBest && <span className="exr-pb">🏅 שיא חדש!</span>}
        </div>

        {/* AMIR-scale estimated score — only surfaced for full-exam sessions
            that pass the `estimatedAmirScore` prop. Placed right under the
            raw percentage so the student sees both the session outcome
            AND what it projects to on the real exam scale (50-150). */}
        {typeof estimatedAmirScore === 'number' && (
          <div className="exr-amir-badge" aria-label={`ציון משוער בקנה מידה אמירנט: ${estimatedAmirScore}`}>
            <small>ציון משוער · אמירנט (50-150)</small>
            <b>{estimatedAmirScore}</b>
            <span className="exr-amir-hint">
              {estimatedAmirScore >= 134 ? '🎯 פטור!'
                : estimatedAmirScore >= 120 ? `עוד ${134 - estimatedAmirScore} נק׳ לפטור`
                : estimatedAmirScore >= 85 ? 'בסיס טוב — ממשיכים לעלות'
                : 'השלב הראשון — כל תרגול קירוב'}
            </span>
          </div>
        )}

        <div className="exr-stats">
          <div className="exr-stat" data-tier="xp">
            <span className="exr-stat-ico">⚡</span>
            <b>+{xpEarned}</b>
            <small>XP</small>
          </div>
          <div className="exr-stat" data-tier="time">
            <span className="exr-stat-ico">⏱️</span>
            <b>{mmss}</b>
            <small>זמן</small>
          </div>
          <div className="exr-stat" data-tier="acc">
            <span className="exr-stat-ico">🎯</span>
            <b>{pct}%</b>
            <small>דיוק</small>
          </div>
          {wrongQuestions.length > 0 && (
            <div className="exr-stat" data-tier="wrong">
              <span className="exr-stat-ico">📝</span>
              <b>{wrongQuestions.length}</b>
              <small>לחזור עליהן</small>
            </div>
          )}
        </div>
      </section>

      {/* ═══ NEXT STEP BAR — below hero per user request ═══ */}
      <button className="exr-top-next" type="button" onClick={topNextExam.action}>
        <div className="exr-top-next-body">
          <small>מה עכשיו?</small>
          <b>{topNextExam.label}</b>
          <span>{topNextExam.sub}</span>
        </div>
        <div className="exr-top-next-arrow">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="19 3 5 12 19 21 19 3" />
          </svg>
        </div>
      </button>

      {/* ═══ CHOICES ═══ */}
      <section className="exr-choices" aria-label="מה הלאה">
        <div className="exr-choices-head">
          <h2>מה הלאה?</h2>
          <p>בחר את הצעד הבא — שלושה מסלולים שיקדמו אותך ל-134</p>
        </div>

        {/* ── 01 · המשך בתוכנית היומית ── */}
        {dailyMissions.length > 0 && (
          <div className={`exr-choice exr-choice-plan ${missionState === 'has-next' ? 'is-primary' : ''}`}>
            <div className="exr-choice-ribbon">
              <span className="exr-choice-num">01</span>
              <span className="exr-choice-emoji">🗺️</span>
            </div>
            <div className="exr-choice-body">
              <div className="exr-choice-titles">
                <h3>המשך בתוכנית היומית</h3>
                <p>
                  {missionStats.done}/{missionStats.total} הושלמו
                  {missionStats.remainingMin > 0 && ` · עוד ~${missionStats.remainingMin} דק׳ ליום מלא`}
                </p>
              </div>

              <div className="exr-trail">
                <div className="exr-trail-line" aria-hidden="true" />
                <div
                  className="exr-trail-line-fill"
                  style={{
                    width: dailyMissions.length > 1
                      ? `${(missionStats.done / (dailyMissions.length - 1)) * 100}%`
                      : '0%',
                  }}
                  aria-hidden="true"
                />
                {dailyMissions.map((m, i) => {
                  const isDone = m.status === 'completed'
                  const isLocked = m.status === 'locked'
                  const isNext = !isDone && !isLocked && nextMission?.id === m.id
                  const emoji = MISSION_EMOJI[m.type] || '✨'
                  const state = isDone ? 'done' : isNext ? 'next' : isLocked ? 'locked' : 'pending'
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`exr-trail-node state-${state}`}
                      style={{ animationDelay: `${0.3 + i * 0.06}s` }}
                      disabled={isLocked}
                      onClick={() => handleMissionClick(m)}
                      aria-label={isLocked ? `${m.title} — נעול` : m.title}
                    >
                      <div className="exr-trail-bubble">
                        {isDone ? <span className="exr-check">✓</span> : isLocked ? <span>🔒</span> : <span>{emoji}</span>}
                      </div>
                      <div className="exr-trail-label">
                        <b>{m.title}</b>
                        <small>{m.estimatedMinutes} דק׳</small>
                      </div>
                    </button>
                  )
                })}
              </div>

              {missionState === 'has-next' && nextMission && (
                <button className="exr-choice-cta primary" onClick={handleNextMission}>
                  <div className="exr-choice-cta-label">
                    <small>הבא בתור</small>
                    <b>{nextMission.title}</b>
                    <span>~{nextMission.estimatedMinutes} דק׳</span>
                  </div>
                  <div className="exr-choice-cta-arrow">
                    <span>יאללה</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="19 3 5 12 19 21 19 3" />
                    </svg>
                  </div>
                </button>
              )}

              {missionState === 'all-done' && (
                <div className="exr-choice-done">
                  <span className="exr-choice-done-emoji">🏆</span>
                  <div className="exr-choice-done-text">
                    <b>יום מלא! {g('סגרת', 'סגרת')} את הכל.</b>
                    <span>מחר משימות חדשות.</span>
                  </div>
                  <button className="exr-choice-done-btn" onClick={onBack}>לדף הבית</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 02 · תחקור השאלות ──
            New review UI (2026-04-24): matrix of question tiles + full-screen
            card for each question, with all 4 options shown, per-option
            analysis (optionAnalysis[]), a hypercorrection confidence prompt
            on first visit to each wrong answer, and a side/bottom drawer
            for RC passages. See docs/superpowers/specs/2026-04-24-exam-
            review-ui-research.md for the full design rationale. Falls
            through to the legacy wrong-only view when the caller hasn't
            yet migrated to passing `allQuestions`. */}
        {(allQuestions && allQuestions.length > 0) ? (
          <div className="exr-choice exr-choice-review">
            <div className="exr-choice-ribbon">
              <span className="exr-choice-num">02</span>
              <span className="exr-choice-emoji">🔍</span>
            </div>
            <div className="exr-choice-body">
              <div className="exr-choice-titles">
                <h3>תחקור כל השאלות</h3>
                <p>
                  {score}/{allQuestions.length} נכונות · {allQuestions.length - score} טעויות
                  {allQuestions.length > 0 && ` · ${Math.round((score / allQuestions.length) * 100)}% דיוק`}
                </p>
              </div>

              <ExamReviewBlock questions={allQuestions} />

              {wrongQuestions.length > 0 && (
                <button className="exr-choice-cta rescue znk-tooltip" onClick={onRetry} style={{ marginTop: 18 }}>
                  <span className="znk-tip" data-placement="top" role="tooltip">
                    שאלות חדשות באותו עומק — מחזק בדיוק את הנקודות שטעית בהן
                  </span>
                  <div className="exr-choice-cta-label">
                    <small>סיבוב ממוקד</small>
                    <b>תרגל שוב שאלות דומות</b>
                    <span>ELO-matched · מותאם לרמה שלך</span>
                  </div>
                  <div className="exr-choice-cta-arrow">
                    <span>בוא</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="19 3 5 12 19 21 19 3" />
                    </svg>
                  </div>
                </button>
              )}
            </div>
          </div>
        ) : wrongQuestions.length > 0 && (
          /* Legacy path — only wrongs (kept for callers that haven't migrated
             to passing `allQuestions` yet). */
          <div className="exr-choice exr-choice-review">
            <div className="exr-choice-ribbon">
              <span className="exr-choice-num">02</span>
              <span className="exr-choice-emoji">🔍</span>
            </div>
            <div className="exr-choice-body">
              <div className="exr-choice-titles">
                <h3>חזור על השאלות שטעית בהן</h3>
                <p>
                  {wrongQuestions.length} שאלות · הטעויות של היום = הדיוק של יום הבחינה
                </p>
              </div>

              <div className="exr-questions">
                {wrongQuestions.slice(0, 5).map((wq, i) => {
                  const isExpanded = expandedIdx === i
                  return (
                    <div key={i} className={`exr-question ${isExpanded ? 'expanded' : ''}`}>
                      <button
                        type="button"
                        className="exr-question-head"
                        onClick={() => setExpandedIdx(isExpanded ? null : i)}
                      >
                        <span className="exr-question-badge">שאלה {i + 1}</span>
                        <span className="exr-question-stem" dir="ltr">
                          {wq.stem.length > 80 ? wq.stem.slice(0, 80) + '…' : wq.stem}
                        </span>
                        <span className={`exr-question-chev ${isExpanded ? 'open' : ''}`} aria-hidden="true">▾</span>
                      </button>
                      {isExpanded && (
                        <div className="exr-question-expand">
                          <div className="exr-question-row wrong">
                            <span>❌</span>
                            <div>
                              <small>התשובה שבחרת</small>
                              <p dir="ltr">{wq.userAnswer}</p>
                            </div>
                          </div>
                          <div className="exr-question-row right">
                            <span>✅</span>
                            <div>
                              <small>התשובה הנכונה</small>
                              <p dir="ltr">{wq.correctAnswer}</p>
                            </div>
                          </div>
                          {wq.explanation && (
                            <div className="exr-question-row expl">
                              <span>💡</span>
                              <div>
                                <small>הסבר</small>
                                <p>{wq.explanation}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {wrongQuestions.length > 5 && (
                  <p className="exr-questions-more">+ עוד {wrongQuestions.length - 5} שאלות</p>
                )}
              </div>

              <button className="exr-choice-cta rescue" onClick={onRetry}>
                <div className="exr-choice-cta-label">
                  <small>סיבוב ממוקד</small>
                  <b>תרגל שוב שאלות דומות</b>
                  <span>ELO-matched · מותאם לרמה שלך</span>
                </div>
                <div className="exr-choice-cta-arrow">
                  <span>בוא</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="19 3 5 12 19 21 19 3" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── 03 · סוג שאלות שונה ── */}
        <button className="exr-choice exr-choice-switch" onClick={handleGoToType}>
          <div className="exr-choice-ribbon">
            <span className="exr-choice-num">03</span>
            <span className="exr-choice-emoji">🔀</span>
          </div>
          <div className="exr-choice-body">
            <div className="exr-choice-titles">
              <h3>{typeInfo.nextLabel}</h3>
              <p>גיוון סוגי השאלות = שריר שלם יותר. מעבר לסוג אחר של שאלות.</p>
            </div>
            <div className="exr-choice-switch-footer">
              <span className="exr-choice-switch-cta">
                <span>יאללה סוג אחר</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="19 3 5 12 19 21 19 3" />
                </svg>
              </span>
            </div>
          </div>
        </button>
      </section>

      {/* ═══ MINIMAL FOOTER ═══ */}
      <div className="exr-footer-minimal">
        <button className="exr-footer-link exr-footer-home" onClick={() => navigate('/')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>לדף הבית</span>
        </button>
        <button className="exr-footer-link" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
          </svg>
          <span>חזרה לשאלות בחינה</span>
        </button>
        {onPlayDifferent && (
          <button className="exr-footer-link" onClick={onPlayDifferent}>
            <span>משהו אחר?</span>
          </button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   STYLES (exr-* prefix — isolated from game result)
   ═══════════════════════════════════════════════════════════════════ */
const cssBlock = `
/* ═══ Top "next step" CTA — always above-fold ═══ */
.exr-top-next{
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; width: 100%;
  padding: 12px 18px 12px 14px;
  margin-bottom: 12px;
  background: linear-gradient(135deg, ${Z.pink} 0%, ${Z.pinkLight} 100%);
  color: ${Z.white};
  border: 3px solid ${Z.black};
  border-radius: 18px;
  box-shadow: ${hs(5, Z.navy)};
  cursor: pointer;
  font-family: ${FONT_BODY};
  text-align: right;
  transition: transform .18s cubic-bezier(0.23, 1, 0.32, 1), box-shadow .18s cubic-bezier(0.23, 1, 0.32, 1);
  animation: exrBounceIn .5s var(--e) both;
}
.exr-top-next:hover{ transform: translate(-2px,-2px); box-shadow: ${hs(7, Z.navy)}; }
.exr-top-next:active{ transform: translate(2px,2px); box-shadow: ${hs(2, Z.navy)}; }
.exr-top-next-body{ display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.exr-top-next-body small{
  font-family: ${FONT_DISPLAY};
  font-size: 10px; font-weight: 800;
  letter-spacing: .16em; text-transform: uppercase;
  color: ${Z.yellow};
}
.exr-top-next-body b{
  font-family: ${FONT_DISPLAY};
  font-size: 16px; font-weight: 800; letter-spacing: -0.01em;
  line-height: 1.2;
}
.exr-top-next-body span{
  font-size: 12px; font-weight: 600;
  color: rgba(255,255,255,0.85);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 260px;
}
.exr-top-next-arrow{
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: ${Z.yellow}; color: ${Z.black};
  border: 2px solid ${Z.black}; border-radius: 50%;
  box-shadow: ${hs(2)};
  flex-shrink: 0;
}

.exr{
  --Zy: ${Z.yellow}; --Zys: ${Z.yellowSoft};
  --Zp: ${Z.pink}; --Zpl: ${Z.pinkLight}; --Zps: ${Z.pinkSoft};
  --Zn: ${Z.navy};
  --Zpu: ${Z.purple}; --Zpul: ${Z.purpleLight};
  --Zc: ${Z.correct}; --Zcs: ${Z.correctSoft};
  --Zw: ${Z.wrong}; --Zws: ${Z.wrongSoft};
  --Zbg: ${Z.bg}; --Zcr: ${Z.cream}; --Zgo: ${Z.gold};
  --ff-d: ${FONT_DISPLAY}; --ff-b: ${FONT_BODY};
  --e: var(--ease-out);
  padding: 4px 2px 12px;
  color: ${Z.black};
  font-family: var(--ff-b);
}

/* entrance animations */
@keyframes exrBounceIn {
  0% { opacity: 0; transform: translateY(26px); }
  60% { opacity: 1; transform: translateY(-3px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes exrCharEnter {
  0% { opacity: 0; transform: scale(0.95) rotate(-8deg); }
  60% { opacity: 1; transform: scale(1.08) rotate(4deg); }
  100% { opacity: 1; transform: scale(1) rotate(-2deg); }
}
@keyframes exrFloat { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-6px) rotate(2deg); } }
@keyframes exrPop { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
@keyframes exrStarburst { 0% { opacity: 0; transform: scale(0.95) rotate(0deg); } 100% { opacity: 0.6; transform: scale(1) rotate(360deg); } }
@keyframes exrSparkle { 0%,100% { opacity: 0; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1.4); } }
@keyframes exrPulse { 0%,100% { transform: translate(0,0); box-shadow: ${hs(6)}; } 50% { transform: translate(-2px,-2px); box-shadow: ${hs(8)}; } }

/* ═══ HERO ═══ */
.exr-hero{
  position: relative; text-align: center;
  background: ${Z.yellow};
  border: 3px solid ${Z.black};
  border-radius: 28px;
  box-shadow: ${hs(8)};
  padding: 28px 22px 24px;
  overflow: hidden;
  animation: exrBounceIn .6s var(--e) both;
}
.exr-hero::before{
  content: ""; position: absolute; inset: 0;
  background:
    radial-gradient(circle at 20% 10%, rgba(255,255,255,0.55) 0%, transparent 55%),
    radial-gradient(circle at 85% 90%, ${Z.pinkSoft} 0%, transparent 60%);
  pointer-events: none;
}
.exr-type-ribbon{
  position: relative; z-index: 2;
  display: inline-flex; align-items: center; gap: 10px;
  padding: 8px 14px 8px 12px; margin-bottom: 12px;
  background: ${Z.black}; color: ${Z.yellow};
  border: 2px solid ${Z.black}; border-radius: 999px;
  box-shadow: ${hs(2, Z.pink)};
  font-family: var(--ff-d);
  animation: exrPop .4s var(--e) .15s both;
}
.exr-type-ico{ font-size: 16px; line-height: 1; }
.exr-type-ribbon > div{ display: flex; flex-direction: column; text-align: right; line-height: 1.05; }
.exr-type-ribbon small{ font-size: 9px; font-weight: 700; letter-spacing: 0.2em; color: rgba(255,230,0,0.7); text-transform: uppercase; }
.exr-type-ribbon b{ font-size: 13px; font-weight: 800; letter-spacing: -0.01em; }

.exr-starburst{ position: absolute; top: 20%; left: 15%; width: 180px; height: 180px; pointer-events: none; animation: exrStarburst 1s var(--e) both; }
.exr-starburst span{ position: absolute; top: 50%; left: 50%; width: 3px; height: 90px; background: linear-gradient(to top, transparent, ${Z.pink} 40%, ${Z.pink}); transform-origin: center bottom; margin-left: -1.5px; margin-top: -90px; opacity: 0.3; }

.exr-sparkles{ position: absolute; inset: 0; pointer-events: none; }
.exr-sparkles i{ position: absolute; width: 10px; height: 10px; background: ${Z.black}; clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); animation: exrSparkle 2.4s ease-in-out infinite; }
.exr-sparkles i:nth-child(1){ animation-delay: 0s; }
.exr-sparkles i:nth-child(2){ animation-delay: 0.6s; }
.exr-sparkles i:nth-child(3){ animation-delay: 1.2s; }
.exr-sparkles i:nth-child(4){ animation-delay: 1.8s; }

.exr-hero-inner{ position: relative; display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px; }
.exr-char-wrap{ position: relative; width: clamp(130px, 36vw, 170px); flex-shrink: 0; }
.exr-char{ width: 100%; height: auto; display: block; filter: drop-shadow(4px 4px 0 ${Z.black}) drop-shadow(0 12px 20px rgba(0,0,0,0.2)); animation: exrCharEnter .7s var(--e) .15s both, exrFloat 3s ease-in-out 0.9s infinite; }
.exr-badge-stamp{ position: absolute; top: -8px; left: -10px; z-index: 3; background: ${Z.black}; color: ${Z.yellow}; border: 2px solid ${Z.black}; box-shadow: ${hs(3, Z.pink)}; padding: 7px 10px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; font-family: var(--ff-d); transform: rotate(-8deg); animation: exrPop .5s var(--e) .35s both; }
.exr-badge-stamp[data-badge="LEGENDARY"]{ background: ${Z.gold}; color: ${Z.black}; }
.exr-badge-stamp[data-badge="GOLD"]{ background: ${Z.yellow}; color: ${Z.black}; }
.exr-badge-stamp[data-badge="SILVER"]{ background: ${Z.pink}; color: ${Z.white}; }
.exr-badge-stamp[data-badge="BRONZE"]{ background: ${Z.purple}; color: ${Z.white}; }
.exr-badge-stamp[data-badge="GROWING"]{ background: ${Z.navy}; color: ${Z.yellow}; }
.exr-badge-stamp span{ font-size: 20px; line-height: 1; margin-bottom: 2px; }
.exr-badge-stamp b{ font-size: 8px; font-weight: 800; letter-spacing: .12em; }

.exr-score-bubble{ position: relative; animation: exrBounceIn .6s var(--e) .25s both; }
.exr-score-ring{ position: relative; width: clamp(100px, 26vw, 128px); height: clamp(100px, 26vw, 128px); background: ${Z.white}; border: 3px solid ${Z.black}; border-radius: 50%; box-shadow: ${hs(5)}; }
.exr-score-svg{ width: 100%; height: 100%; }
.exr-score-num{ position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 2px; font-family: var(--ff-d); color: ${Z.black}; }
.exr-score-num b{ font-size: clamp(26px, 6.5vw, 34px); font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
.exr-score-num span{ font-size: 16px; font-weight: 800; }

.exr-title{ font-family: var(--ff-d); font-weight: 800; font-size: clamp(26px, 6.5vw, 38px); letter-spacing: -0.03em; color: ${Z.black}; line-height: 1; margin-bottom: 8px; animation: exrPop .5s var(--e) .45s both; }
.exr-subtitle{ font-family: var(--ff-b); font-size: 13px; font-weight: 600; color: ${Z.navy}; line-height: 1.45; max-width: 400px; margin: 0 auto 12px; animation: exrBounceIn .5s var(--e) .55s both; }

.exr-score-meta{ display: inline-flex; align-items: center; gap: 12px; padding: 6px 14px; margin-bottom: 14px; background: ${Z.white}; border: 2px solid ${Z.black}; border-radius: 999px; box-shadow: ${hs(2)}; font-family: var(--ff-d); font-weight: 700; font-size: 13px; color: ${Z.navy}; animation: exrBounceIn .5s var(--e) .65s both; }
/* AMIR estimated-score badge — appears only when estimatedAmirScore is
   passed (FullExam sessions). Positioned between the raw score and stats. */
.exr-amir-badge{
  display: inline-flex; flex-direction: column; align-items: center;
  gap: 2px; margin: 4px auto 14px; padding: 10px 22px;
  background: linear-gradient(135deg, ${Z.yellow} 0%, ${Z.yellowDeep} 100%);
  border: 3px solid ${Z.black}; border-radius: 18px;
  box-shadow: ${hs(4)};
  font-family: var(--ff-d); color: ${Z.black};
  animation: exrBounceIn .5s var(--e) .75s both;
}
.exr-amir-badge small{
  font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
  color: rgba(0,0,0,0.65);
}
.exr-amir-badge b{
  font-size: 38px; font-weight: 900; line-height: 1; letter-spacing: -0.02em;
}
.exr-amir-hint{
  font-size: 11.5px; font-weight: 700; color: ${Z.pink};
  margin-top: 2px;
}
.exr-pb{ color: ${Z.pink}; font-weight: 800; padding-inline-start: 12px; border-inline-start: 2px solid ${Z.black}; }

.exr-stats{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; position: relative; }
@media (max-width: 420px){ .exr-stats{ grid-template-columns: repeat(2, 1fr); } }
.exr-stats:has(.exr-stat:nth-child(3):last-child){ grid-template-columns: repeat(3, 1fr); }
.exr-stat{ background: ${Z.white}; border: 2.5px solid ${Z.black}; border-radius: 14px; box-shadow: ${hs(3)}; padding: 10px 6px; display: flex; flex-direction: column; align-items: center; gap: 2px; animation: exrBounceIn .5s var(--e) both; }
.exr-stat:nth-child(1){ animation-delay: .75s; }
.exr-stat:nth-child(2){ animation-delay: .85s; }
.exr-stat:nth-child(3){ animation-delay: .95s; }
.exr-stat:nth-child(4){ animation-delay: 1.05s; }
.exr-stat[data-tier="xp"]{ background: ${Z.yellow}; }
.exr-stat[data-tier="time"]{ background: ${Z.white}; }
.exr-stat[data-tier="acc"]{ background: ${Z.correctSoft}; }
.exr-stat[data-tier="wrong"]{ background: ${Z.pinkSoft}; }
.exr-stat-ico{ font-size: 18px; line-height: 1; }
.exr-stat b{ font-family: var(--ff-d); font-size: 17px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; }
.exr-stat small{ font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: ${Z.navy}; opacity: .75; }

/* ═══ CHOICES ═══ */
.exr-choices{ margin-top: 14px; display: flex; flex-direction: column; gap: 14px; position: relative; }
.exr-choices-head{ text-align: center; margin-bottom: 4px; animation: exrBounceIn .5s var(--e) 1.2s both; }
.exr-choices-head h2{ font-family: var(--ff-d); font-weight: 900; font-size: clamp(22px, 5vw, 28px); letter-spacing: -0.02em; color: ${Z.black}; line-height: 1.1; margin-bottom: 4px; }
.exr-choices-head p{ font-size: 13px; font-weight: 600; color: ${Z.navy}; opacity: .75; max-width: 380px; margin: 0 auto; }

.exr-choice{ position: relative; border: 3px solid ${Z.black}; border-radius: 24px; padding: 18px 18px 16px; animation: exrBounceIn .5s var(--e) both; transition: transform .2s var(--e), box-shadow .2s var(--e); overflow: hidden; }
.exr-choice-plan{ background: ${Z.cream}; box-shadow: ${hs(6, Z.navy)}; animation-delay: 1.3s; }
.exr-choice-plan.is-primary{ background: linear-gradient(135deg, ${Z.yellowSoft} 0%, ${Z.cream} 70%, #fff 100%); box-shadow: ${hs(8, Z.pink)}; }
.exr-choice-review{ background: linear-gradient(135deg, ${Z.pinkSoft} 0%, #fff 100%); box-shadow: ${hs(6, Z.navy)}; animation-delay: 1.45s; }
.exr-choice-switch{ background: linear-gradient(135deg, ${Z.navy} 0%, ${Z.purple} 100%); color: ${Z.white}; box-shadow: ${hs(6, Z.yellow)}; animation-delay: 1.6s; cursor: pointer; font: inherit; text-align: right; width: 100%; }
.exr-choice-switch:hover{ transform: translate(-3px,-3px); box-shadow: ${hs(9, Z.yellow)}; }
.exr-choice-switch:active{ transform: translate(2px,2px); box-shadow: ${hs(3, Z.yellow)}; }

.exr-choice-ribbon{ position: absolute; top: -2px; inset-inline-start: 16px; display: flex; align-items: center; gap: 10px; padding: 6px 14px; background: ${Z.black}; color: ${Z.yellow}; border: 2.5px solid ${Z.black}; border-bottom-left-radius: 14px; border-bottom-right-radius: 14px; box-shadow: ${hs(2, Z.pink)}; font-family: var(--ff-d); }
.exr-choice-plan.is-primary .exr-choice-ribbon{ background: ${Z.pink}; color: ${Z.yellow}; box-shadow: ${hs(2, Z.navy)}; }
.exr-choice-review .exr-choice-ribbon{ background: ${Z.pink}; color: ${Z.white}; box-shadow: ${hs(2, Z.navy)}; }
.exr-choice-switch .exr-choice-ribbon{ background: ${Z.yellow}; color: ${Z.black}; box-shadow: ${hs(2, Z.pink)}; }
.exr-choice-num{ font-family: var(--ff-d); font-weight: 900; font-size: 13px; letter-spacing: .14em; }
.exr-choice-emoji{ font-size: 16px; line-height: 1; }

.exr-choice-body{ margin-top: 18px; display: flex; flex-direction: column; gap: 14px; }
.exr-choice-titles h3{ font-family: var(--ff-d); font-weight: 800; font-size: clamp(17px, 3.6vw, 20px); letter-spacing: -0.01em; color: ${Z.black}; line-height: 1.15; margin-bottom: 4px; }
.exr-choice-switch .exr-choice-titles h3{ color: ${Z.white}; }
.exr-choice-titles p{ font-size: 13px; font-weight: 600; color: ${Z.navy}; opacity: .78; line-height: 1.45; }
.exr-choice-switch .exr-choice-titles p{ color: rgba(255,255,255,0.78); }

/* Trail */
.exr-trail{ position: relative; display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; padding: 6px 4px 4px; }
/* Rail z-index 0 + opaque bubbles above (z-index 1) — previously the
   locked bubble used opacity .55 so the pink fill leaked through. */
.exr-trail-line, .exr-trail-line-fill{ position: absolute; top: 19px; left: 22px; right: 22px; height: 3px; z-index: 0; }
.exr-trail-line{ border-top: 3px dashed ${Z.black}; opacity: .25; }
.exr-trail-line-fill{ background: ${Z.pink}; box-shadow: 0 2px 0 0 ${Z.black}; transition: width .8s var(--e); }
.exr-trail-node{ position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; flex: 1; background: transparent; border: none; padding: 0; font: inherit; color: inherit; -webkit-tap-highlight-color: transparent; cursor: pointer; transition: transform .15s var(--e); animation: exrPop .4s var(--e) both; }
.exr-trail-node:disabled{ cursor: default; }
.exr-trail-bubble{ width: 40px; height: 40px; border-radius: 50%; background: ${Z.white}; border: 3px solid ${Z.black}; box-shadow: ${hs(2)}; display: flex; align-items: center; justify-content: center; font-size: 18px; position: relative; z-index: 1; transition: transform .15s var(--e), box-shadow .15s var(--e); }
.exr-trail-node.state-done .exr-trail-bubble{ background: ${Z.yellow}; transform: scale(1.05); }
.exr-trail-node.state-done .exr-check{ color: ${Z.black}; font-size: 22px; font-weight: 900; font-family: var(--ff-d); line-height: 1; }
.exr-trail-node.state-next .exr-trail-bubble{ background: ${Z.pink}; color: ${Z.white}; animation: exrPulse 1.4s ease-in-out infinite; }
/* opacity moved to inner icon — bubble stays opaque, rail stays hidden */
.exr-trail-node.state-locked .exr-trail-bubble{ background: ${Z.cream}; }
.exr-trail-node.state-locked .exr-trail-bubble > *{ opacity: .55; }
.exr-trail-label{ text-align: center; max-width: 72px; }
.exr-trail-label b{ display: block; font-family: var(--ff-d); font-weight: 700; font-size: 10px; color: ${Z.black}; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.exr-trail-label small{ font-size: 9px; color: ${Z.navy}; opacity: .6; font-weight: 600; }
.exr-trail-node.state-locked .exr-trail-label{ opacity: .5; }

/* CTA */
.exr-choice-cta{ display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 14px 16px; border: 3px solid ${Z.black}; border-radius: 18px; cursor: pointer; transition: transform .18s var(--e), box-shadow .18s var(--e); font: inherit; text-align: right; }
.exr-choice-cta.primary{ background: ${Z.navy}; color: ${Z.white}; box-shadow: ${hs(5, Z.pink)}; }
.exr-choice-cta.rescue{ background: ${Z.pink}; color: ${Z.white}; box-shadow: ${hs(5, Z.navy)}; }
.exr-choice-cta:hover{ transform: translate(-2px,-2px); box-shadow: ${hs(7, Z.pink)}; }
.exr-choice-cta.rescue:hover{ box-shadow: ${hs(7, Z.navy)}; }
.exr-choice-cta:active{ transform: translate(2px,2px); box-shadow: ${hs(2, Z.pink)}; }
.exr-choice-cta-label{ display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.exr-choice-cta-label small{ font-family: var(--ff-d); font-size: 10px; font-weight: 700; letter-spacing: .14em; color: ${Z.yellow}; text-transform: uppercase; }
.exr-choice-cta-label b{ font-family: var(--ff-d); font-size: 17px; font-weight: 800; line-height: 1.15; letter-spacing: -0.01em; }
.exr-choice-cta-label span{ font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.75); }
.exr-choice-cta-arrow{ display: flex; align-items: center; gap: 8px; padding: 9px 14px; background: ${Z.yellow}; color: ${Z.black}; border: 2px solid ${Z.black}; border-radius: 999px; font-family: var(--ff-d); font-weight: 800; font-size: 13px; box-shadow: ${hs(3)}; flex-shrink: 0; }

/* All-done inline */
.exr-choice-done{ display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: ${Z.correctSoft}; border: 2.5px solid ${Z.black}; border-radius: 16px; box-shadow: ${hs(3)}; }
.exr-choice-done-emoji{ font-size: 34px; animation: exrFloat 2s ease-in-out infinite; }
.exr-choice-done-text{ flex: 1; display: flex; flex-direction: column; gap: 2px; }
.exr-choice-done-text b{ font-family: var(--ff-d); font-weight: 800; font-size: 15px; letter-spacing: -0.01em; color: ${Z.black}; }
.exr-choice-done-text span{ font-size: 12px; font-weight: 600; color: ${Z.navy}; opacity: .75; }
.exr-choice-done-btn{ padding: 9px 16px; border-radius: 999px; background: ${Z.black}; color: ${Z.yellow}; border: 2px solid ${Z.black}; box-shadow: ${hs(2, Z.pink)}; font-family: var(--ff-d); font-weight: 800; font-size: 12px; cursor: pointer; transition: all .15s var(--e); white-space: nowrap; }
.exr-choice-done-btn:hover{ transform: translate(-2px,-2px); box-shadow: ${hs(4, Z.pink)}; }

/* Questions (expandable) */
.exr-questions{ display: flex; flex-direction: column; gap: 6px; }
.exr-question{ background: ${Z.white}; border: 2px solid ${Z.black}; border-radius: 12px; box-shadow: ${hs(2)}; overflow: hidden; transition: box-shadow .15s var(--e), transform .15s var(--e); }
.exr-question.expanded{ box-shadow: ${hs(3, Z.pink)}; transform: translate(-1px,-1px); }
/* Full-review variant tints the whole row so the student can scan the list
   and SEE where they stood — green streaks for correct runs, red for errors. */
.exr-question.full.ok{ background: linear-gradient(90deg, ${Z.correctSoft} 0%, ${Z.white} 30%); border-color: ${Z.correct}; }
.exr-question.full.ng{ background: linear-gradient(90deg, ${Z.wrongSoft} 0%, ${Z.white} 30%); border-color: ${Z.wrong}; }
.exr-question.full.ok.expanded{ box-shadow: ${hs(3, Z.correct)}; }
.exr-question.full.ng.expanded{ box-shadow: ${hs(3, Z.wrong)}; }
.exr-question-head{ display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 12px; background: transparent; border: none; cursor: pointer; text-align: right; font: inherit; min-height: 38px; }
/* Status circle — ✓ or ✕ badge before the question number. Big enough to
   scan at a glance across the full list. */
.exr-question-status{
  flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--ff-d); font-weight: 900; font-size: 14px; line-height: 1;
  color: ${Z.white}; border: 2px solid ${Z.black};
}
.exr-question-status.ok{ background: ${Z.correct}; }
.exr-question-status.ng{ background: ${Z.wrong}; }
.exr-question-badge{ font-family: var(--ff-d); font-size: 10px; font-weight: 800; color: ${Z.pink}; padding: 2px 8px; border-radius: 4px; background: ${Z.pinkSoft}; flex-shrink: 0; letter-spacing: 0.1em; text-transform: uppercase; }
.exr-question-stem{ flex: 1; font-size: 12.5px; font-weight: 600; color: ${Z.black}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.exr-question-chev{ font-size: 12px; color: ${Z.navy}; opacity: .6; transition: transform .2s var(--e); }
.exr-question-chev.open{ transform: rotate(180deg); color: ${Z.pink}; opacity: 1; }
.exr-question-expand{ padding: 0 12px 12px; display: flex; flex-direction: column; gap: 8px; border-top: 2px dashed ${Z.black}; margin-top: 2px; padding-top: 12px; animation: exrBounceIn .3s ease-out both; }
.exr-question-row{ display: flex; align-items: flex-start; gap: 10px; font-size: 13px; line-height: 1.5; color: ${Z.black}; }
.exr-question-row span{ font-size: 16px; flex-shrink: 0; line-height: 1.3; }
.exr-question-row small{ display: block; font-family: var(--ff-d); font-size: 10px; font-weight: 700; color: ${Z.navy}; opacity: .75; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 2px; }
.exr-question-row p{ flex: 1; font-size: 13px; }
.exr-question-row.wrong p{ color: ${Z.wrong}; }
.exr-question-row.right p{ color: ${Z.correct}; font-weight: 700; }
.exr-questions-more{ text-align: center; font-size: 11px; color: ${Z.navy}; opacity: .7; margin-top: 4px; font-weight: 600; }

/* Switch-CTA footer */
.exr-choice-switch-footer{ display: flex; justify-content: flex-end; }
.exr-choice-switch-cta{ display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; background: ${Z.yellow}; color: ${Z.black}; border: 2px solid ${Z.black}; border-radius: 999px; font-family: var(--ff-d); font-weight: 800; font-size: 14px; box-shadow: ${hs(3, Z.pink)}; pointer-events: none; }
.exr-choice-switch:hover .exr-choice-switch-cta{ transform: translate(-1px,-1px); box-shadow: ${hs(4, Z.pink)}; }

/* Minimal footer */
.exr-footer-minimal{ display: flex; justify-content: center; gap: 18px; margin-top: 22px; padding-top: 16px; border-top: 2px dashed rgba(10,14,31,0.15); animation: exrBounceIn .4s var(--e) 1.75s both; }
.exr-footer-link{ display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: transparent; border: 2px solid transparent; border-radius: 999px; color: ${Z.navy}; font-family: var(--ff-d); font-weight: 700; font-size: 13px; cursor: pointer; transition: all .15s var(--e); }
.exr-footer-link:hover{ background: ${Z.white}; border-color: ${Z.black}; box-shadow: ${hs(2)}; transform: translateY(-1px); }
.exr-footer-home{
  background: ${Z.yellow}; color: ${Z.black};
  border-color: ${Z.black}; box-shadow: ${hs(2)};
}
.exr-footer-home:hover{ background: ${Z.yellow}; box-shadow: ${hs(3, Z.pink)}; }

/* Mobile */
@media (max-width: 520px){
  .exr-hero{ padding: 24px 16px 20px; border-radius: 24px; }
  .exr-title{ font-size: clamp(24px, 7vw, 32px); }
  .exr-stat{ padding: 8px 4px; }
  .exr-stat b{ font-size: 15px; }
  .exr-stat small{ font-size: 8px; }
  .exr-choice{ padding: 18px 14px 14px; border-radius: 20px; }
  .exr-trail-bubble{ width: 32px; height: 32px; font-size: 14px; }
  .exr-trail-line, .exr-trail-line-fill{ top: 15px; left: 14px; right: 14px; }
  .exr-trail-label b{ font-size: 9px; }
  .exr-trail-label small{ font-size: 8px; }
  .exr-choice-cta{ padding: 12px 14px; flex-wrap: wrap; gap: 10px; }
  .exr-choice-cta-label b{ font-size: 15px; }
  .exr-choice-cta-arrow{ padding: 7px 12px; font-size: 12px; }
}

@media (prefers-reduced-motion: reduce){
  .exr *, .exr *::before, .exr *::after{
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
`
