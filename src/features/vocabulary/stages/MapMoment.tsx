import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useStudentProfileStore } from '../../../stores/studentProfileStore'
import { playSound } from '../../../utils/sounds'
import { fireConfetti } from '../../../utils/confetti'
import { asset } from '../../../utils/assetUrl'
import {
  STAGES,
  STAGES_BY_ID,
  ensureAssignmentsGlobal,
} from './stageHelpers'
import { isBandTransitionStage } from './useMapMoment'
import { useGamificationStore } from '../../../stores/gamificationStore'

/* ═══════════════════════════════════════════════════════════════════
   MAP MOMENT — "זינוק לפטור" visualization
   ───────────────────────────────────────────────────────────────────
   Arcade Victory × Neo-Brutalist — matches GameResultScreen palette:
   yellow, pink, navy, cream surface, hard black borders, chunky
   drop-shadows (no blur).

   Shown at TWO deliberate moments only:
     1. First practice of each day — orientation ("here's your journey")
     2. Immediately after proving a stage — climber animates up one step

   Hover any stage node to see what's there + an encouraging cheer.
   ═══════════════════════════════════════════════════════════════════ */

/* ZNK palette — mirrors GameResultScreen Z constant */
const Z = {
  yellow: '#FFE600',
  yellowSoft: '#FFF3A3',
  pink: '#EE2B73',
  pinkLight: '#FF4D8E',
  pinkSoft: '#FFD0DE',
  navy: '#0d294b',
  purple: '#6B3FA0',
  correct: '#10B981',
  correctSoft: '#D1FAE5',
  teal: '#0D9488',
  tealSoft: '#CCFBF1',
  white: '#FFFFFF',
  black: '#000000',
  cream: '#FFF1CC',
  bg: '#FFF7E8',
  gold: '#FFD700',
} as const

const BAND_COLORS: Record<string, { fill: string; ring: string; label: string }> = {
  foothills: { fill: Z.purple, ring: Z.yellow, label: 'עמקי הבסיס · 1-6' },
  ascent:    { fill: Z.teal,    ring: Z.yellow, label: 'הרכסים · 7-14' },
  climb:     { fill: Z.yellow,  ring: Z.black,  label: 'הטיפוס · 15-20' },
  summit:    { fill: Z.pink,    ring: Z.yellow, label: 'הפסגה · 21-24' },
}

/* Reason set locked-in by the 2026-04-24 timing-research spec.
   `daily-first` is gone — replaced with the variable-ratio set. */
export type MapMomentReason =
  | 'stage-proven'      // 85% threshold crossed; check isBandTransitionStage for tier
  | 'streak-milestone'  // current streak hit one of [3, 7, 14, 30, 60, 100]
  | 'comeback'          // ≥72h absent
  | 'weekly'            // weekly fallback if nothing else fired
  | 'manual'            // top-nav tap
  /* Legacy — kept so old persisted state doesn't crash; rendered as 'manual'. */
  | 'daily-first'

interface Props {
  open: boolean
  reason: MapMomentReason
  /** Stage that was JUST proven (stage-proven case). Triggers climb animation. */
  provenStageId?: number
  onClose: () => void
}

export function MapMoment({ open, reason, provenStageId, onClose }: Props) {
  const currentStageId = useStudentProfileStore((s) => s.currentStageId)
  const provenStageIds = useStudentProfileStore((s) => s.provenStageIds)
  const currentStreak = useGamificationStore((s) => s.currentStreak)

  /* TIER-A celebration when the just-proven stage is a band transition
     (foothills→ascent, ascent→climb, climb→summit, or summit reached).
     TIER-A gets bigger confetti + the second/third audio beat. */
  const isTierA = reason === 'stage-proven' && provenStageId !== undefined && isBandTransitionStage(provenStageId)

  const provenSet = useMemo(() => new Set(provenStageIds), [provenStageIds])
  const [climberStage, setClimberStage] = useState(currentStageId)
  const [hoveredStage, setHoveredStage] = useState<number | null>(null)
  /* Entry animation tick — bumped each time `open` flips to true. Child
     SVG elements key off it to replay stagger + path-draw animations. */
  const [entryKey, setEntryKey] = useState(0)

  useEffect(() => {
    if (!open) return
    ensureAssignmentsGlobal()
    // Replay entry animations every time the modal opens
    setEntryKey((k) => k + 1)
    /* AUDIO is layered at the CLIMAX (climber arrival ≈ t=3.3s), not
       at the open beat — per the 2026-04-24 timing-research spec. */
    const timers: number[] = []

    if (reason === 'stage-proven' && provenStageId) {
      /* Stage-proven choreography (slower + more cinematic).
         t=0      Modal opens, climber pinned at the just-proven stage
         t=350ms  Trail starts drawing (CSS animation)
         t=1500ms Climber LEAVES proven stage and sweeps up the mountain
                  (2.6s ease-out cubic — settles at current stage).
         t≈4.1s   ARRIVAL CLIMAX — confetti burst + `complete` sound.
         t≈4.3s   TIER-A: second beat (`levelup`).
         t≈4.7s   TIER-A: achievement beat for band transitions. */
      setClimberStage(provenStageId)
      timers.push(window.setTimeout(() => setClimberStage(currentStageId), 1500))
      // Climax — fire confetti + main sound when the climber lands
      const climaxAt = 1500 + 2600  // 4.1s after open
      timers.push(window.setTimeout(() => {
        try { fireConfetti({ particles: isTierA ? 260 : 180, duration: 3600, spread: 'wide' }) } catch { /* ok */ }
        playSound('complete')
      }, climaxAt))
      // TIER-A only: second + third audio beats
      if (isTierA) {
        timers.push(window.setTimeout(() => playSound('levelup'), climaxAt + 200))
        timers.push(window.setTimeout(() => playSound('achievement'), climaxAt + 600))
      }
      return () => timers.forEach(clearTimeout)
    }

    /* Streak / comeback / weekly / manual / daily-first (legacy) all
       use the long-sweep choreography that walks the climber from
       valley → current stage, with audio at the arrival beat. */
    setClimberStage(1)
    timers.push(window.setTimeout(() => setClimberStage(currentStageId), 700))
    const climaxAt = 700 + 2600  // 3.3s after open
    timers.push(window.setTimeout(() => {
      playSound('complete')
      // Streak milestones earn a small confetti ribbon at climax
      if (reason === 'streak-milestone') {
        try { fireConfetti({ particles: 120, duration: 2400, spread: 'narrow' }) } catch { /* ok */ }
      }
    }, climaxAt))
    return () => timers.forEach(clearTimeout)
  }, [open, reason, provenStageId, currentStageId, isTierA])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  const currentStage = STAGES_BY_ID[currentStageId]
  const nextStage = currentStageId < 24 ? STAGES_BY_ID[currentStageId + 1] : null

  /* ─── Copy — adapts to the trigger reason. ─────────────────────── */
  const { badge, headline, subhead, purposeLine, ctaLabel } = useMemo(() => {
    if (reason === 'stage-proven' && provenStageId) {
      const fromStage = STAGES_BY_ID[provenStageId]
      const tierA = isBandTransitionStage(provenStageId)
      return {
        badge: tierA ? 'אזור חדש נפתח' : 'שלב הושלם',
        headline: tierA ? 'אזור חדש — כל הכבוד!' : 'כבשת את השלב!',
        subhead: `כיבשת את "${fromStage?.name}" — ${fromStage?.wordCount} מילים בכיס.`,
        purposeLine: nextStage ? `הצעד הבא: ${nextStage.name}.` : 'הגעת לפסגה — פטור!',
        ctaLabel: nextStage ? 'יאללה, ממשיכים לטפס ←' : 'הפטור שלך — מגיע לך!',
      }
    }
    if (reason === 'streak-milestone') {
      return {
        badge: 'רצף · ' + currentStreak + ' ימים',
        headline: `${currentStreak} ימים ברצף!`,
        subhead: `הקצב שלך הוא הסיבה שזה עובד. אתה ב"${currentStage?.name}" — ${provenStageIds.length} שלבים מאחור.`,
        purposeLine: 'כל יום ברצף הוא יתרון על מי שנכנס פעם בשבוע.',
        ctaLabel: 'יאללה, ממשיכים ←',
      }
    }
    if (reason === 'comeback') {
      return {
        badge: 'ברוך השב',
        headline: 'הנה איפה עצרנו',
        subhead: `${provenStageIds.length} שלבים כבר מאחור — אתה ב"${currentStage?.name}".`,
        purposeLine: 'כל שלב = חבילת מילים שתכבוש. הפסגה = ציון 134.',
        ctaLabel: 'בוא נחזור לעבודה ←',
      }
    }
    if (reason === 'weekly') {
      return {
        badge: 'סיכום שבועי',
        headline: 'איפה אתה השבוע',
        subhead: `${provenStageIds.length} שלבים כבושים · אתה ב"${currentStage?.name}".`,
        purposeLine: nextStage ? `הצעד הבא: ${nextStage.name}.` : 'אתה על קצה הפסגה — לא להוריד רגל מהגז.',
        ctaLabel: 'הבנתי, ממשיכים ←',
      }
    }
    /* manual + legacy daily-first fall-through */
    return {
      badge: 'המסע שלך',
      headline: 'זינוק לפטור',
      subhead: `אתה ב"${currentStage?.name}" — ${provenStageIds.length} שלבים מאחור, ${24 - provenStageIds.length} קדימה.`,
      purposeLine: 'כבוש 85% ממילות השלב כדי לעלות לבא.',
      ctaLabel: 'סגור ←',
    }
  }, [reason, provenStageId, nextStage, provenStageIds, currentStage, currentStreak])

  const hovered = hoveredStage ? STAGES_BY_ID[hoveredStage] : null
  const hoveredState: 'proven' | 'current' | 'locked' | 'pending' = hovered
    ? provenSet.has(hovered.id)
      ? 'proven'
      : hovered.id === currentStageId
      ? 'current'
      : hovered.id > currentStageId
      ? 'locked'
      : 'pending'
    : 'pending'

  /* Portal to body so the modal escapes any ancestor stacking context.
     Previously the top nav (fixed z:50) was rendering ABOVE this modal
     because the modal was inside `<main class="z-[1]">` which creates
     a stacking context lower than the nav's. */
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="mm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="מפת המסע שלך"
        >
          <style>{cssBlock}</style>
          <motion.div
            className="mm-card"
            initial={{ scale: 0.9, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 12, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Close × — defensive handler so the first click ALWAYS
                closes the dialog. Previously a Framer Motion exit-animation
                race could swallow the click on the first attempt; explicitly
                stopping propagation + preventing default ensures the
                onClose callback always fires synchronously. */}
            <button
              type="button"
              className="mm-close znk-tooltip"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose() }}
              aria-label="סגור"
            >
              <span className="znk-tip" data-placement="left" role="tooltip">סגור (Esc)</span>
              ×
            </button>

            {/* Header with badge ribbon */}
            <div className="mm-head">
              <div className="mm-badge">
                <span className="mm-badge-dot" />
                <b>{badge}</b>
              </div>
              <h2 className="mm-title">{headline}</h2>
              <p className="mm-sub">{subhead}</p>
              <p className="mm-purpose">{purposeLine}</p>
            </div>

            {/* The mountain SVG */}
            <div className="mm-stage">
              <svg viewBox="0 0 320 560" preserveAspectRatio="xMidYMid meet" className="mm-svg">
                <defs>
                  {/* Gradient fallback if the bg image fails to load. Same palette
                      as the painted mountain so the visual stays consistent. */}
                  <linearGradient id="mm-bg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={Z.navy} />
                    <stop offset="45%" stopColor={Z.purple} />
                    <stop offset="75%" stopColor={Z.pink} />
                    <stop offset="100%" stopColor={Z.yellowSoft} />
                  </linearGradient>
                  {/* Round-corner clip so the painted bg respects the rounded card */}
                  <clipPath id="mm-bg-clip">
                    <rect width="320" height="560" rx="18" />
                  </clipPath>
                </defs>

                {/* BG layer 1 — gradient fallback (always renders, hidden behind image when it loads) */}
                <rect width="320" height="560" fill="url(#mm-bg)" rx="18" />

                {/* BG layer 2 — Nano Banana 2 painted mountain.
                    `slice` = cover behavior; centered + cropped to fill the rounded frame. */}
                <image
                  href={asset('images/map/mountain-bg.webp')}
                  x="0" y="0" width="320" height="560"
                  preserveAspectRatio="xMidYMid slice"
                  clipPath="url(#mm-bg-clip)"
                />

                {/* Hard black frame */}
                <rect x="2.5" y="2.5" width="315" height="555" fill="none" stroke={Z.black} strokeWidth="5" rx="16" />

                {/* Trail path — thick chunky black dashed.
                    The dashed guide-line (full path) is always visible so
                    the student sees the whole mountain journey immediately.
                    The YELLOW proven-trail "draws" on entry via
                    pathLength + dashoffset animation — feels like it fills
                    in real-time from start to current progress. */}
                <path d={buildTrailPath()} stroke="rgba(255,255,255,0.38)" strokeWidth="4" strokeDasharray="6 5" fill="none" strokeLinecap="round" />
                <path
                  key={`proven-${entryKey}`}
                  d={buildProvenTrail(provenSet)}
                  stroke={Z.yellow}
                  strokeWidth="5"
                  fill="none"
                  strokeLinecap="round"
                  pathLength="1"
                  className="mm-proven-draw"
                />

                {/* Stage dots — chunky + solid + black outline.
                    Each bubble is keyed to `entryKey` so it REPLAYS its
                    pop-in animation every time the modal opens. Stagger is
                    done via CSS `animation-delay` scaling with stage.id. */}
                {STAGES.stages.map((stage) => {
                  const pos = getNodePos(stage.id)
                  const isProven = provenSet.has(stage.id)
                  const isCurrent = stage.id === currentStageId
                  const isLocked = !isProven && !isCurrent && stage.id > currentStageId
                  const band = BAND_COLORS[stage.band]
                  const r = isCurrent ? 11 : isProven ? 9 : 7
                  const fill = isProven ? Z.yellow : isCurrent ? band.fill : isLocked ? 'rgba(255,255,255,0.12)' : band.fill
                  return (
                    <g
                      key={`${entryKey}-${stage.id}`}
                      className="mm-node mm-node-stagger"
                      style={{
                        /* Slower + more theatrical: 70ms × 24 stages = ~1.7s
                           total stagger; the trail draw and climber sweep
                           continue past it for a layered crescendo. */
                        animationDelay: `${250 + stage.id * 70}ms`,
                        transformOrigin: `${pos.x}px ${pos.y}px`,
                      }}
                      onMouseEnter={() => setHoveredStage(stage.id)}
                      onMouseLeave={() => setHoveredStage(null)}
                      onFocus={() => setHoveredStage(stage.id)}
                      onBlur={() => setHoveredStage(null)}
                    >
                      {/* Invisible larger hitbox for hover */}
                      <circle cx={pos.x} cy={pos.y} r="14" fill="transparent" />
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={r}
                        fill={fill}
                        stroke={Z.black}
                        strokeWidth={isLocked ? 1.5 : 2.5}
                        opacity={isLocked ? 0.55 : 1}
                      >
                        {isCurrent && (
                          <animate attributeName="r" values={`${r};${r + 2};${r}`} dur="1.8s" repeatCount="indefinite" />
                        )}
                      </circle>
                      {isProven && (
                        <text x={pos.x} y={pos.y + 3} textAnchor="middle" fontSize="9" fill={Z.black} fontWeight="900">✓</text>
                      )}
                      {isLocked && stage.id === currentStageId + 1 && (
                        <text x={pos.x} y={pos.y + 3} textAnchor="middle" fontSize="8" fill={Z.white} fontWeight="900">🔒</text>
                      )}
                    </g>
                  )
                })}

                {/* Climber — slower, more cinematic sweep with overshoot bounce.
                    Duration bumped 1.4s → 2.6s + a 0.55s bounce-settle. The
                    triumph beat: a 1.6s pulsing halo + spark trail. */}
                <motion.g
                  animate={{
                    x: getNodePos(climberStage).x - 160,
                    y: getNodePos(climberStage).y - 280,
                  }}
                  initial={false}
                  transition={{
                    duration: 2.6,
                    ease: [0.16, 0.84, 0.32, 1.0],     /* dramatic ease-out */
                    type: 'tween',
                  }}
                >
                  <g transform="translate(160, 280)">
                    {/* Outer glow halo — pulses faster when climber arrives */}
                    <circle r="26" fill="none" stroke={Z.yellow} strokeWidth="2.5" opacity="0.4">
                      <animate attributeName="r" values="22;32;22" dur="2.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.4;0;0.4" dur="2.4s" repeatCount="indefinite" />
                    </circle>
                    {/* Mid pulsing ring */}
                    <circle r="20" fill="none" stroke={Z.pink} strokeWidth="2" opacity="0.55">
                      <animate attributeName="r" values="18;26;18" dur="2.0s" begin="0.3s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.55;0;0.55" dur="2.0s" begin="0.3s" repeatCount="indefinite" />
                    </circle>
                    {/* Solid character badge */}
                    <circle r="18" fill={Z.yellow} stroke={Z.black} strokeWidth="3.5" />
                    <text x="0" y="6.5" textAnchor="middle" fontSize="20">🧗</text>
                    {/* Spark sparks — 3 tiny stars rotating around */}
                    <g className="mm-climber-sparks" style={{ transformOrigin: '0 0' }}>
                      <text x="22" y="-14" textAnchor="middle" fontSize="11" fill={Z.yellow}>✦</text>
                      <text x="-22" y="-8" textAnchor="middle" fontSize="9" fill={Z.pink}>✦</text>
                      <text x="0" y="-26" textAnchor="middle" fontSize="10" fill={Z.yellow}>✦</text>
                    </g>
                  </g>
                </motion.g>

                {/* Summit flag at top — prize */}
                <g transform="translate(160, 28)">
                  <rect x="-30" y="-14" width="60" height="28" rx="6" fill={Z.yellow} stroke={Z.black} strokeWidth="2.5" />
                  <text x="0" y="5" textAnchor="middle" fontSize="11" fill={Z.black} fontWeight="900" fontFamily="Heebo">
                    פטור · 134
                  </text>
                  <text x="0" y="-22" textAnchor="middle" fontSize="22">🏆</text>
                </g>

                {/* Valley marker */}
                <g transform="translate(160, 536)">
                  <rect x="-36" y="-10" width="72" height="20" rx="4" fill={Z.cream} stroke={Z.black} strokeWidth="1.5" />
                  <text x="0" y="4" textAnchor="middle" fontSize="9" fill={Z.black} fontWeight="800" fontFamily="Heebo">
                    נקודת הזינוק
                  </text>
                </g>
              </svg>

              {/* Hover tooltip — stage description + cheer */}
              {hovered && (
                <div className={`mm-tip state-${hoveredState}`} role="tooltip">
                  <div className="mm-tip-head">
                    <span className="mm-tip-num">שלב {hovered.id}</span>
                    <span className="mm-tip-name">{hovered.name}</span>
                  </div>
                  <p className="mm-tip-sub">{hovered.subtitle}</p>
                  <p className="mm-tip-desc">{hovered.description}</p>
                  <p className="mm-tip-cheer">💬 {hovered.cheer}</p>
                  {hoveredState === 'locked' && (
                    <p className="mm-tip-locked">🔒 נעול — תשלים 85% מהשלב הנוכחי כדי לפתוח</p>
                  )}
                </div>
              )}
            </div>

            {/* Band legend — how to read the colors */}
            <div className="mm-legend">
              {(['foothills', 'ascent', 'climb', 'summit'] as const).map((b) => (
                <span key={b} className="mm-legend-item">
                  <i style={{ background: BAND_COLORS[b].fill, borderColor: Z.black }} />
                  {BAND_COLORS[b].label}
                </span>
              ))}
            </div>

            {/* Character + CTA row */}
            <div className="mm-foot">
              <img
                className="mm-char"
                src={asset('char-english.png')}
                alt=""
                aria-hidden="true"
              />
              <button className="mm-cta" onClick={onClose}>
                {ctaLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* Node positioning — stage 1 at valley bottom (y=490), stage 24 at the
   painted mountain peak (x=160, y=100).
   X oscillates 80 ↔ 240 in the middle stages, then DAMPS toward center so
   the trail converges to the summit instead of trailing off to one side. */
function getNodePos(stageId: number): { x: number; y: number } {
  const t = (stageId - 1) / 23
  const y = 490 - t * 390
  // Convergence damping — at t=0 full amplitude, at t=1 zero amplitude (centered on peak).
  // Exponent 2.2 keeps strong sway through mid-climb, then pulls in hard in the final stages.
  const damp = 1 - Math.pow(t, 2.2)
  const x = 160 + Math.sin(t * Math.PI * 3.2) * 68 * damp
  return { x, y }
}

function buildTrailPath(): string {
  const pts = STAGES.stages.map((s) => getNodePos(s.id))
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    const mx = (prev.x + curr.x) / 2
    const my = (prev.y + curr.y) / 2
    d += ` Q ${prev.x} ${prev.y} ${mx} ${my}`
  }
  d += ` T ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`
  return d
}

/* Draw the proven-trail in yellow — only between the proven stages. */
function buildProvenTrail(proven: Set<number>): string {
  if (proven.size === 0) return ''
  const ids = STAGES.stages.map((s) => s.id).filter((id) => proven.has(id))
  if (ids.length < 2) return ''
  const pts = ids.map(getNodePos)
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y}`
  }
  return d
}

const FONT_DISPLAY = "'Heebo', 'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif"
const hs = (n = 4, color: string = Z.black) => `${n}px ${n}px 0 0 ${color}`

const cssBlock = `
.mm-backdrop{
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(13, 41, 75, 0.72);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.mm-card{
  position: relative;
  width: 100%; max-width: 420px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: ${Z.bg};
  border: 3px solid ${Z.black};
  border-radius: 26px;
  box-shadow: ${hs(8, Z.pink)};
  padding: 18px 18px 18px;
  font-family: ${FONT_DISPLAY};
  color: ${Z.black};
}

/* Close button */
.mm-close{
  position: absolute; top: 12px; left: 12px;
  z-index: 3;
  width: 36px; height: 36px; border-radius: 50%;
  background: ${Z.white}; color: ${Z.black};
  border: 2.5px solid ${Z.black};
  box-shadow: ${hs(2)};
  font-size: 20px; font-weight: 900; line-height: 1;
  cursor: pointer;
  transition: transform .15s cubic-bezier(0.23, 1, 0.32, 1), box-shadow .15s cubic-bezier(0.23, 1, 0.32, 1);
}
.mm-close:hover{ transform: translate(-1px,-1px); box-shadow: ${hs(3, Z.pink)}; }
.mm-close:active{ transform: translate(1px,1px); box-shadow: ${hs(1)}; }

/* Header */
.mm-head{ text-align: center; margin-bottom: 14px; padding: 0 8px; }
.mm-badge{
  display: inline-flex; align-items: center; gap: 8px;
  padding: 5px 12px; margin-bottom: 10px;
  background: ${Z.black}; color: ${Z.yellow};
  border: 2px solid ${Z.black}; border-radius: 999px;
  box-shadow: ${hs(2, Z.pink)};
  font-family: ${FONT_DISPLAY};
}
.mm-badge-dot{
  width: 8px; height: 8px; border-radius: 50%;
  background: ${Z.yellow};
  box-shadow: 0 0 10px ${Z.yellow};
  animation: mmDot 1.6s ease-in-out infinite;
}
@keyframes mmDot { 0%,100% { opacity: 0.85; } 50% { opacity: 1; transform: scale(1.25); } }
.mm-badge b{
  font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
}
.mm-title{
  font-family: ${FONT_DISPLAY};
  font-weight: 900;
  font-size: clamp(22px, 4.6vw, 28px);
  letter-spacing: -0.02em;
  color: ${Z.black};
  line-height: 1.1; margin-bottom: 6px;
}
.mm-sub{
  font-size: 13px; font-weight: 700;
  color: ${Z.navy};
  line-height: 1.5;
  margin-bottom: 4px;
}
.mm-purpose{
  font-size: 12px; font-weight: 600;
  color: ${Z.navy}; opacity: 0.75;
  font-style: italic;
  line-height: 1.5;
}

/* Stage visual */
.mm-stage{ position: relative; margin-bottom: 14px; }
.mm-svg{ width: 100%; display: block; }
.mm-node{ transition: transform .15s cubic-bezier(0.23, 1, 0.32, 1); }
.mm-node:hover circle[fill]:not([fill="transparent"]){
  filter: drop-shadow(0 0 6px ${Z.yellow});
}

/* Hover tooltip */
.mm-tip{
  position: absolute;
  bottom: 8px; left: 8px; right: 8px;
  background: ${Z.white};
  border: 2.5px solid ${Z.black};
  border-radius: 14px;
  box-shadow: ${hs(3, Z.pink)};
  padding: 10px 12px;
  z-index: 2;
  max-width: calc(100% - 16px);
  pointer-events: none;
  animation: mmTipIn .18s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes mmTipIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.mm-tip.state-proven{ background: ${Z.correctSoft}; border-color: ${Z.correct}; box-shadow: ${hs(3, Z.correct)}; }
.mm-tip.state-current{ background: ${Z.yellowSoft}; box-shadow: ${hs(3, Z.pink)}; }
.mm-tip.state-locked{ background: ${Z.cream}; opacity: 0.95; }
.mm-tip-head{
  display: flex; align-items: baseline; gap: 8px;
  margin-bottom: 4px;
}
.mm-tip-num{
  font-family: ${FONT_DISPLAY}; font-weight: 900;
  font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
  color: ${Z.pink};
  padding: 2px 8px; border-radius: 999px;
  background: ${Z.pinkSoft};
  border: 1.5px solid ${Z.black};
}
.mm-tip-name{
  font-family: ${FONT_DISPLAY}; font-weight: 900; font-size: 14px;
  color: ${Z.black}; letter-spacing: -0.01em;
}
.mm-tip-sub{
  font-size: 12px; font-weight: 700; color: ${Z.navy};
  margin-bottom: 4px;
}
.mm-tip-desc{
  font-size: 11.5px; font-weight: 500; color: ${Z.navy}; opacity: 0.85;
  line-height: 1.5; margin-bottom: 4px;
}
.mm-tip-cheer{
  font-size: 11.5px; font-weight: 700; color: ${Z.pink};
  font-style: italic;
  line-height: 1.4;
}
.mm-tip-locked{
  font-size: 10.5px; font-weight: 700; color: ${Z.navy};
  margin-top: 4px; padding-top: 4px;
  border-top: 1.5px dashed rgba(13,41,75,0.18);
}

/* Legend */
.mm-legend{
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 14px;
  padding: 10px 12px;
  background: ${Z.cream};
  border: 2px solid ${Z.black};
  border-radius: 12px;
  box-shadow: ${hs(2)};
}
.mm-legend-item{
  display: inline-flex; align-items: center; gap: 6px;
  font-family: ${FONT_DISPLAY};
  font-size: 10.5px; font-weight: 800;
  color: ${Z.navy};
  letter-spacing: 0.02em;
}
.mm-legend-item i{
  width: 12px; height: 12px; display: inline-block;
  border-radius: 50%;
  border: 1.5px solid ${Z.black};
  flex-shrink: 0;
}

/* Character + CTA row */
.mm-foot{
  position: relative;
  display: flex; align-items: flex-end; gap: 10px;
}
.mm-char{
  width: 80px; height: auto;
  margin-bottom: -6px; margin-inline-start: -8px;
  filter: drop-shadow(3px 3px 0 ${Z.black});
  flex-shrink: 0;
  animation: mmCharFloat 3s ease-in-out infinite;
}
@keyframes mmCharFloat {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-5px) rotate(2deg); }
}
.mm-cta{
  flex: 1;
  padding: 14px 20px;
  background: ${Z.pink}; color: ${Z.white};
  border: 3px solid ${Z.black}; border-radius: 14px;
  font-family: ${FONT_DISPLAY}; font-weight: 900; font-size: 14.5px;
  letter-spacing: -0.01em;
  cursor: pointer;
  box-shadow: ${hs(5, Z.navy)};
  transition: transform .15s cubic-bezier(0.23, 1, 0.32, 1), box-shadow .15s cubic-bezier(0.23, 1, 0.32, 1);
}
.mm-cta:hover{ transform: translate(-2px,-2px); box-shadow: ${hs(7, Z.navy)}; }
.mm-cta:active{ transform: translate(2px,2px); box-shadow: ${hs(2, Z.navy)}; }

/* ───────────────────────────────────────────────────────────────────
   MOBILE (≤ 640px) — full-screen sheet pattern with a BIG, obvious
   close button. The previous modal-card pattern kept a 320×560 SVG +
   header + legend + char + CTA all visible at once, which on a
   ~667-tall iPhone SE meant the close button got squashed near the
   top corner and the user had to scroll the SVG itself. Now the modal
   becomes a slide-up sheet that fills the viewport, the close button
   is 48×48 and pinned top-right with a strong contrast halo, and the
   SVG height shrinks so the CTA stays in the thumb zone.
   ─────────────────────────────────────────────────────────────────── */
@media (max-width: 640px){
  .mm-backdrop{
    padding: 0;
    align-items: stretch;
    justify-content: stretch;
  }
  .mm-card{
    max-width: 100%;
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
    border-left: 0; border-right: 0;
    border-top: 0;
    box-shadow: none;
    padding: max(20px, env(safe-area-inset-top, 16px)) 14px max(20px, env(safe-area-inset-bottom, 16px));
    overflow-y: auto;
    /* Slide-up sheet feel handled by Framer parent transition. */
  }
  /* Close button — bigger, more obvious, top-right with halo */
  .mm-close{
    top: max(14px, env(safe-area-inset-top, 14px));
    left: 14px;
    width: 44px; height: 44px;
    font-size: 26px;
    background: ${Z.white};
    border-width: 3px;
    box-shadow: ${hs(3, Z.pink)};
    z-index: 5;
  }
  .mm-title{ font-size: 19px; line-height: 1.15; }
  .mm-sub{ font-size: 12.5px; }
  .mm-purpose{ font-size: 11.5px; }
  .mm-tip-name{ font-size: 13px; }
  .mm-legend{ padding: 8px 10px; gap: 4px; }
  .mm-legend-item{ font-size: 9.5px; }
  .mm-char{ width: 56px; }
  .mm-cta{ font-size: 14px; padding: 14px 18px; min-height: 50px; }
  .mm-stage{ margin-bottom: 12px; }
  /* Cap the SVG height so the CTA stays in the thumb-zone bottom 25% */
  .mm-svg{ max-height: 56vh; }
}

@media (max-width: 380px){
  .mm-title{ font-size: 17px; }
  .mm-svg{ max-height: 50vh; }
  .mm-legend{ display: none; }   /* not essential on smallest screens */
}

/* ─── Entry animations: stagger bubbles + draw the proven trail ───────
   Slowed down for more cinematic build-up:
     - Node pop: 0.5s → 0.65s with stronger overshoot
     - Trail draw: 1.4s → 2.3s, starts slightly later (350ms) so the
       student sees a couple of bubbles pop first, then the line draws
       through them — feels like the path is being TRACED in real time.
     - Climber sparks pulse on a slow rotation. */
.mm-node-stagger{
  opacity: 0;
  transform: scale(0.4);
  animation: mmNodePop 0.65s cubic-bezier(0.34, 1.65, 0.45, 1) forwards;
}
@keyframes mmNodePop {
  0%   { opacity: 0; transform: scale(0.35); }
  55%  { opacity: 1; transform: scale(1.18); }
  78%  { transform: scale(0.94); }
  100% { opacity: 1; transform: scale(1); }
}
.mm-proven-draw{
  stroke-dasharray: 1 1;
  stroke-dashoffset: 1;
  animation: mmTrailDraw 2.3s cubic-bezier(0.16, 0.84, 0.32, 1.0) 0.35s forwards;
  filter: drop-shadow(0 0 6px ${Z.yellow});
}
@keyframes mmTrailDraw{
  to { stroke-dashoffset: 0; }
}
/* Climber sparks — slow rotation + breathe */
.mm-climber-sparks{
  animation: mmSparkSpin 6s linear infinite, mmSparkBreathe 2.4s ease-in-out infinite;
  transform-box: fill-box;
}
@keyframes mmSparkSpin{
  from{ transform: rotate(0deg); }
  to  { transform: rotate(360deg); }
}
@keyframes mmSparkBreathe{
  0%,100%{ opacity: 0.7; }
  50%    { opacity: 1; }
}

@media (prefers-reduced-motion: reduce){
  .mm-char, .mm-badge-dot, .mm-node circle animate,
  .mm-node-stagger, .mm-proven-draw, .mm-climber-sparks{
    animation: none !important; opacity: 1; transform: none; stroke-dashoffset: 0;
  }
}
`
