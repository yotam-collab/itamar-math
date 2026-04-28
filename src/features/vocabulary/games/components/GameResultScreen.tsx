import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapMoment } from '../../stages/MapMoment'
import { useMapMoment } from '../../stages/useMapMoment'
import { SpeakerBtn, speakPregenSingle, speakPregenSequence } from '../../../../utils/tts'
import { getWordImageUrl } from '../../../../utils/wordImages'
import { playSound } from '../../../../utils/sounds'
import { ClickableEnglishText } from '../../../../components/common/ClickableEnglishText'
import type { Word } from '../../../../data/vocabulary/types'
import type { GameId } from '../types'
import type { Mission } from '../../../../services/mockCoachData'
import { g } from '../../../../utils/gender'
import { fireConfetti } from '../../../../utils/confetti'
import { asset } from '../../../../utils/assetUrl'

/* ═══════════════════════════════════════════════════════════════════
   GAME RESULT SCREEN · Arcade Victory × Neo-Brutalist Pop
   ───────────────────────────────────────────────────────────────────
   Design brief (user):
   • Over-the-top celebration, playful and fun
   • ZNK character prominently featured
   • Daily missions with completion trail
   • Encourage continuation to next practice
   • Review incorrect words with associations

   Design language:
   • Dominant colors: yellow + pink + navy (ZNK brand), black ink strokes
   • 2-3px black borders, hard-offset shadows (neo-brutalist)
   • Fluid display typography (Cabinet Grotesk / Plus Jakarta Sans)
   • Entrance motion: staggered bounces on load
   • Confetti + starburst + pulsing CTA — every element earns attention
   ═══════════════════════════════════════════════════════════════════ */

interface WrongWord {
  word: Word
  selectedAnswer?: string
}

interface GameResultScreenProps {
  gameId: GameId
  score: number
  total: number
  bestCombo: number
  totalXP: number
  startTime: number
  wrongWords: WrongWord[]
  wordsStrengthened: number
  endMessages: string[]
  isPersonalBest: boolean
  onBack: () => void
  onRetry: () => void
  onPlayDifferent?: () => void
}

/* ── Design Tokens ── */
const Z = {
  yellow: '#FFE600',
  yellowSoft: '#FFF3A3',
  yellowDeep: '#F5C900',
  pink: '#EE2B73',
  pinkLight: '#FF4D8E',
  pinkSoft: '#FFD0DE',
  navy: '#0d294b',
  navyLight: '#1E3A5F',
  purple: '#6B3FA0',
  purpleLight: '#8B5CF6',
  correct: '#10B981',
  correctSoft: '#D1FAE5',
  warning: '#F59E0B',
  wrong: '#EF4444',
  wrongSoft: '#FEE2E2',
  white: '#FFFFFF',
  black: '#000000',
  bg: '#FFF7E8', // warm paper
  cream: '#FFF1CC',
  gold: '#FFD700',
} as const

const FONT_DISPLAY = "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif"
const FONT_BODY = "'Heebo', 'Satoshi', sans-serif"

const hs = (n = 4, color: string = Z.black) => `${n}px ${n}px 0 0 ${color}`

/* ── Result Tier Logic ── */
interface ResultTier {
  labels: string[]           // rotating celebration titles
  subtitles: string[]        // rotating supporting lines
  badge: string
  emoji: string
  headerGradient: string
  scoreColor: string
  glowColor: string
  confetti: { particles: number; duration: number; spread: 'narrow' | 'medium' | 'wide' }
  character: string
}

function getResultTier(pct: number): ResultTier {
  if (pct === 100) return {
    labels: [
      'פיי-ר-פקט!',
      g('אלוף על!', 'אלופת על!'),
      'Crush!',
      'טוטאלי!',
      'בדיוק לפטור!',
      g('אין כמוך!', 'אין כמוך!'),
      'זה ראש של אמירנט!',
      g('מטורף!', 'מטורפת!'),
      'אין מילים!',
      g('ואו, אתה תותח!', 'ואו, את תותחית!'),
      'GOAT!',
    ],
    subtitles: [
      'מושלם. בדיוק ככה מגיעים לפטור.',
      'אפס טעויות. רמה של פטור — ממשיכים.',
      g('אתה בשיא. נשמור על הכיוון.', 'את בשיא. נשמור על הכיוון.'),
    ],
    badge: 'LEGENDARY',
    emoji: '🏆',
    headerGradient: `linear-gradient(135deg, ${Z.gold}, ${Z.yellow} 45%, ${Z.pink})`,
    scoreColor: Z.gold,
    glowColor: Z.gold,
    confetti: { particles: 200, duration: 3500, spread: 'wide' },
    character: 'char-english.png',
  }
  if (pct >= 85) return {
    labels: [
      g('אלוף!', 'אלופה!'),
      'כבוד גדול!',
      'וואו!',
      'מאסטר!',
      g('מלך!', 'מלכה!'),
      g('מהדק את זה!', 'מהדקת את זה!'),
      'Solid!',
      g('רמת פטור!', 'רמת פטור!'),
    ],
    subtitles: [
      'רמת פטור באופק. עוד כמה סיבובים כאלה.',
      g('עבודה רצינית — ממשיך לדחוף.', 'עבודה רצינית — ממשיכה לדחוף.'),
      g('שולט. עוד סשנים כאלה ואתה שם.', 'שולטת. עוד סשנים כאלה ואת שם.'),
    ],
    badge: 'GOLD',
    emoji: '⭐',
    headerGradient: `linear-gradient(135deg, ${Z.yellow}, ${Z.pink} 70%, ${Z.purple})`,
    scoreColor: Z.pink,
    glowColor: Z.pink,
    confetti: { particles: 140, duration: 2500, spread: 'wide' },
    character: 'char-english.png',
  }
  if (pct >= 70) return {
    labels: [
      'יפה מאוד! 💪',
      'כל הכבוד!',
      g('ממשיך ככה!', 'ממשיכה ככה!'),
      'שיפור רציני!',
      g('מתקדם יפה!', 'מתקדמת יפה!'),
      'On fire!',
      'ישר ולעניין!',
    ],
    subtitles: [
      g('השיפור ניכר — ממשיך בדיוק ככה.', 'השיפור ניכר — ממשיכה בדיוק ככה.'),
      'עוד תרגול ועוד דיוק — הנה הדרך.',
      g('אתה במסלול. רק לא לעצור.', 'את במסלול. רק לא לעצור.'),
    ],
    badge: 'SILVER',
    emoji: '💪',
    headerGradient: `linear-gradient(135deg, ${Z.pink}, ${Z.purple})`,
    scoreColor: Z.purple,
    glowColor: Z.purple,
    confetti: { particles: 90, duration: 2000, spread: 'medium' },
    character: 'char-english.png',
  }
  if (pct >= 50) return {
    labels: [
      'התקדמת! 📈',
      'הדרך נכונה!',
      'צעד אחר צעד!',
      g('עוד קצת ואתה שם!', 'עוד קצת ואת שם!'),
      'בונים שריר!',
      g('נפתח לך!', 'נפתח לך!'),
    ],
    subtitles: [
      'כל סיבוב = עוד לבנה בקיר. סבלנות.',
      g('השיפור מגיע. אתה קרוב.', 'השיפור מגיע. את קרובה.'),
      'דיוק עולה בהדרגה — ממשיכים.',
    ],
    badge: 'BRONZE',
    emoji: '📈',
    headerGradient: `linear-gradient(135deg, ${Z.purpleLight}, ${Z.navy})`,
    scoreColor: Z.purple,
    glowColor: Z.purpleLight,
    confetti: { particles: 60, duration: 1500, spread: 'narrow' },
    character: 'char-english.png',
  }
  return {
    labels: [
      'עוד סיבוב!',
      'בונים שריר!',
      'כל תרגול חשוב!',
      g('תחזור בכוח!', 'תחזרי בכוח!'),
      g('אל תוותר!', 'אל תוותרי!'),
      'Growth Mode!',
      'זה החלק הקשה — ננצח אותו.',
    ],
    subtitles: [
      g('התבלבלויות היום = ידע מקובע מחר. אתה בונה שרירים.', 'התבלבלויות היום = ידע מקובע מחר. את בונה שרירים.'),
      'טעויות עכשיו = ציון גבוה בהמשך.',
      g('חוזרים על המילים ומתחזקים — זה המשחק.', 'חוזרות על המילים ומתחזקות — זה המשחק.'),
    ],
    badge: 'GROWING',
    emoji: '🔥',
    headerGradient: `linear-gradient(135deg, ${Z.navy}, ${Z.purple})`,
    scoreColor: Z.navy,
    glowColor: Z.pink,
    confetti: { particles: 40, duration: 1200, spread: 'narrow' },
    character: 'char-english.png',
  }
}

const MISSION_EMOJI: Record<string, string> = {
  vocab_flashcards: '📇',
  vocab_wordhack:   '🎯',
  vocab_adaptive:   '🧠',
  vocab_learn:      '📚',
  vocab_gravity:    '⚡',
  vocab_practice:   '🎯',
  reading:          '📖',
  exam_sc:          '✏️',
  exam_restatement: '🔄',
}

/* ═══════════════════════════════════════════════════════════════ */

export function GameResultScreen({
  gameId: _gameId,
  score,
  total,
  bestCombo,
  totalXP,
  startTime,
  wrongWords,
  wordsStrengthened,
  endMessages,
  isPersonalBest,
  onBack,
  onRetry,
  onPlayDifferent,
}: GameResultScreenProps) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const elapsed = Math.round((Date.now() - startTime) / 1000)
  const tier = getResultTier(pct)

  const navigate = useNavigate()
  const [nextMission, setNextMission] = useState<Mission | null>(null)
  const [dailyMissions, setDailyMissions] = useState<Mission[]>([])
  const [missionState, setMissionState] = useState<'none' | 'has-next' | 'all-done'>('none')
  const [expandedWordIdx, setExpandedWordIdx] = useState<number | null>(null)
  const [displayPct, setDisplayPct] = useState(0)

  /* Rotating celebration copy — pick once per mount so a user seeing
     "פיירפקט" one round sees "Crush!" or "טוטאלי!" the next. */
  const [celebrationLabel] = useState(() => tier.labels[Math.floor(Math.random() * tier.labels.length)])
  const [celebrationSubtitle] = useState(() => tier.subtitles[Math.floor(Math.random() * tier.subtitles.length)])

  /* Count-up animation for score */
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

  /* Load daily plan + handle mission completion — fires EXACTLY ONCE on mount.
     Previously this depended on `tier.confetti` which is a freshly-allocated
     object every render → effect re-fired on every re-render, causing the
     completion sound to play 100× and confetti to flash repeatedly. */
  // Map Moment — shown if the student just proved their current stage.
  const { moment: mapMoment, closeMoment: closeMapMoment, checkAndProveStage } = useMapMoment()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    try { playSound('complete') } catch { /* ok */ }
    // Fire celebratory confetti sized to the tier (capture tier once)
    try { fireConfetti(tier.confetti) } catch { /* ok */ }
    // Check if the student crossed the mastery threshold for their
    // current stage — if yes, the MapMoment celebration overlay opens
    // with the climber visibly stepping up one stage.
    // 600ms delay so the confetti lands first, then the map takes over.
    const t = setTimeout(() => { checkAndProveStage() }, 600)

    // ─── Coach-mission completion + next-mission discovery ─────────────
    // Previously this block sat AFTER an early `return` (the cleanup fn),
    // which made it dead code — the student would complete a homework
    // mission but never see the "next mission" shortcut. Now it runs on
    // mount alongside the confetti/stage-check effect.
    try {
      const activeMissionId = localStorage.getItem('znk-active-mission')
      import('../../../../stores/coachStore').then(async ({ useCoachStore }) => {
        if (activeMissionId) {
          localStorage.removeItem('znk-active-mission')
          await useCoachStore.getState().completeMission(activeMissionId)
        }
        const plan = useCoachStore.getState().dailyPlan
        if (plan) {
          const missions = plan.missions.filter(m => !m.id.startsWith('bonus-'))
          setDailyMissions(missions)
          const next = missions.find(m => m.status !== 'completed' && m.status !== 'locked')
          if (next) {
            setNextMission(next)
            setMissionState('has-next')
          } else {
            setMissionState('all-done')
          }
        }
      }).catch(() => { /* ok */ })
    } catch { /* ok */ }

    // Cleanup must be the LAST thing returned from the effect.
    return () => clearTimeout(t)
    // Intentionally empty deps: mount-only initialization
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

  /* Handle click on any mission node in the daily trail.
     • Locked → ignore (button is also disabled)
     • Completed → navigate to replay the practice (no active-mission marker)
     • Active/pending → mark as active and navigate
  */
  const handleMissionClick = (m: Mission) => {
    if (m.status === 'locked') return
    playSound('click')
    if (m.status !== 'completed') {
      localStorage.setItem('znk-active-mission', m.id)
    }
    const url = m.routeParams && Object.keys(m.routeParams).length > 0
      ? `${m.route}?${new URLSearchParams(m.routeParams).toString()}`
      : m.route
    navigate(url)
  }

  const rescueWrongWords = () => {
    const ids = wrongWords.map(ww => ww.word.id)
    try { localStorage.setItem('znk-rescue-queue', JSON.stringify(ids)) } catch { /* ok */ }
    playSound('click')
    navigate('/vocabulary/games/rescueMode')
  }

  const missionStats = useMemo(() => {
    const done = dailyMissions.filter(m => m.status === 'completed').length
    const total = dailyMissions.length
    const remainingMin = dailyMissions
      .filter(m => m.status !== 'completed' && m.status !== 'locked')
      .reduce((s, m) => s + m.estimatedMinutes, 0)
    return { done, total, remainingMin }
  }, [dailyMissions])

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`

  /* Always-visible "next step" shortcut above the fold */
  const topNextGame = nextMission
    ? { label: `הבא: ${nextMission.title}`, sub: `~${nextMission.estimatedMinutes} דק׳`, action: handleNextMission }
    : { label: 'סיבוב נוסף', sub: 'אותו משחק, מילים חדשות', action: onRetry }

  return (
    <div className="grs" dir="rtl">
      <style>{cssBlock}</style>

      {/* Stage-up celebration overlay — opens only when a stage was proved */}
      <MapMoment
        open={mapMoment.open}
        reason={mapMoment.reason}
        provenStageId={mapMoment.provenStageId}
        onClose={closeMapMoment}
      />

      {/* ═══ HERO — Character + Score ═══ */}
      <section className="grs-hero">
        {/* Animated starburst rays behind character */}
        <div className="grs-starburst" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} style={{ transform: `rotate(${i * 30}deg)` }} />
          ))}
        </div>
        {/* Floating sparkle dots */}
        <div className="grs-sparkles" aria-hidden="true">
          <i style={{ top: '10%', left: '8%' }} />
          <i style={{ top: '18%', right: '12%' }} />
          <i style={{ top: '70%', left: '14%' }} />
          <i style={{ top: '62%', right: '8%' }} />
          <i style={{ top: '38%', left: '3%' }} />
          <i style={{ top: '28%', right: '4%' }} />
        </div>

        <div className="grs-hero-inner">
          {/* Character — big, celebrating */}
          <div className="grs-char-wrap">
            <div className="grs-badge-stamp" data-badge={tier.badge}>
              <span>{tier.emoji}</span>
              <b>{tier.badge}</b>
            </div>
            <img
              className="grs-char"
              src={asset(tier.character)}
              alt=""
              aria-hidden="true"
            />
          </div>

          {/* Score bubble */}
          <div className="grs-score-bubble">
            <div className="grs-score-ring">
              <svg viewBox="0 0 120 120" className="grs-score-svg">
                <defs>
                  <linearGradient id="grsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={Z.yellow} />
                    <stop offset="100%" stopColor={Z.pink} />
                  </linearGradient>
                </defs>
                <circle cx="60" cy="60" r="48" fill="none" stroke={Z.black} strokeWidth="4" />
                <circle
                  cx="60" cy="60" r="48" fill="none"
                  stroke="url(#grsGrad)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(displayPct / 100) * 301.6} 301.6`}
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dasharray .5s cubic-bezier(.34,1.56,.64,1)' }}
                />
              </svg>
              <div className="grs-score-num">
                <b>{displayPct}</b>
                <span>%</span>
              </div>
            </div>
          </div>
        </div>

        <h1 className="grs-title">{celebrationLabel}</h1>
        <p className="grs-subtitle">{celebrationSubtitle}</p>

        <div className="grs-score-meta">
          <span>{score}/{total} נכונות</span>
          {isPersonalBest && <span className="grs-pb">🏅 שיא חדש!</span>}
        </div>

        {/* Stats strip — chunky brutalist tiles */}
        <div className="grs-stats">
          <div className="grs-stat" data-tier="xp">
            <span className="grs-stat-ico">⚡</span>
            <b>+{totalXP}</b>
            <small>XP</small>
          </div>
          <div className="grs-stat" data-tier="combo">
            <span className="grs-stat-ico">🔥</span>
            <b>{bestCombo}</b>
            <small>קומבו</small>
          </div>
          <div className="grs-stat" data-tier="time">
            <span className="grs-stat-ico">⏱️</span>
            <b>{mmss}</b>
            <small>זמן</small>
          </div>
          {wordsStrengthened > 0 && (
            <div className="grs-stat" data-tier="strengthened">
              <span className="grs-stat-ico">💪</span>
              <b>{wordsStrengthened}</b>
              <small>חוזקו</small>
            </div>
          )}
        </div>
      </section>

      {/* ═══ NEXT STEP BAR — moved to sit BELOW the hero per user request.
          The big hero is the celebration first; the next-action is the
          call-to-action right after — cleaner visual flow. */}
      <button className="grs-top-next" type="button" onClick={topNextGame.action}>
        <div className="grs-top-next-body">
          <small>מה עכשיו?</small>
          <b>{topNextGame.label}</b>
          <span>{topNextGame.sub}</span>
        </div>
        <div className="grs-top-next-arrow">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="19 3 5 12 19 21 19 3" />
          </svg>
        </div>
      </button>

      {/* ═══════════════════════════════════════════════════════════════
          3-CHOICE SECTION — "מה הלאה?"
          Three celebratory paths forward, each a colorful card that
          reflects the Arcade Victory × Neo-Brutalist Pop language.
          ═══════════════════════════════════════════════════════════════ */}
      <section className="grs-choices" aria-label="מה הלאה">
        <div className="grs-choices-head">
          <h2>מה הלאה?</h2>
          <p>בחר את הצעד הבא — שלושה מסלולים שיחזקו אותך הכי טוב</p>
        </div>

        {/* ══ CHOICE 01 — המשך בתוכנית היומית ══ */}
        {dailyMissions.length > 0 && (
          <div
            className={`grs-choice grs-choice-plan ${missionState === 'has-next' ? 'is-primary' : ''}`}
            data-status={missionState}
          >
            <div className="grs-choice-ribbon">
              <span className="grs-choice-num">01</span>
              <span className="grs-choice-emoji">🗺️</span>
            </div>
            <div className="grs-choice-body">
              <div className="grs-choice-titles">
                <h3>המשך בתוכנית היומית</h3>
                <p>
                  {missionStats.done}/{missionStats.total} הושלמו
                  {missionStats.remainingMin > 0 && ` · עוד ~${missionStats.remainingMin} דק׳ ליום מלא`}
                </p>
              </div>

              {/* Trail — clickable */}
              <div className="grs-choice-trail">
                <div className="grs-trail-line" aria-hidden="true" />
                <div
                  className="grs-trail-line-fill"
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
                  const ariaLabel = isLocked
                    ? `${m.title} — נעול`
                    : isDone
                      ? `${m.title} — בוצע. לחצו לתרגול חוזר.`
                      : `${m.title} — ${m.estimatedMinutes} דק׳. לחצו להתחיל.`
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`grs-trail-node state-${state}`}
                      style={{ animationDelay: `${0.5 + i * 0.1}s` }}
                      disabled={isLocked}
                      onClick={() => handleMissionClick(m)}
                      aria-label={ariaLabel}
                      title={ariaLabel}
                    >
                      <div className="grs-trail-bubble">
                        {isDone ? (
                          <span className="grs-check">✓</span>
                        ) : isLocked ? (
                          <span>🔒</span>
                        ) : (
                          <span>{emoji}</span>
                        )}
                      </div>
                      <div className="grs-trail-label">
                        <b>{m.title}</b>
                        <small>{m.estimatedMinutes} דק׳</small>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Primary CTA or all-done inline */}
              {missionState === 'has-next' && nextMission && (
                <button className="grs-choice-cta primary" onClick={handleNextMission}>
                  <div className="grs-choice-cta-label">
                    <small>הבא בתור</small>
                    <b>{nextMission.title}</b>
                    <span>~{nextMission.estimatedMinutes} דק׳ · +{30 + dailyMissions.indexOf(nextMission) * 10} XP</span>
                  </div>
                  <div className="grs-choice-cta-arrow">
                    <span>יאללה</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="19 3 5 12 19 21 19 3" />
                    </svg>
                  </div>
                </button>
              )}

              {missionState === 'all-done' && (
                <div className="grs-choice-done">
                  <span className="grs-choice-done-emoji">🏆</span>
                  <div className="grs-choice-done-text">
                    <b>יום מלא! {g('סגרת', 'סגרת')} את הכל.</b>
                    <span>מחר משימות חדשות.</span>
                  </div>
                  <button className="grs-choice-done-btn" onClick={onBack}>
                    לדף הבית
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ CHOICE 02 — חזור על מילים שטעית ══ */}
        {wrongWords.length > 0 && (
          <div className="grs-choice grs-choice-rescue">
            <div className="grs-choice-ribbon">
              <span className="grs-choice-num">02</span>
              <span className="grs-choice-emoji">💪</span>
            </div>
            <div className="grs-choice-body">
              <div className="grs-choice-titles">
                <h3>חזק את המילים שהחלקת עליהן</h3>
                <p>
                  {wrongWords.length} מילים · ~{Math.max(1, Math.round(wrongWords.length * 0.3))} דק׳ של שינון ממוקד
                </p>
              </div>

              {/* Word pills preview — clickable to expand with image + auto TTS */}
              <div className="grs-choice-words">
                {wrongWords.slice(0, 6).map((ww, i) => {
                  const isExpanded = expandedWordIdx === i
                  const hasDetails = !!ww.word.association || !!ww.word.example
                  const imageUrl = getWordImageUrl(ww.word.id)
                  return (
                    <div key={i} className={`grs-word-pill ${isExpanded ? 'expanded' : ''}`}>
                      <button
                        type="button"
                        className="grs-word-pill-head"
                        onClick={() => {
                          // Allow expand even without details so image + TTS still fire
                          setExpandedWordIdx(isExpanded ? null : i)
                          if (!isExpanded) {
                            // Auto TTS sequence: English word → Hebrew meaning → association.
                            // speakPregenSequence falls back silently if a track is missing.
                            try {
                              const types: Array<'word' | 'meaning' | 'association'> = ['word', 'meaning']
                              if (ww.word.association) types.push('association')
                              speakPregenSequence(ww.word.id, types, 350)
                            } catch { /* ok */ }
                          }
                        }}
                      >
                        <span className="grs-word-pill-eng" dir="ltr">
                          <SpeakerBtn text={ww.word.english} size={13} />
                          <ClickableEnglishText text={ww.word.english} source="manual" />
                        </span>
                        <span className="grs-word-pill-sep">·</span>
                        <span className="grs-word-pill-heb">{ww.word.hebrew}</span>
                        <span className={`grs-word-pill-chev ${isExpanded ? 'open' : ''}`} aria-hidden="true">▾</span>
                      </button>
                      {isExpanded && (
                        <div className="grs-word-pill-expand">
                          {imageUrl && (
                            <div className="grs-word-pill-img-wrap">
                              <img
                                src={imageUrl}
                                alt={ww.word.english}
                                className="grs-word-pill-img"
                                loading="lazy"
                              />
                            </div>
                          )}
                          {ww.word.association && (
                            <div className="grs-word-pill-row">
                              <span>💡</span>
                              <p>{ww.word.association}</p>
                            </div>
                          )}
                          {!hasDetails && !imageUrl && (
                            <div className="grs-word-pill-row">
                              <span>🔊</span>
                              <p style={{ opacity: 0.7, fontSize: 12 }}>השמענו את המילה — לחץ שוב לסגור</p>
                            </div>
                          )}
                          {ww.word.example && (
                            <div className="grs-word-pill-row" dir="ltr">
                              <span>📝</span>
                              <p className="italic">{ww.word.example}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {wrongWords.length > 6 && (
                  <span className="grs-word-pill-more">+{wrongWords.length - 6} נוספות</span>
                )}
              </div>

              <button className="grs-choice-cta rescue" onClick={rescueWrongWords}>
                <div className="grs-choice-cta-label">
                  <small>חזרה ממוקדת</small>
                  <b>שנן את ה-{wrongWords.length} האלה עכשיו</b>
                  <span>רסקיו מוד · SRS חכם</span>
                </div>
                <div className="grs-choice-cta-arrow">
                  <span>בוא</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="19 3 5 12 19 21 19 3" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ══ CHOICE 03 — עוד סיבוב ══ */}
        <button className="grs-choice grs-choice-retry" onClick={onRetry}>
          <div className="grs-choice-ribbon">
            <span className="grs-choice-num">03</span>
            <span className="grs-choice-emoji">🔄</span>
          </div>
          <div className="grs-choice-body">
            <div className="grs-choice-titles">
              <h3>עוד סיבוב!</h3>
              <p>אותו משחק · לשפר את הציון · עוד XP בדרך</p>
            </div>
            <div className="grs-choice-retry-footer">
              <span className="grs-choice-retry-cta">
                <span>יאללה סיבוב</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="19 3 5 12 19 21 19 3" />
                </svg>
              </span>
            </div>
          </div>
        </button>
      </section>

      {/* ═══ MINIMAL FOOTER ═══ */}
      <div className="grs-footer-minimal">
        <button className="grs-footer-link grs-footer-home" onClick={() => navigate('/')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>לדף הבית</span>
        </button>
        <button className="grs-footer-link" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
          </svg>
          <span>חזרה למשחקים</span>
        </button>
        {onPlayDifferent && (
          <button className="grs-footer-link" onClick={onPlayDifferent}>
            <span>משהו אחר?</span>
          </button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   STYLES — neo-brutalist arcade pop
   ═══════════════════════════════════════════════════════════════════ */
const cssBlock = `
/* ═══ Top "next step" CTA — above-fold on every result screen ═══ */
.grs-top-next{
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
  animation: grsBounceIn .5s var(--ease) both;
}
.grs-top-next:hover{ transform: translate(-2px,-2px); box-shadow: ${hs(7, Z.navy)}; }
.grs-top-next:active{ transform: translate(2px,2px); box-shadow: ${hs(2, Z.navy)}; }
.grs-top-next-body{ display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.grs-top-next-body small{
  font-family: var(--ff-d);
  font-size: 10px; font-weight: 800;
  letter-spacing: .16em; text-transform: uppercase;
  color: ${Z.yellow};
}
.grs-top-next-body b{
  font-family: var(--ff-d);
  font-size: 16px; font-weight: 800; letter-spacing: -0.01em;
  line-height: 1.2;
}
.grs-top-next-body span{
  font-size: 12px; font-weight: 600;
  color: rgba(255,255,255,0.85);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 260px;
}
.grs-top-next-arrow{
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: ${Z.yellow}; color: ${Z.black};
  border: 2px solid ${Z.black}; border-radius: 50%;
  box-shadow: ${hs(2)};
  flex-shrink: 0;
}

.grs{
  --Zy: ${Z.yellow}; --Zys: ${Z.yellowSoft}; --Zyd: ${Z.yellowDeep};
  --Zp: ${Z.pink}; --Zpl: ${Z.pinkLight}; --Zps: ${Z.pinkSoft};
  --Zn: ${Z.navy}; --Znl: ${Z.navyLight};
  --Zpu: ${Z.purple}; --Zpul: ${Z.purpleLight};
  --Zc: ${Z.correct}; --Zcs: ${Z.correctSoft};
  --Zw: ${Z.wrong}; --Zws: ${Z.wrongSoft};
  --Zbg: ${Z.bg}; --Zcr: ${Z.cream}; --Zgo: ${Z.gold};
  --ff-d: ${FONT_DISPLAY}; --ff-b: ${FONT_BODY};
  --ease: cubic-bezier(0.34, 1.56, 0.64, 1);
  padding: 4px 2px 12px;
  color: ${Z.black};
  font-family: var(--ff-b);
}

/* ── Entrance animations ── */
@keyframes grsPop {
  0%   { opacity: 0; transform: scale(0.6) translateY(20px); }
  60%  { opacity: 1; transform: scale(1.08) translateY(-4px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes grsBounceIn {
  0%   { opacity: 0; transform: translateY(30px) scale(0.9); }
  70%  { opacity: 1; transform: translateY(-6px) scale(1.04); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes grsCharEnter {
  0%   { opacity: 0; transform: scale(0.95) rotate(-12deg); }
  60%  { opacity: 1; transform: scale(1.12) rotate(4deg); }
  100% { opacity: 1; transform: scale(1) rotate(-2deg); }
}
@keyframes grsFloat {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50%      { transform: translateY(-6px) rotate(2deg); }
}
@keyframes grsStarburst {
  0%   { opacity: 0; transform: scale(0.5) rotate(0deg); }
  100% { opacity: 0.6; transform: scale(1) rotate(360deg); }
}
@keyframes grsSparkle {
  0%, 100% { opacity: 0; transform: scale(0.5); }
  50%      { opacity: 1; transform: scale(1.4); }
}
@keyframes grsPulse {
  0%, 100% { transform: translate(0,0); box-shadow: ${hs(6)}; }
  50%      { transform: translate(-2px,-2px); box-shadow: ${hs(8)}; }
}
@keyframes grsBadgeWobble {
  0%, 100% { transform: rotate(-8deg); }
  50%      { transform: rotate(-12deg) scale(1.05); }
}

/* ═══ HERO ═══ */
.grs-hero{
  position: relative; text-align: center;
  background: ${Z.yellow};
  border: 3px solid ${Z.black};
  border-radius: 28px;
  box-shadow: ${hs(8)};
  padding: 32px 22px 26px;
  overflow: hidden;
  animation: grsBounceIn .6s var(--ease) both;
}
.grs-hero::before{
  content: ""; position: absolute; inset: 0;
  background:
    radial-gradient(circle at 20% 10%, rgba(255,255,255,0.55) 0%, transparent 55%),
    radial-gradient(circle at 85% 90%, ${Z.pinkSoft} 0%, transparent 60%);
  pointer-events: none;
}

/* Starburst rays behind character */
.grs-starburst{
  position: absolute; top: 18%; left: 15%;
  width: 200px; height: 200px;
  pointer-events: none;
  animation: grsStarburst 1s var(--ease) both;
}
.grs-starburst span{
  position: absolute; top: 50%; left: 50%;
  width: 3px; height: 100px;
  background: linear-gradient(to top, transparent, ${Z.pink} 40%, ${Z.pink});
  transform-origin: center bottom;
  margin-left: -1.5px; margin-top: -100px;
  opacity: 0.35;
}

/* Floating sparkles */
.grs-sparkles{ position: absolute; inset: 0; pointer-events: none; }
.grs-sparkles i{
  position: absolute; width: 10px; height: 10px;
  background: ${Z.black};
  clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
  animation: grsSparkle 2.4s ease-in-out infinite;
}
.grs-sparkles i:nth-child(1){ animation-delay: 0s; }
.grs-sparkles i:nth-child(2){ animation-delay: 0.4s; }
.grs-sparkles i:nth-child(3){ animation-delay: 0.8s; }
.grs-sparkles i:nth-child(4){ animation-delay: 1.2s; }
.grs-sparkles i:nth-child(5){ animation-delay: 1.6s; }
.grs-sparkles i:nth-child(6){ animation-delay: 2s; }

.grs-hero-inner{
  position: relative;
  display: flex; align-items: center; justify-content: center;
  gap: 10px; margin-bottom: 16px;
}

/* Character */
.grs-char-wrap{
  position: relative;
  width: clamp(140px, 38vw, 180px);
  flex-shrink: 0;
}
.grs-char{
  width: 100%; height: auto; display: block;
  filter: drop-shadow(4px 4px 0 ${Z.black}) drop-shadow(0 12px 20px rgba(0,0,0,0.2));
  animation: grsCharEnter .7s var(--ease) 0.15s both, grsFloat 3s ease-in-out 0.9s infinite;
}

/* Badge stamp overlay */
.grs-badge-stamp{
  position: absolute; top: -8px; left: -12px;
  z-index: 3;
  background: ${Z.black}; color: ${Z.yellow};
  border: 2px solid ${Z.black};
  box-shadow: ${hs(3, Z.pink)};
  padding: 8px 12px;
  border-radius: 14px;
  display: flex; flex-direction: column; align-items: center;
  font-family: var(--ff-d);
  transform: rotate(-8deg);
  animation: grsPop .5s var(--ease) .35s both, grsBadgeWobble 2.8s ease-in-out 1.2s infinite;
}
.grs-badge-stamp[data-badge="LEGENDARY"]{ background: ${Z.gold}; color: ${Z.black}; box-shadow: ${hs(3, Z.pink)}; }
.grs-badge-stamp[data-badge="GOLD"]{ background: ${Z.yellow}; color: ${Z.black}; }
.grs-badge-stamp[data-badge="SILVER"]{ background: ${Z.pink}; color: ${Z.white}; }
.grs-badge-stamp[data-badge="BRONZE"]{ background: ${Z.purple}; color: ${Z.white}; }
.grs-badge-stamp[data-badge="GROWING"]{ background: ${Z.navy}; color: ${Z.yellow}; }
.grs-badge-stamp span{ font-size: 22px; line-height: 1; margin-bottom: 2px; }
.grs-badge-stamp b{ font-size: 9px; font-weight: 800; letter-spacing: .12em; }

/* Score ring + bubble */
.grs-score-bubble{
  position: relative;
  animation: grsBounceIn .6s var(--ease) .25s both;
}
.grs-score-ring{
  position: relative;
  width: clamp(110px, 28vw, 140px);
  height: clamp(110px, 28vw, 140px);
  background: ${Z.white};
  border: 3px solid ${Z.black};
  border-radius: 50%;
  box-shadow: ${hs(5)};
}
.grs-score-svg{ width: 100%; height: 100%; }
.grs-score-num{
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  gap: 2px;
  font-family: var(--ff-d);
  color: ${Z.black};
}
.grs-score-num b{ font-size: clamp(28px, 7vw, 38px); font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
.grs-score-num span{ font-size: 18px; font-weight: 800; }

/* Title + subtitle */
.grs-title{
  font-family: var(--ff-d); font-weight: 800;
  font-size: clamp(28px, 7vw, 42px); letter-spacing: -0.03em;
  color: ${Z.black}; line-height: 1;
  margin-bottom: 8px;
  animation: grsPop .5s var(--ease) .45s both;
  position: relative;
}
.grs-subtitle{
  font-family: var(--ff-b); font-size: 13px; font-weight: 600;
  color: ${Z.navy}; line-height: 1.45;
  max-width: 400px; margin: 0 auto 14px;
  position: relative;
  animation: grsBounceIn .5s var(--ease) .55s both;
}
.grs-score-meta{
  display: inline-flex; align-items: center; gap: 12px;
  padding: 6px 14px; margin-bottom: 18px;
  background: ${Z.white};
  border: 2px solid ${Z.black};
  border-radius: 999px;
  box-shadow: ${hs(2)};
  font-family: var(--ff-d); font-weight: 700; font-size: 13px;
  color: ${Z.navy};
  position: relative;
  animation: grsBounceIn .5s var(--ease) .65s both;
}
.grs-pb{
  color: ${Z.pink}; font-weight: 800;
  padding-inline-start: 12px;
  border-inline-start: 2px solid ${Z.black};
}

/* Stats strip */
.grs-stats{
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  position: relative;
}
@media (max-width: 420px){
  .grs-stats{ grid-template-columns: repeat(2, 1fr); }
}
.grs-stats:has(.grs-stat:nth-child(3):last-child){
  grid-template-columns: repeat(3, 1fr);
}
.grs-stat{
  background: ${Z.white};
  border: 2.5px solid ${Z.black};
  border-radius: 14px;
  box-shadow: ${hs(3)};
  padding: 10px 6px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  animation: grsBounceIn .5s var(--ease) both;
}
.grs-stat:nth-child(1){ animation-delay: .75s; }
.grs-stat:nth-child(2){ animation-delay: .85s; }
.grs-stat:nth-child(3){ animation-delay: .95s; }
.grs-stat:nth-child(4){ animation-delay: 1.05s; }
.grs-stat[data-tier="xp"]{ background: ${Z.yellow}; }
.grs-stat[data-tier="combo"]{ background: ${Z.pinkSoft}; }
.grs-stat[data-tier="time"]{ background: ${Z.white}; }
.grs-stat[data-tier="strengthened"]{ background: ${Z.correctSoft}; }
.grs-stat-ico{ font-size: 18px; line-height: 1; }
.grs-stat b{ font-family: var(--ff-d); font-size: 18px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; }
.grs-stat small{ font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: ${Z.navy}; opacity: .75; }

/* ═══ SECTIONS ═══ */
.grs-section{
  background: ${Z.white};
  border: 3px solid ${Z.black};
  border-radius: 22px;
  box-shadow: ${hs(6)};
  padding: 18px 18px 16px;
  margin-top: 18px;
  animation: grsBounceIn .5s var(--ease) both;
}
.grs-trail-section{ animation-delay: 1.15s; background: ${Z.cream}; }
.grs-words-section{ animation-delay: 1.35s; }
.grs-shead{ display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.grs-shead h2{ font-family: var(--ff-d); font-weight: 800; font-size: 17px; letter-spacing: -0.01em; color: ${Z.black}; }
.grs-shead-meta{ font-size: 11px; font-weight: 700; color: ${Z.navy}; opacity: .7; }

/* ═══ MISSION TRAIL ═══ */
.grs-trail{
  position: relative;
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 4px;
  padding: 6px 4px 0;
}
.grs-trail-line, .grs-trail-line-fill{
  position: absolute; top: 19px; left: 22px; right: 22px; height: 3px;
  /* z-index 0 keeps the rail strictly BEHIND the bubbles (z-index 1).
     Previously the locked bubble used opacity .55, which made it translucent
     and let the pink fill show through. Bubble is now opaque; rail is z-sorted
     below it. */
  z-index: 0;
}
.grs-trail-line{
  border-top: 3px dashed ${Z.black}; opacity: .25;
}
.grs-trail-line-fill{
  background: ${Z.pink};
  box-shadow: 0 2px 0 0 ${Z.black};
  transition: width .8s var(--ease);
}
.grs-trail-node{
  position: relative;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  min-width: 0; flex: 1;
  /* button resets */
  background: transparent; border: none; padding: 0;
  font: inherit; color: inherit; -webkit-tap-highlight-color: transparent;
  cursor: pointer;
  transition: transform .15s var(--ease);
  animation: grsPop .4s var(--ease) both;
}
.grs-trail-node:disabled{ cursor: default; }
.grs-trail-node:focus-visible{ outline: none; }
.grs-trail-node:focus-visible .grs-trail-bubble{
  box-shadow: ${hs(2)}, 0 0 0 3px ${Z.pink};
}
.grs-trail-node:not(:disabled):hover .grs-trail-bubble{
  transform: scale(1.15) rotate(-4deg);
  box-shadow: ${hs(4)};
}
.grs-trail-node:not(:disabled):active .grs-trail-bubble{
  transform: scale(0.92);
  box-shadow: ${hs(1)};
}
.grs-trail-node:not(:disabled):hover .grs-trail-label b{ color: ${Z.pink}; }
.grs-trail-bubble{
  width: 40px; height: 40px; border-radius: 50%;
  background: ${Z.white};
  border: 3px solid ${Z.black};
  box-shadow: ${hs(2)};
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  position: relative; z-index: 1;
  transition: transform .15s var(--ease), box-shadow .15s var(--ease);
}
.grs-trail-node.state-done .grs-trail-bubble{
  background: ${Z.yellow};
  transform: scale(1.05);
}
.grs-trail-node.state-done .grs-check{
  color: ${Z.black}; font-size: 22px; font-weight: 900;
  font-family: var(--ff-d); line-height: 1;
}
.grs-trail-node.state-next .grs-trail-bubble{
  background: ${Z.pink}; color: ${Z.white};
  animation: grsPulse 1.4s ease-in-out infinite;
  border-color: ${Z.black};
}
.grs-trail-node.state-locked .grs-trail-bubble{
  background: ${Z.cream};
  /* opacity moved to inner icon — bubble stays opaque, rail stays hidden */
}
.grs-trail-node.state-locked .grs-trail-bubble > *{ opacity: .55; }
.grs-trail-node.state-pending .grs-trail-bubble{
  background: ${Z.white};
}
.grs-trail-label{
  text-align: center;
  max-width: 72px;
}
.grs-trail-label b{
  display: block; font-family: var(--ff-d); font-weight: 700;
  font-size: 10px; color: ${Z.black}; line-height: 1.2;
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.grs-trail-label small{ font-size: 9px; color: ${Z.navy}; opacity: .6; font-weight: 600; }
.grs-trail-node.state-locked .grs-trail-label{ opacity: .5; }

/* ═══ END MESSAGES — moved above choices as a victory message ═══ */
.grs-end-msgs{ margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
.grs-end-msg{
  background: ${Z.yellowSoft}; border: 2px solid ${Z.black};
  border-radius: 14px; box-shadow: ${hs(2)};
  padding: 10px 14px;
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 13px; font-weight: 600; color: ${Z.black};
  animation: grsBounceIn .4s var(--ease) 1.15s both;
}
.grs-end-msg span{ font-size: 16px; flex-shrink: 0; }
.grs-end-msg p{ line-height: 1.5; flex: 1; }

/* ══════════════════════════════════════════════════════════════
   CHOICES — "מה הלאה?" three celebratory paths forward
   ══════════════════════════════════════════════════════════════ */
.grs-choices{
  margin-top: 14px;
  display: flex; flex-direction: column; gap: 14px;
  position: relative;
}
.grs-choices-head{
  text-align: center;
  margin-bottom: 4px;
  animation: grsBounceIn .5s var(--ease) 1.2s both;
}
.grs-choices-head h2{
  font-family: var(--ff-d); font-weight: 900;
  font-size: clamp(22px, 5vw, 28px);
  letter-spacing: -0.02em;
  /* White + yellow accent — GameShell uses a dark navy gradient background,
     so black text was invisible. */
  color: ${Z.white};
  text-shadow: 0 2px 0 ${Z.black}, 0 4px 12px rgba(0,0,0,0.4);
  line-height: 1.1; margin-bottom: 6px;
}
.grs-choices-head p{
  font-size: 13px; font-weight: 600;
  color: rgba(255,255,255,0.75);
  max-width: 380px; margin: 0 auto;
}

/* ── Base choice card ── */
.grs-choice{
  position: relative;
  border: 3px solid ${Z.black};
  border-radius: 24px;
  padding: 18px 18px 16px;
  animation: grsBounceIn .5s var(--ease) both;
  transition: transform .2s var(--ease), box-shadow .2s var(--ease);
  overflow: hidden;
}
.grs-choice-plan{
  background: ${Z.cream};
  box-shadow: ${hs(6, Z.navy)};
  animation-delay: 1.3s;
}
.grs-choice-plan.is-primary{
  background: linear-gradient(135deg, ${Z.yellowSoft} 0%, ${Z.cream} 70%, #fff 100%);
  box-shadow: ${hs(8, Z.pink)};
  border-color: ${Z.black};
}
.grs-choice-rescue{
  background: linear-gradient(135deg, ${Z.pinkSoft} 0%, #fff 100%);
  box-shadow: ${hs(6, Z.navy)};
  animation-delay: 1.45s;
}
.grs-choice-retry{
  /* Whole card is a button */
  background: linear-gradient(135deg, ${Z.navy} 0%, ${Z.purple} 100%);
  color: ${Z.white};
  box-shadow: ${hs(6, Z.yellow)};
  animation-delay: 1.6s;
  cursor: pointer; border: 3px solid ${Z.black};
  font: inherit;
  text-align: right;
  width: 100%;
}
.grs-choice-retry:hover{ transform: translate(-3px,-3px); box-shadow: ${hs(9, Z.yellow)}; }
.grs-choice-retry:active{ transform: translate(2px,2px); box-shadow: ${hs(3, Z.yellow)}; }

/* ── Ribbon (number + emoji) ── */
.grs-choice-ribbon{
  position: absolute;
  top: -2px; inset-inline-start: 16px;
  display: flex; align-items: center; gap: 10px;
  padding: 6px 14px;
  background: ${Z.black}; color: ${Z.yellow};
  border: 2.5px solid ${Z.black};
  border-top-left-radius: 0; border-top-right-radius: 0;
  border-bottom-left-radius: 14px; border-bottom-right-radius: 14px;
  box-shadow: ${hs(2, Z.pink)};
  font-family: var(--ff-d);
}
.grs-choice-plan.is-primary .grs-choice-ribbon{ background: ${Z.pink}; color: ${Z.yellow}; box-shadow: ${hs(2, Z.navy)}; }
.grs-choice-rescue .grs-choice-ribbon{ background: ${Z.pink}; color: ${Z.white}; box-shadow: ${hs(2, Z.navy)}; }
.grs-choice-retry .grs-choice-ribbon{ background: ${Z.yellow}; color: ${Z.black}; box-shadow: ${hs(2, Z.pink)}; }
.grs-choice-num{
  font-family: var(--ff-d); font-weight: 900;
  font-size: 13px; letter-spacing: .14em;
}
.grs-choice-emoji{ font-size: 16px; line-height: 1; }

/* ── Body ── */
.grs-choice-body{
  margin-top: 18px;
  display: flex; flex-direction: column; gap: 14px;
}
.grs-choice-titles h3{
  font-family: var(--ff-d); font-weight: 800;
  font-size: clamp(17px, 3.6vw, 20px);
  letter-spacing: -0.01em;
  color: ${Z.black};
  line-height: 1.15;
  margin-bottom: 4px;
}
.grs-choice-retry .grs-choice-titles h3{ color: ${Z.white}; }
.grs-choice-titles p{
  font-size: 13px; font-weight: 600;
  color: ${Z.navy}; opacity: .78;
  line-height: 1.45;
}
.grs-choice-retry .grs-choice-titles p{ color: rgba(255,255,255,0.78); }

/* ══ Trail inside choice 01 ══ */
.grs-choice-trail{
  position: relative;
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 4px;
  padding: 6px 4px 4px;
}
/* Reuse existing .grs-trail-line + .grs-trail-node styles (still defined above) */

/* ══ Primary CTA inside choice ══ */
.grs-choice-cta{
  display: flex; align-items: center; justify-content: space-between;
  width: 100%;
  padding: 14px 16px;
  border: 3px solid ${Z.black};
  border-radius: 18px;
  cursor: pointer;
  transition: all .18s var(--ease);
  font: inherit;
  text-align: right;
}
.grs-choice-cta.primary{
  background: ${Z.navy}; color: ${Z.white};
  box-shadow: ${hs(5, Z.pink)};
}
.grs-choice-cta.rescue{
  background: ${Z.pink}; color: ${Z.white};
  box-shadow: ${hs(5, Z.navy)};
}
.grs-choice-cta:hover{ transform: translate(-2px,-2px); box-shadow: ${hs(7, Z.pink)}; }
.grs-choice-cta.rescue:hover{ box-shadow: ${hs(7, Z.navy)}; }
.grs-choice-cta:active{ transform: translate(2px,2px); box-shadow: ${hs(2, Z.pink)}; }
.grs-choice-cta-label{ display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.grs-choice-cta-label small{
  font-family: var(--ff-d); font-size: 10px; font-weight: 700;
  letter-spacing: .14em; color: ${Z.yellow}; text-transform: uppercase;
}
.grs-choice-cta.rescue .grs-choice-cta-label small{ color: ${Z.yellow}; }
.grs-choice-cta-label b{
  font-family: var(--ff-d); font-size: 17px; font-weight: 800;
  line-height: 1.15; letter-spacing: -0.01em;
}
.grs-choice-cta-label span{ font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.75); }
.grs-choice-cta-arrow{
  display: flex; align-items: center; gap: 8px;
  padding: 9px 14px;
  background: ${Z.yellow}; color: ${Z.black};
  border: 2px solid ${Z.black};
  border-radius: 999px;
  font-family: var(--ff-d); font-weight: 800; font-size: 13px;
  box-shadow: ${hs(3)};
  flex-shrink: 0;
}

/* ══ All-done inline (choice 01 complete state) ══ */
.grs-choice-done{
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px;
  background: ${Z.correctSoft};
  border: 2.5px solid ${Z.black};
  border-radius: 16px;
  box-shadow: ${hs(3)};
}
.grs-choice-done-emoji{
  font-size: 34px;
  animation: grsFloat 2s ease-in-out infinite;
}
.grs-choice-done-text{ flex: 1; display: flex; flex-direction: column; gap: 2px; }
.grs-choice-done-text b{
  font-family: var(--ff-d); font-weight: 800; font-size: 15px;
  letter-spacing: -0.01em; color: ${Z.black};
}
.grs-choice-done-text span{ font-size: 12px; font-weight: 600; color: ${Z.navy}; opacity: .75; }
.grs-choice-done-btn{
  padding: 9px 16px; border-radius: 999px;
  background: ${Z.black}; color: ${Z.yellow};
  border: 2px solid ${Z.black}; box-shadow: ${hs(2, Z.pink)};
  font-family: var(--ff-d); font-weight: 800; font-size: 12px;
  cursor: pointer; transition: all .15s var(--ease);
  white-space: nowrap;
}
.grs-choice-done-btn:hover{ transform: translate(-2px,-2px); box-shadow: ${hs(4, Z.pink)}; }

/* ══ Word pills inside choice 02 ══ */
.grs-choice-words{
  display: flex; flex-direction: column; gap: 6px;
}
.grs-word-pill{
  background: ${Z.white};
  border: 2px solid ${Z.black};
  border-radius: 12px;
  box-shadow: ${hs(2)};
  overflow: hidden;
  transition: box-shadow .15s var(--ease), transform .15s var(--ease);
}
.grs-word-pill.expanded{ box-shadow: ${hs(3, Z.pink)}; transform: translate(-1px,-1px); }
.grs-word-pill-head{
  display: flex; align-items: center; gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: transparent; border: none; cursor: pointer;
  text-align: right; font: inherit;
  min-height: 38px;
}
.grs-word-pill-eng{
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13.5px; font-weight: 800; color: ${Z.black};
  flex-shrink: 0;
}
.grs-word-pill-sep{ font-size: 13px; color: ${Z.navy}; opacity: .4; }
.grs-word-pill-heb{
  font-size: 13px; font-weight: 600; color: ${Z.navy};
  flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.grs-word-pill-chev{
  font-size: 12px; color: ${Z.navy}; opacity: .6;
  transition: transform .2s var(--ease);
  margin-inline-start: auto;
}
.grs-word-pill-chev.open{ transform: rotate(180deg); color: ${Z.pink}; opacity: 1; }
.grs-word-pill-expand{
  padding: 0 12px 10px;
  border-top: 2px dashed ${Z.black};
  margin-top: 2px; padding-top: 10px;
  display: flex; flex-direction: column; gap: 8px;
  animation: grsBounceIn .3s ease-out both;
}
.grs-word-pill-img-wrap{
  display: flex; justify-content: center;
  padding: 4px 0 2px;
}
.grs-word-pill-img{
  max-width: 140px;
  max-height: 100px;
  border-radius: 10px;
  border: 2px solid ${Z.black};
  box-shadow: ${hs(2, Z.pink)};
  object-fit: cover;
  animation: grsBounceIn .4s var(--ease) both;
}
.grs-word-pill-row{ display: flex; align-items: flex-start; gap: 10px; font-size: 13px; line-height: 1.5; color: ${Z.black}; }
.grs-word-pill-row span{ font-size: 16px; flex-shrink: 0; line-height: 1.3; }
.grs-word-pill-row p{ flex: 1; }
.grs-word-pill-row .italic{ font-style: italic; color: ${Z.navy}; }
.grs-word-pill-more{
  align-self: flex-start; padding: 6px 12px;
  background: ${Z.yellow}; color: ${Z.black};
  border: 2px solid ${Z.black}; border-radius: 999px;
  font-family: var(--ff-d); font-weight: 800; font-size: 11px;
  box-shadow: ${hs(2)};
}

/* ══ Retry footer inside choice 03 ══ */
.grs-choice-retry-footer{
  display: flex; justify-content: flex-end;
}
.grs-choice-retry-cta{
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  background: ${Z.yellow}; color: ${Z.black};
  border: 2px solid ${Z.black};
  border-radius: 999px;
  font-family: var(--ff-d); font-weight: 800; font-size: 14px;
  box-shadow: ${hs(3, Z.pink)};
  pointer-events: none; /* whole card is button */
}
.grs-choice-retry:hover .grs-choice-retry-cta{ transform: translate(-1px,-1px); box-shadow: ${hs(4, Z.pink)}; }

/* ══ Minimal footer ══ */
.grs-footer-minimal{
  display: flex; justify-content: center; gap: 18px;
  margin-top: 22px; padding-top: 16px;
  border-top: 2px dashed rgba(10,14,31,0.15);
  animation: grsBounceIn .4s var(--ease) 1.75s both;
}
.grs-footer-link{
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  /* The result screen sits on top of GameShell's dark gradient
     (#0F0B1E → #0D0920). The footer's transparent background let
     the dark gradient show through, and the previous navy text
     was invisible on it. We now ship a subtle translucent white
     surface plus white text so "חזרה למשחקים" / "משהו אחר?" /
     "לדף הבית" stay legible — and turn into the original white
     pill with black text on hover for a clear affordance. */
  background: rgba(255,255,255,0.10);
  border: 2px solid rgba(255,255,255,0.22);
  border-radius: 999px;
  color: ${Z.white};
  font-family: var(--ff-d); font-weight: 700; font-size: 13px;
  cursor: pointer;
  transition: all .15s var(--ease);
}
.grs-footer-link:hover{
  background: ${Z.white};
  color: ${Z.black};
  border-color: ${Z.black};
  box-shadow: ${hs(2)};
  transform: translateY(-1px);
}
.grs-footer-home{
  background: ${Z.yellow}; color: ${Z.black};
  border-color: ${Z.black}; box-shadow: ${hs(2)};
}
.grs-footer-home:hover{ background: ${Z.yellow}; box-shadow: ${hs(3, Z.pink)}; }

/* ═══ MOBILE (≤ 520px) ═══ */
@media (max-width: 520px){
  .grs-hero{ padding: 24px 16px 20px; border-radius: 24px; }
  .grs-hero-inner{ gap: 6px; }
  .grs-title{ font-size: clamp(26px, 8vw, 34px); }
  .grs-subtitle{ font-size: 12.5px; }
  .grs-stats{ gap: 6px; }
  .grs-stat{ padding: 8px 4px; }
  .grs-stat b{ font-size: 16px; }
  .grs-stat small{ font-size: 8px; }
  .grs-section{ padding: 16px 14px; border-radius: 18px; }
  .grs-choice{ padding: 18px 14px 14px; border-radius: 20px; }
  .grs-choices-head h2{ font-size: 22px; }
  .grs-choice-titles h3{ font-size: 16px; }
  .grs-choice-titles p{ font-size: 12px; }
  .grs-trail{ gap: 2px; }
  .grs-trail-bubble{ width: 32px; height: 32px; font-size: 14px; }
  .grs-trail-line, .grs-trail-line-fill{ top: 15px; left: 14px; right: 14px; }
  .grs-trail-label b{ font-size: 9px; }
  .grs-trail-label small{ font-size: 8px; }
  .grs-choice-cta{ padding: 12px 14px; flex-wrap: wrap; gap: 10px; }
  .grs-choice-cta-label b{ font-size: 15px; }
  .grs-choice-cta-arrow{ padding: 7px 12px; font-size: 12px; }
  .grs-choice-done{ flex-wrap: wrap; }
  .grs-choice-done-btn{ margin-inline-start: auto; }
  .grs-word-pill-head{ padding: 8px 10px; flex-wrap: wrap; }
  .grs-word-pill-eng{ font-size: 12.5px; }
  .grs-word-pill-heb{ font-size: 12px; }
  .grs-footer-minimal{ gap: 8px; flex-wrap: wrap; }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce){
  .grs *, .grs *::before, .grs *::after{
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
`
