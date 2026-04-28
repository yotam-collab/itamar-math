import { useNavigate } from 'react-router-dom'
import { useVocabStore } from '../../stores/vocabStore'
import { useGameStatsStore } from '../../stores/gameStatsStore'
import { useGamificationStore } from '../../stores/gamificationStore'
import { useTTSSettingsStore } from '../../stores/ttsSettingsStore'
import { useCoachStore } from '../../stores/coachStore'
import { asset } from '../../utils/assetUrl'
import { g } from '../../utils/gender'
import { useRef, useEffect } from 'react'
import {
  BookOpenText,
  Cards,
  Target,
  Lightning,
  Books,
  MagnifyingGlass,
  SpeakerHigh,
  Brain,
  Barbell,
  Lock,
  Check,
  CalendarCheck,
  Mountains,
  CaretRight,
} from '@phosphor-icons/react'
import type { GameId } from './games/types'
import type { Mission } from '../../services/mockCoachData'
import { MapMoment } from './stages/MapMoment'
import { useMapMoment } from './stages/useMapMoment'
import { MiniMap } from './stages/MiniMap'
import { STAGES_BY_ID } from './stages/stageHelpers'

/* ================================================================== */
/*  VocabHome – Claymorphism Bento Grid                               */
/* ================================================================== */

export function VocabHome() {
  const navigate = useNavigate()
  const vocabStore = useVocabStore()
  const { words } = vocabStore
  const gameStats = useGameStatsStore()
  // Streak data still tracked in store (used for daily-mission scoring + cross-app analytics);
  // we no longer surface a streak tile here — the Stage/Map tile took its slot.

  const totalWords = words.length
  const units = Array.from(new Set(words.map((w) => w.unit))).sort(
    (a, b) => a - b,
  )
  const studentWords = useVocabStore.getState().studentWords
  const masteredCount = Object.values(studentWords).filter(
    (sw) => sw.status === 'mastered',
  ).length
  const vocabPct =
    totalWords > 0 ? Math.round((masteredCount / totalWords) * 100) : 0

  const { played, target } = gameStats.getDailyProgress()
  const dailyPct = Math.min(100, Math.round((played / target) * 100))

  /* Map Moment — auto-shows the mountain once on first practice of the day,
     and can also be opened manually from the Stage tile (replaces streak tile). */
  const {
    moment, closeMoment, triggerDailyFirstIfNeeded,
    openManual: openMap,
    currentStageId, provenStageIds,
  } = useMapMoment()
  const provenCount = provenStageIds.length
  const currentStage = STAGES_BY_ID[currentStageId]
  useEffect(() => {
    // Fire on mount — internal guard ensures once-per-day.
    triggerDailyFirstIfNeeded()
  }, [triggerDailyFirstIfNeeded])

  const go = (gameId: GameId) => navigate(`/vocabulary/games/${gameId}`)

  /* ────────────────────────────────────────────────────────────────
     Daily vocab missions — pulled from coachStore; if empty,
     triggers generation so the student always sees today's plan
     as soon as they land here.
     ──────────────────────────────────────────────────────────────── */
  const dailyPlan = useCoachStore((s) => s.dailyPlan)
  const generateDailyMissions = useGamificationStore((s) => s.generateDailyMissions)
  useEffect(() => { generateDailyMissions() }, [generateDailyMissions])

  const VOCAB_MISSION_TYPES = new Set([
    'vocab_flashcards', 'vocab_adaptive', 'vocab_learn',
    'vocab_gravity', 'vocab_practice',
  ])
  const MISSION_EMOJI: Record<string, string> = {
    vocab_flashcards: '📇',
    vocab_adaptive: '🧠',
    vocab_learn: '📚',
    vocab_gravity: '⚡',
    vocab_practice: '🎯',
  }
  const MISSION_GRADIENT: Record<string, string> = {
    vocab_flashcards: 'linear-gradient(135deg, #EE2B73, #FF6B9D)',
    vocab_adaptive:   'linear-gradient(135deg, #F59E0B, #F97316)',
    vocab_learn:      'linear-gradient(135deg, #E67E22, #F39C12)',
    vocab_gravity:    'linear-gradient(135deg, #DC2626, #EF4444)',
    vocab_practice:   'linear-gradient(135deg, #F59E0B, #F97316)',
  }

  const vocabMissions = (dailyPlan?.missions || []).filter((m) =>
    VOCAB_MISSION_TYPES.has(m.type),
  )
  const vocabDone = vocabMissions.filter((m) => m.status === 'completed').length
  const vocabNext = vocabMissions.find(
    (m) => m.status !== 'completed' && m.status !== 'locked',
  )
  const vocabTotalMinutes = vocabMissions.reduce(
    (s, m) => s + (m.estimatedMinutes || 0), 0,
  )
  const vocabProgressPct =
    vocabMissions.length > 0 ? Math.round((vocabDone / vocabMissions.length) * 100) : 0

  const startMission = (mission: Mission) => {
    if (mission.status === 'locked' || mission.status === 'completed') return
    try { localStorage.setItem('znk-active-mission', mission.id) } catch { /* ok */ }
    const url = mission.routeParams && Object.keys(mission.routeParams).length > 0
      ? `${mission.route}?${new URLSearchParams(mission.routeParams as Record<string, string>).toString()}`
      : mission.route
    navigate(url)
  }

  const bentoRef = useRef<HTMLDivElement>(null)

  // JS entrance animations — matching mockup exactly
  useEffect(() => {
    const bento = bentoRef.current
    if (!bento) return
    const cells = bento.querySelectorAll<HTMLElement>('.bento-cell')

    const anims = [
      { type: 'fadeUp', dur: 700 },    // hero
      { type: 'popIn', dur: 500 },     // streak
      { type: 'popIn', dur: 500 },     // progress
      { type: 'fadeUp', dur: 650 },    // vocab-missions (NEW)
      { type: 'slideRight', dur: 600 }, // practice1
      { type: 'slideRight', dur: 600 }, // practice2
      { type: 'slideLeft', dur: 600 },  // practice3
      { type: 'slideLeft', dur: 600 },  // practice4
      { type: 'fadeUp', dur: 500 },     // nav1
      { type: 'fadeUp', dur: 500 },     // nav2
      { type: 'fadeUp', dur: 500 },     // tts
    ]

    const timeouts: ReturnType<typeof setTimeout>[] = []

    cells.forEach((cell, i) => {
      cell.style.opacity = '0'
      cell.style.transform = 'translateY(30px)'

      const a = anims[i] || { type: 'fadeUp', dur: 500 }
      if (a.type === 'slideRight') cell.style.transform = 'translateX(40px)'
      if (a.type === 'slideLeft') cell.style.transform = 'translateX(-40px)'
      if (a.type === 'popIn') cell.style.transform = 'scale(0.8)'

      const t1 = setTimeout(() => {
        cell.style.transition = `opacity ${a.dur}ms cubic-bezier(0.22,1,0.36,1), transform ${a.dur}ms cubic-bezier(0.34,1.56,0.64,1)`
        cell.style.opacity = '1'
        cell.style.transform = 'translateY(0) translateX(0) scale(1)'

        const t2 = setTimeout(() => {
          cell.style.transition = ''
          cell.style.transform = ''
          cell.style.opacity = ''
        }, a.dur + 50)
        timeouts.push(t2)
      }, i * 100)
      timeouts.push(t1)
    })

    // Add clay-breathe to progress after entrance
    const t3 = setTimeout(() => {
      bento.querySelector('.cell-progress')?.classList.add('clay-breathe')
    }, 1500)
    timeouts.push(t3)

    return () => timeouts.forEach(clearTimeout)
  }, [])

  /* ---------------------------------------------------------------- */

  return (
    <div dir="rtl">
      <style>{vocabHomeCSS}</style>

      {/* Map Moment — contextual overlay; the hook decides when. */}
      <MapMoment
        open={moment.open}
        reason={moment.reason}
        provenStageId={moment.provenStageId}
        onClose={closeMoment}
      />

      {/* Background Blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      {/* Main Bento Layout */}
      <div style={{ position: 'relative', zIndex: 10, maxWidth: 1400, margin: '0 auto', padding: '24px 20px' }} className="vh-main">
        <div className="mega-bento" ref={bentoRef}>

          {/* ══════════════════════════════════════════════ */}
          {/*  HERO — col-span-8, row-span-4               */}
          {/* ══════════════════════════════════════════════ */}
          <div
            className="bento-cell cell-hero shadow-clay-hero"
            /* border-radius matched to other gateway heroes (32px) so the
               crown chip sitting near the top-right corner doesn't get
               clipped by an over-aggressive 40px curve. */
            style={{
              borderRadius: 32,
              overflow: 'hidden',
              padding: '36px 36px',
              background: 'linear-gradient(150deg, #0d294b 0%, #4F4780 40%, #EE2B73 100%)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            {/* Glow effects */}
            <div style={{ position: 'absolute', top: -40, left: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(238,43,115,0.25)', filter: 'blur(60px)' }} />
            <div style={{ position: 'absolute', bottom: -20, right: '30%', width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,230,0,0.15)', filter: 'blur(50px)' }} />
            <div style={{ position: 'absolute', top: '30%', right: -20, width: 180, height: 180, borderRadius: '50%', background: 'rgba(108,99,255,0.15)', filter: 'blur(50px)' }} />

            <div style={{ position: 'relative', zIndex: 2, maxWidth: '65%' }}>
              {/* Section crown — matches /reading, /exam, /exam/full. Gives
                  every gateway the same "you are in zone X" identifier. */}
              <span className="vh-section-crown" aria-label="אזור אוצר מילים">
                <span className="vh-section-crown-ico" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    <path d="M8 7h8" />
                    <path d="M8 11h6" />
                  </svg>
                </span>
                <span className="vh-section-crown-text">
                  <small>אמירנט · אזור תרגול</small>
                  <b>אוצר מילים לאמירנט</b>
                </span>
              </span>
              <h1
                className="font-heading"
                /* Gateway-page H1 — accent shimmer matches /exam's pattern
                   (highlighted phrase only, not whole headline). Same
                   `.znk-h1-accent` class used on /journey, defined globally
                   in src/index.css. Gender split: שתזכור (m) / שתזכרי (f). */
                style={{ fontSize: 'clamp(30px, 4.8vw, 52px)', fontWeight: 900, color: 'white', lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 10 }}
              >
                <span className="znk-h1-accent">כל מילה</span> {g('שתזכור', 'שתזכרי')} =<br />
                מילה פחות בבחינה.
              </h1>
              <p
                /* Unified gateway lede — 15 / 1.55 on every colored-hero page.
                   "יאללה נזנק!" is 1pl inclusive ("let's launch") — works for
                   both genders. The previous "נזנקת" form was 2nd-person
                   feminine ("you launched"), grammatically wrong here. */
                style={{ fontSize: 15, lineHeight: 1.55, color: 'rgba(255,255,255,0.72)', marginBottom: 24 }}
              >
                <span style={{ color: 'var(--yellow)', fontWeight: 700 }}>{totalWords.toLocaleString()}</span> מילים ·{' '}
                <span style={{ color: 'var(--yellow)', fontWeight: 700 }}>{units.length}</span> יחידות — יאללה נזנק!
              </p>

              {/* Stats row inside hero */}
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="hero-stat" style={{ textAlign: 'center', padding: '12px 20px', borderRadius: 20, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', flex: 1, cursor: 'help', position: 'relative' }}>
                  <span className="font-heading" style={{ fontSize: 26, fontWeight: 900, color: 'white', display: 'block' }}>{vocabPct}%</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>אחוז ידע</span>
                  <div className="hero-tip">💪 ככל {g('שתתרגל', 'שתתרגלי')} יותר, אחוז הידע יעלה!</div>
                </div>
                <div className="hero-stat" style={{ textAlign: 'center', padding: '12px 20px', borderRadius: 20, background: 'rgba(255,230,0,0.12)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,230,0,0.15)', flex: 1, cursor: 'help', position: 'relative' }}>
                  <span className="font-heading" style={{ fontSize: 26, fontWeight: 900, color: 'var(--yellow)', display: 'block' }}>{played}<span style={{ fontSize: 16, color: 'rgba(255,230,0,0.5)' }}>/{target}</span></span>
                  <span style={{ fontSize: 10, color: 'rgba(255,230,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>יעד יומי</span>
                  <div className="hero-tip">🎯 {target} תרגולים ביום זה המתכון לזנוק!</div>
                </div>
                <div className="hero-stat" style={{ textAlign: 'center', padding: '12px 20px', borderRadius: 20, background: 'rgba(255,230,0,0.12)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,230,0,0.15)', flex: 1, cursor: 'help', position: 'relative' }}>
                  <span className="font-heading" style={{ fontSize: 26, fontWeight: 900, color: 'var(--yellow)', display: 'block' }}>{masteredCount}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,230,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>מילים שלמדת</span>
                  <div className="hero-tip">⭐ כל מילה שנכנסה לזיכרון — זה ניצחון!</div>
                </div>
              </div>
            </div>

            {/* Character floating */}
            <img
              src={asset('char-english.png')}
              alt=""
              className="clay-float-alt"
              style={{ position: 'absolute', bottom: -15, left: 20, width: 300, height: 'auto', opacity: 0.9, pointerEvents: 'none', zIndex: 1, filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.25))', animationDelay: '-1s' }}
            />
          </div>


          {/* ══════════════════════════════════════════════ */}
          {/*  WEAK WORDS — col-span-4, row-span-2           */}
          {/*  (replaces former duplicate-streak tile)       */}
          {/*  Action-driving: count of weak words →         */}
          {/*  click to rescueMode                           */}
          {/* ══════════════════════════════════════════════ */}
          <div
            className="bento-cell cell-streak shadow-clay"
            onClick={() => {
              if (vocabStore.getWeakWords().length > 0) {
                navigate('/vocabulary/games/rescueMode')
              }
            }}
            style={{
              borderRadius: 32,
              background: 'linear-gradient(135deg, #FFF5EE, #FFE4D6, #FFDBC8)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
              cursor: vocabStore.getWeakWords().length > 0 ? 'pointer' : 'default',
              position: 'relative',
            }}
          >
            <div className="znk-tooltip tip-pink" style={{ bottom: 'auto', top: 'calc(100% + 12px)' }}>
              <span className="tip-emoji">💪</span>לחץ כדי לתרגל את המילים שדורשות חיזוק
            </div>
            <div
              className="shadow-clay-sm"
              style={{
                width: 64, height: 64, borderRadius: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #FF6B35, #E8451E)',
                marginBottom: 2,
              }}
            >
              <Barbell weight="fill" size={36} color="#FFFFFF" />
            </div>
            <span
              className="font-heading"
              style={{
                fontSize: '3rem', fontWeight: 900,
                background: 'linear-gradient(135deg, #FF6B35, #E8451E)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                lineHeight: 1,
              }}
            >
              {vocabStore.getWeakWords().length}
            </span>
            <span className="font-heading" style={{ fontSize: 13, fontWeight: 700, color: '#E8451E', opacity: 0.75, textAlign: 'center' }}>
              {vocabStore.getWeakWords().length > 0 ? 'מילים לחיזוק · לחץ לתרגול' : 'אין מילים לחיזוק 🎯'}
            </span>
          </div>


          {/* ══════════════════════════════════════════════ */}
          {/*  STAGE / MAP — col-span-4, row-span-2          */}
          {/*  Replaces former PRACTICE STREAK tile.         */}
          {/*  Click anywhere → opens MapMoment overlay.     */}
          {/* ══════════════════════════════════════════════ */}
          <button
            type="button"
            className="bento-cell cell-progress shadow-clay-pink stage-tile"
            onClick={openMap}
            aria-label={`המסע שלך — שלב ${currentStageId} מתוך 24. לחץ לפתיחת המפה`}
            style={{
              borderRadius: 32,
              /* Calmer gradient (no bright pink/yellow mid-stop) so the tile
                 reads as a SECONDARY info element. The primary CTA — the
                 yellow "יאללה נתחיל" button — now wins the eye-first race. */
              background: 'linear-gradient(160deg, #1a1333 0%, #2d2250 45%, #3d2f5e 100%)',
              padding: '26px 28px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              /* Soft border in neutral navy; no yellow accent fighting the CTA */
              border: '1.5px solid rgba(255,255,255,0.08)',
              /* Flat claymorphic shadow only — dropped the pink halo/glow */
              boxShadow: '10px 10px 22px rgba(13,41,75,0.16), -6px -6px 16px rgba(255,255,255,0.6)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: 180,
              fontFamily: 'inherit',
              textAlign: 'right',
              direction: 'rtl',
              color: 'white',
              transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease',
            }}
          >
            <div className="znk-tooltip tip-pink" style={{ bottom: 'auto', top: 'calc(100% + 12px)' }}>
              <span className="tip-emoji">⛰️</span>לחץ לפתיחת המפה — תראה בדיוק איפה אתה במסע לפטור
            </div>

            {/* Subtle aurora — dropped the bright pink/yellow blobs that
                were making this tile compete with the primary CTA. */}
            <div style={{ position: 'absolute', top: -40, left: -20, width: 180, height: 180, borderRadius: '50%', background: 'rgba(108,99,255,0.10)', filter: 'blur(50px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -40, right: -20, width: 200, height: 200, borderRadius: '50%', background: 'rgba(108,99,255,0.08)', filter: 'blur(50px)', pointerEvents: 'none' }} />

            {/* Header */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, zIndex: 2 }}>
              <div
                className="shadow-clay-sm"
                style={{
                  width: 56, height: 56, borderRadius: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  /* Purple-indigo instead of yellow — reserves yellow for the
                     primary CTA. Mountain silhouette reads clearly against
                     the soft gradient. */
                  background: 'linear-gradient(135deg, #4F4780 0%, #6C63FF 100%)',
                  flexShrink: 0,
                  border: '1.5px solid rgba(255,255,255,0.18)',
                  boxShadow: '0 3px 10px rgba(13,41,75,0.35)',
                }}
              >
                <Mountains weight="fill" size={32} color="rgba(255,255,255,0.95)" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span
                  className="font-heading"
                  style={{
                    fontSize: 22, fontWeight: 900,
                    color: 'white',
                    display: 'block',
                    textShadow: '0 2px 8px rgba(0,0,0,0.35)',
                    lineHeight: 1.05,
                  }}
                >
                  המסע שלך
                </span>
                <span
                  style={{
                    fontSize: 12, fontWeight: 700,
                    color: 'rgba(255,255,255,0.92)',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentStage?.name || 'יוצאים לדרך'}
                </span>
              </div>
            </div>

            {/* Mini-map mountain — a persistent orientation widget that
                replaces the old daily-first modal trigger. Shows the
                same wavy trail shape as the full MapMoment, scaled to
                the tile, with the climber pinned at the current stage.
                Tap anywhere on the tile (this whole element is a button)
                still opens the full MapMoment overlay. */}
            <div style={{ position: 'relative', zIndex: 2, marginTop: 6, marginBottom: 4 }}>
              <MiniMap
                currentStageId={currentStageId}
                provenStageIds={provenStageIds}
                height={120}
              />
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span
                  className="font-heading"
                  style={{
                    fontSize: '2.2rem', fontWeight: 900,
                    color: '#fff',
                    textShadow: '0 2px 14px rgba(0,0,0,0.4)',
                    lineHeight: 1,
                    letterSpacing: '-0.04em',
                  }}
                >
                  {currentStageId}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
                  / 24 שלבים
                </span>
              </div>
              <div
                aria-label={`${provenCount} מתוך 24 שלבים ${g('מאחוריך', 'מאחורייך')}`}
                style={{
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: '#FFE600',
                  background: 'rgba(255,230,0,0.12)',
                  border: '1.5px solid rgba(255,230,0,0.35)',
                  padding: '4px 10px', borderRadius: 999,
                }}
              >
                {provenCount} כבושים
              </div>
            </div>

            {/* Footer: stage cheer + open-map CTA */}
            <div
              style={{
                position: 'relative',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 11, fontWeight: 700,
                color: 'rgba(255,255,255,0.92)',
                paddingTop: 10,
                borderTop: '1.5px dashed rgba(255,255,255,0.32)',
                marginTop: 8,
                zIndex: 2,
                gap: 8,
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  opacity: 0.92,
                }}
              >
                {currentStage?.cheer || 'יאללה לפסגה'}
              </span>
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  /* White instead of yellow — reserves yellow for the
                     page's primary CTA */
                  color: 'rgba(255,255,255,0.9)',
                  fontWeight: 900,
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                פתח מפה
                <CaretRight weight="bold" size={12} />
              </span>
            </div>
          </button>


          {/* ══════════════════════════════════════════════ */}
          {/*  VOCAB MISSIONS STRIP — col-span-12            */}
          {/*  Daily vocab-scoped missions with clickable     */}
          {/*  pills and primary CTA to kick into the next   */}
          {/*  open mission.                                 */}
          {/* ══════════════════════════════════════════════ */}
          {vocabMissions.length > 0 && (
            <div
              className="bento-cell cell-vocab-missions shadow-clay"
              /* Matched to the home-page .dash-track daily-plan card —
                 dark purple/pink gradient + radial glows = one visual
                 language for "today's missions" across the whole app. */
              style={{
                borderRadius: 32,
                padding: '22px 26px',
                background: `
                  radial-gradient(circle at 88% 10%, rgba(255,230,0,0.18), transparent 45%),
                  radial-gradient(circle at 12% 88%, rgba(238,43,115,0.22), transparent 50%),
                  linear-gradient(135deg, #1a0b3a 0%, #3a1a6b 45%, #7c3aed 95%)
                `,
                boxShadow:
                  '0 14px 36px -12px rgba(91,33,182,0.45), 0 4px 12px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
                color: '#fff',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Ambient glow blobs — echoing .dash-track-blob-pink / blob-yellow */}
              <div style={{ position: 'absolute', top: -60, left: -40, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(238,43,115,0.55), transparent 70%)', filter: 'blur(40px)', opacity: 0.55, pointerEvents: 'none', animation: 'vmBlobFloat 9s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', bottom: -80, right: '10%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,230,0,0.35), transparent 70%)', filter: 'blur(40px)', opacity: 0.55, pointerEvents: 'none', animation: 'vmBlobFloat 11s ease-in-out infinite reverse' }} />

              {/* Header row */}
              <div className="vm-header" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    className="shadow-clay-sm"
                    style={{
                      width: 48, height: 48, borderRadius: 16,
                      background: 'linear-gradient(135deg, #EE2B73, #FF6B9D)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CalendarCheck weight="fill" size={26} color="white" />
                  </div>
                  <div>
                    <h3 className="font-heading" style={{ fontSize: 19, fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 3 }}>
                      המשימות היומיות שלך באוצר מילים
                    </h3>
                    <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
                      <b style={{ color: '#FFE600', fontSize: 13 }}>{vocabDone}</b>/{vocabMissions.length} הושלמו · ~{vocabTotalMinutes} דק׳ סה״כ
                    </p>
                  </div>
                </div>

                {/* Progress bar — compact */}
                <div style={{ minWidth: 160, flex: '0 1 260px' }}>
                  <div style={{ height: 10, borderRadius: 999, background: 'rgba(108,99,255,0.12)', boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.06)', overflow: 'hidden', position: 'relative' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${vocabProgressPct}%`,
                        background: 'linear-gradient(90deg, #FFE600, #EE2B73)',
                        borderRadius: 999,
                        transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)',
                        boxShadow: '0 0 8px rgba(238,43,115,0.4)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Missions body — pills row + CTA */}
              <div className="vm-body" style={{ position: 'relative', display: 'flex', alignItems: 'stretch', gap: 14, flexWrap: 'wrap' }}>
                {/* Pills row */}
                <div
                  className="vm-pills-row"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex', gap: 10,
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'thin',
                    paddingBottom: 4,
                  }}
                >
                  {vocabMissions.map((m) => {
                    const isDone = m.status === 'completed'
                    const isLocked = m.status === 'locked'
                    const isNext = !isDone && !isLocked && vocabNext?.id === m.id
                    const emoji = MISSION_EMOJI[m.type] || '✨'
                    const grad = MISSION_GRADIENT[m.type] || 'linear-gradient(135deg,#EE2B73,#FF6B9D)'
                    return (
                      <button
                        key={m.id}
                        className={`vm-pill ${isNext ? 'vm-pill-next' : ''}`}
                        onClick={() => startMission(m)}
                        disabled={isDone || isLocked}
                        aria-label={`${m.title} — ${isDone ? 'הושלם' : isLocked ? 'נעול' : `~${m.estimatedMinutes} דקות`}`}
                        style={{
                          flexShrink: 0,
                          minWidth: 180,
                          maxWidth: 240,
                          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6,
                          padding: '12px 14px',
                          borderRadius: 18,
                          border: 'none',
                          background: isDone
                            ? 'linear-gradient(135deg, #F0FDF4, #DCFCE7)'
                            : isLocked
                              ? 'linear-gradient(135deg, #F3F4F6, #E5E7EB)'
                              : 'white',
                          boxShadow: isDone
                            ? '2px 2px 6px rgba(16,185,129,0.2), -2px -2px 6px rgba(255,255,255,0.8)'
                            : isLocked
                              ? 'inset 2px 2px 4px rgba(0,0,0,0.05), inset -2px -2px 4px rgba(255,255,255,0.8)'
                              : '4px 4px 10px rgba(163,177,198,0.4), -3px -3px 8px rgba(255,255,255,0.85)',
                          opacity: isLocked ? 0.6 : 1,
                          cursor: isDone ? 'default' : isLocked ? 'not-allowed' : 'pointer',
                          textAlign: 'right',
                          position: 'relative',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          fontFamily: 'inherit',
                          animation: isNext ? 'vmPillPulse 2.2s ease-in-out infinite' : undefined,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                          <div
                            style={{
                              width: 34, height: 34, borderRadius: 11,
                              background: isDone ? '#10B981' : isLocked ? '#D1D5DB' : grad,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                              fontSize: 16,
                              color: 'white',
                              boxShadow: isDone ? '0 2px 4px rgba(16,185,129,0.3)' : 'none',
                            }}
                          >
                            {isDone ? <Check weight="bold" size={16} /> : isLocked ? <Lock weight="bold" size={14} /> : <span>{emoji}</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              className="font-heading"
                              style={{
                                fontSize: 13, fontWeight: 800,
                                color: isDone ? '#047857' : isLocked ? '#9CA3AF' : '#0d294b',
                                lineHeight: 1.15,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                textDecoration: isDone ? 'line-through' : 'none',
                                textDecorationColor: 'rgba(16,185,129,0.5)',
                              }}
                            >
                              {m.title}
                            </div>
                          </div>
                          {isNext && (
                            <span
                              style={{
                                fontSize: 9, fontWeight: 900, letterSpacing: '0.08em',
                                color: 'white',
                                background: 'linear-gradient(135deg, #EE2B73, #FF6B9D)',
                                padding: '3px 7px', borderRadius: 999,
                                flexShrink: 0,
                                boxShadow: '0 2px 6px rgba(238,43,115,0.4)',
                              }}
                            >
                              הבא
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: isDone ? '#10B981' : isLocked ? '#9CA3AF' : '#6B7280' }}>
                            {isDone ? '✓ בוצע' : isLocked ? '🔒 נעול' : `~${m.estimatedMinutes} דק׳`}
                          </span>
                          {!isDone && !isLocked && (
                            <span style={{ fontSize: 12, color: '#EE2B73', fontWeight: 900, opacity: 0.7 }}>
                              ←
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Primary CTA — unified `.znk-cta-primary` (single source of
                    truth in src/index.css). Identical font / size / glow /
                    pulse to the CTAs on /, /exam, /exam/full, /reading,
                    /journey. No emojis — clean text + RTL-forward arrow. */}
                <button
                  className="vm-cta znk-cta-primary"
                  onClick={() => vocabNext && startMission(vocabNext)}
                  disabled={!vocabNext}
                  aria-label={vocabNext ? 'יאללה נתחיל' : 'סיימת הכל! כל הכבוד'}
                >
                  {vocabNext ? (
                    <>
                      <span>יאללה נתחיל</span>
                      {/* Arrow LEFT — forward direction in RTL */}
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
                    </>
                  ) : (
                    <span>{g('סיימת הכל! כל הכבוד', 'סיימת הכל! כל הכבוד')}</span>
                  )}
                </button>
              </div>
            </div>
          )}


          {/* ══════════════════════════════════════════════ */}
          {/*  PRACTICE 1: Flashcards — היכרות מילים חדשות  */}
          {/* ══════════════════════════════════════════════ */}
          <div
            className="bento-cell cell-practice1 shadow-clay-pink"
            onClick={() => go('flashcards')}
            style={{ borderRadius: 32, padding: '28px 24px', background: 'linear-gradient(150deg, #E8FFF5, #A7F3D0, #6EE7B7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', position: 'relative' }}
          >
            <div className="znk-tooltip tip-pink"><span className="tip-emoji">🔄</span>{g('הפוך, גלה, זכור — ככה זונקים קדימה!', 'הפכי, גלי, זכרי — ככה זונקים קדימה!')}</div>
            <div className="shadow-clay-sm icon-box" style={{ width: 64, height: 64, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #34D399, #059669)', marginBottom: 16 }}>
              <Cards weight="fill" size={36} color="white" />
            </div>
            <h3 className="font-heading" style={{ fontSize: 16, fontWeight: 800, color: '#065F46', marginBottom: 4 }}>כרטיסיות היכרות</h3>
            <p style={{ fontSize: 12, color: '#047857', lineHeight: 1.5, opacity: 0.7 }}>מילים חדשות</p>
            <img src={asset('char-books.png')} alt="" className="animate-wiggle char-decor char-left" />
            <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', filter: 'blur(20px)' }} />
          </div>


          {/* ══════════════════════════════════════════════ */}
          {/*  PRACTICE 2: Learn — שינון מילים חדשות        */}
          {/* ══════════════════════════════════════════════ */}
          <div
            className="bento-cell cell-practice2 shadow-clay-pink"
            onClick={() => go('learnMode')}
            style={{ borderRadius: 32, padding: '28px 24px', background: 'linear-gradient(150deg, #FFF0F5, #FFE0EB)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', position: 'relative' }}
          >
            <div className="znk-tooltip tip-pink"><span className="tip-emoji">🧠</span>{g('מילים חדשות מחכות לך — בוא נזנק על זה!', 'מילים חדשות מחכות לך — בואי נזנק על זה!')}</div>
            <div className="shadow-clay-sm icon-box" style={{ width: 64, height: 64, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #FF6B9D, #EE2B73)', marginBottom: 16 }}>
              <BookOpenText weight="fill" size={36} color="white" />
            </div>
            <h3 className="font-heading" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>שינון מילים חדשות</h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>למד מילים עם הסברים ודוגמאות</p>
            <img src={asset('char-mentor.png')} alt="" className="animate-wiggle char-decor char-left" style={{ animationDelay: '-3s' }} />
            <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(238,43,115,0.08)', filter: 'blur(20px)' }} />
          </div>


          {/* ══════════════════════════════════════════════ */}
          {/*  PRACTICE 3: Adaptive — תרגול אדפטיבי כל המילים */}
          {/* ══════════════════════════════════════════════ */}
          <div
            className="bento-cell cell-practice3 shadow-clay-orange"
            onClick={() => go('adaptivePractice')}
            style={{ borderRadius: 32, padding: '28px 24px', background: 'linear-gradient(150deg, #FFF0E6, #FFB870, #FF9A45)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', position: 'relative' }}
          >
            <div className="znk-tooltip tip-yellow"><span className="tip-emoji">🎯</span>{g('המערכת יודעת מה מאתגר אותך — תן לה להוביל!', 'המערכת יודעת מה מאתגר אותך — תני לה להוביל!')}</div>
            <div className="shadow-clay-sm icon-box" style={{ width: 64, height: 64, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,41,75,0.9)', marginBottom: 16 }}>
              <Target weight="fill" size={36} color="white" />
            </div>
            <h3 className="font-heading" style={{ fontSize: 16, fontWeight: 900, color: 'var(--navy)', marginBottom: 4 }}>תרגול אדפטיבי</h3>
            <p style={{ fontSize: 12, color: 'rgba(13,41,75,0.5)', lineHeight: 1.5 }}>כל המילים</p>
            <img src={asset('char-psicho.png')} alt="" className="animate-wiggle char-decor char-right" style={{ animationDelay: '-4s' }} />
            <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,160,60,0.15)', filter: 'blur(15px)' }} />
          </div>


          {/* ══════════════════════════════════════════════ */}
          {/*  PRACTICE 4: Speed Review — שליפה מהירה כל המילים */}
          {/* ══════════════════════════════════════════════ */}
          <div
            className="bento-cell cell-practice4 shadow-clay-orange"
            onClick={() => go('gravity')}
            style={{ borderRadius: 32, padding: '28px 24px', background: 'linear-gradient(150deg, #F0E6FF, #C4B5FD, #A78BFA)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', position: 'relative' }}
          >
            <div className="znk-tooltip tip-yellow"><span className="tip-emoji">⚡</span>{g('מהירות = שליטה! תפוס מילים כמו זנוקר אמיתי!', 'מהירות = שליטה! תפסי מילים כמו זנוקרית אמיתית!')}</div>
            <div className="shadow-clay-sm icon-box" style={{ width: 64, height: 64, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', marginBottom: 16 }}>
              <Lightning weight="fill" size={36} color="white" />
            </div>
            <h3 className="font-heading" style={{ fontSize: 16, fontWeight: 900, color: '#4C1D95', marginBottom: 4 }}>שליפה מהירה</h3>
            <p style={{ fontSize: 12, color: '#6D28D9', lineHeight: 1.5, opacity: 0.7 }}>כל המילים</p>
            <img src={asset('char-life.png')} alt="" className="animate-wiggle char-decor char-right" style={{ animationDelay: '-2s' }} />
            <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, borderRadius: '50%', background: 'rgba(139,92,246,0.1)', filter: 'blur(15px)' }} />
          </div>


          {/* ══════════════════════════════════════════════ */}
          {/*  NAV 1: By Units                              */}
          {/* ══════════════════════════════════════════════ */}
          <div
            className="bento-cell cell-nav1 shadow-clay"
            onClick={() => navigate('/vocabulary/units')}
            style={{ borderRadius: 32, padding: '20px 24px', background: 'linear-gradient(150deg, #F0F4FA, #E8EEF7)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', gap: 16 }}
          >
            <div className="znk-tooltip tip-blue"><span className="tip-emoji">📚</span>{g('כל היחידות מסודרות ומחכות לך — בחר והתחל!', 'כל היחידות מסודרות ומחכות לך — בחרי והתחילי!')}</div>
            <div className="shadow-clay-sm icon-box" style={{ width: 56, height: 56, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #D6DEF0, #C2CCE0)', flexShrink: 0 }}>
              <Books weight="fill" size={32} color="#4F4780" />
            </div>
            <div>
              <h3 className="font-heading" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>לפי יחידות</h3>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{units.length} יחידות</span>
            </div>
          </div>


          {/* ══════════════════════════════════════════════ */}
          {/*  NAV 2: All Words                             */}
          {/* ══════════════════════════════════════════════ */}
          <div
            className="bento-cell cell-nav2 shadow-clay"
            onClick={() => navigate('/vocabulary/all-words')}
            style={{ borderRadius: 32, padding: '20px 24px', background: 'linear-gradient(150deg, #F0F4FA, #E8EEF7)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', gap: 16 }}
          >
            <div className="znk-tooltip tip-blue"><span className="tip-emoji">🔍</span>כל האוצר במקום אחד — חפש, סנן וזנק!</div>
            <div className="shadow-clay-sm icon-box" style={{ width: 56, height: 56, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #D6DEF0, #C2CCE0)', flexShrink: 0 }}>
              <MagnifyingGlass weight="fill" size={32} color="#4F4780" />
            </div>
            <div>
              <h3 className="font-heading" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>כל המילים</h3>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{totalWords.toLocaleString()} מילים</span>
            </div>
          </div>


          {/* ══════════════════════════════════════════════ */}
          {/*  TTS SETTINGS                                 */}
          {/* ══════════════════════════════════════════════ */}
          <TTSSettingsCell />

        </div>{/* /mega-bento */}
      </div>
    </div>
  )
}


/* ================================================================== */
/*  TTS Settings Cell                                                  */
/* ================================================================== */

function TTSSettingsCell() {
  const { autoReadWord, autoReadMeaning, setAutoReadWord, setAutoReadMeaning } = useTTSSettingsStore()

  return (
    <div
      className="bento-cell cell-tts shadow-clay"
      style={{ borderRadius: 32, padding: '22px 26px', background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'default' }}
    >
      <div className="znk-tooltip"><span className="tip-emoji">🎧</span>כוונן את ההקראה — כי ללמוד עם אוזניים זה פי שניים!</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <SpeakerHigh weight="fill" size={24} color="var(--text)" />
        <span className="font-heading" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>הגדרות הקראה</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Toggle 1 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>הקראת מילה באנגלית</span>
          <ClayToggle checked={autoReadWord} onChange={setAutoReadWord} />
        </div>
        {/* Toggle 2 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>הקראת פירוש בעברית</span>
          <ClayToggle checked={autoReadMeaning} onChange={setAutoReadMeaning} />
        </div>
      </div>
    </div>
  )
}


/* ================================================================== */
/*  Clay Toggle Switch                                                 */
/* ================================================================== */

function ClayToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`btn-squish ${checked ? '' : 'shadow-clay-pressed'}`}
      style={{
        width: 48,
        height: 28,
        borderRadius: 20,
        position: 'relative',
        border: 'none',
        cursor: 'pointer',
        background: checked
          ? 'linear-gradient(135deg, var(--pink-light), var(--pink))'
          : 'transparent',
        boxShadow: checked
          ? '6px 6px 12px rgba(238,43,115,0.15), -4px -4px 8px rgba(255,255,255,0.5)'
          : undefined,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          background: checked ? 'white' : '#cdc6d9',
          borderRadius: '50%',
          position: 'absolute',
          top: 3,
          ...(checked ? { left: 3 } : { right: 3 }),
          boxShadow: checked
            ? '2px 2px 4px rgba(0,0,0,0.08), -1px -1px 2px rgba(255,255,255,0.8)'
            : '1px 1px 3px rgba(0,0,0,0.05)',
        }}
      />
    </button>
  )
}


/* ================================================================== */
/*  Full CSS — exact replica of mockup                                 */
/* ================================================================== */

const vocabHomeCSS = `
  :root {
    --canvas: #F4F1FA;
    --navy: #0d294b;
    --pink: #EE2B73;
    --pink-light: #FF6B9D;
    --pink-soft: #FFF0F5;
    --yellow: #FFE600;
    --yellow-soft: #FFF8B8;
    --purple: #4F4780;
    --accent: #6C63FF;
    --accent-light: #8B84FF;
    --correct: #10B981;
    --text: #332F3A;
    --muted: #635F69;
  }

  .font-heading { font-family: 'Nunito', 'Heebo', sans-serif; }

  /* ── Gateway section crown — pixel-identical to /reading .rh-section-crown
     and /exam .eh-section-crown so every gateway shares the same crown. ──
     Uses flex (not inline-flex) + width:fit-content so the line-box doesn't
     clip the chip top on browsers that compute inline line-height tightly. */
  .vh-section-crown {
    display: flex; width: fit-content;
    align-items: center; gap: 14px;
    padding: 14px 22px 14px 18px;
    background: linear-gradient(135deg, rgba(255,230,0,0.98) 0%, rgba(255,199,44,0.98) 100%);
    color: #1a0b3a;
    border: 3px solid #1a0b3a;
    border-radius: 999px;
    box-shadow: 5px 5px 0 0 #1a0b3a;
    margin: 2px 0 18px;
    animation: vhCrownIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  .vh-section-crown-ico {
    display: flex; align-items: center; justify-content: center;
    width: 44px; height: 44px; border-radius: 50%;
    background: linear-gradient(135deg, #1a0b3a, #4A1A6B);
    color: #FFE600;
    box-shadow: inset 0 1px 2px rgba(255,255,255,0.15);
    flex-shrink: 0;
  }
  .vh-section-crown-ico svg { width: 24px; height: 24px; }
  .vh-section-crown-text {
    display: flex; flex-direction: column; gap: 2px; line-height: 1; text-align: right;
  }
  .vh-section-crown-text small {
    font-family: 'Nunito', 'Heebo', sans-serif;
    font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
    color: rgba(26,11,58,0.7);
  }
  .vh-section-crown-text b {
    font-family: 'Nunito', 'Heebo', sans-serif;
    font-size: 26px; font-weight: 900; letter-spacing: -0.015em;
    color: #1a0b3a;
    line-height: 1.05;
  }
  @keyframes vhCrownIn {
    0% { opacity: 0; transform: translateY(-8px) scale(0.95); }
    60% { opacity: 1; transform: translateY(0) scale(1.03); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @media (max-width: 720px) {
    .vh-section-crown { padding: 11px 18px 11px 14px; gap: 12px; margin-bottom: 14px; }
    .vh-section-crown-ico { width: 36px; height: 36px; }
    .vh-section-crown-ico svg { width: 20px; height: 20px; }
    .vh-section-crown-text small { font-size: 9.5px; letter-spacing: 0.16em; }
    .vh-section-crown-text b { font-size: 20px; }
  }

  /* ── Clay Shadows ── */
  .shadow-clay {
    box-shadow:
      16px 16px 32px rgba(130, 120, 160, 0.18),
      -10px -10px 24px rgba(255, 255, 255, 0.85),
      inset 5px 5px 10px rgba(108, 99, 255, 0.03),
      inset -5px -5px 10px rgba(255, 255, 255, 0.95);
  }
  .shadow-clay-sm {
    box-shadow:
      8px 8px 16px rgba(130, 120, 160, 0.15),
      -6px -6px 12px rgba(255, 255, 255, 0.85),
      inset 3px 3px 6px rgba(108, 99, 255, 0.02),
      inset -3px -3px 6px rgba(255, 255, 255, 0.95);
  }
  .shadow-clay-pressed {
    box-shadow:
      inset 8px 8px 16px rgba(130, 120, 160, 0.2),
      inset -8px -8px 16px rgba(255, 255, 255, 0.9);
  }
  .shadow-clay-hero {
    box-shadow:
      20px 20px 40px rgba(79, 71, 128, 0.22),
      -14px -14px 28px rgba(255, 255, 255, 0.7),
      inset 8px 8px 16px rgba(108, 99, 255, 0.04),
      inset -8px -8px 16px rgba(255, 255, 255, 0.9);
  }
  .shadow-clay-hover {
    box-shadow:
      20px 20px 40px rgba(160, 150, 180, 0.28),
      -12px -12px 28px rgba(255, 255, 255, 0.95),
      inset 6px 6px 12px rgba(139, 92, 246, 0.04),
      inset -6px -6px 12px rgba(255, 255, 255, 1);
  }
  .shadow-clay-pink {
    box-shadow:
      14px 14px 28px rgba(238, 43, 115, 0.15),
      -8px -8px 20px rgba(255, 255, 255, 0.7),
      inset 5px 5px 10px rgba(255, 255, 255, 0.5),
      inset -5px -5px 10px rgba(0, 0, 0, 0.04);
  }
  .shadow-clay-yellow {
    box-shadow:
      14px 14px 28px rgba(255, 230, 0, 0.2),
      -8px -8px 20px rgba(255, 255, 255, 0.6),
      inset 5px 5px 10px rgba(255, 255, 255, 0.5),
      inset -5px -5px 10px rgba(0, 0, 0, 0.04);
  }
  .shadow-clay-orange {
    box-shadow:
      14px 14px 28px rgba(255, 154, 69, 0.2),
      -8px -8px 20px rgba(255, 255, 255, 0.6),
      inset 5px 5px 10px rgba(255, 255, 255, 0.5),
      inset -5px -5px 10px rgba(0, 0, 0, 0.04);
  }

  /* ── Animations ── */
  @keyframes clay-float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-18px) rotate(2deg); }
  }
  @keyframes clay-float-alt {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-14px) rotate(-3deg); }
  }
  @keyframes clay-breathe {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.03); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(40px) scale(0.92); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes fadeInScale {
    from { opacity: 0; transform: scale(0.5) rotate(-8deg); }
    to { opacity: 1; transform: scale(1) rotate(0deg); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(60px) rotate(3deg); }
    to { opacity: 1; transform: translateX(0) rotate(0deg); }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-60px) rotate(-3deg); }
    to { opacity: 1; transform: translateX(0) rotate(0deg); }
  }
  @keyframes popIn {
    0% { opacity: 0; transform: scale(0.95); }
    50% { opacity: 1; transform: scale(1.08); }
    70% { transform: scale(0.95); }
    100% { transform: scale(1); }
  }
  @keyframes wiggle {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(255,230,0,0.2), 0 0 40px rgba(255,230,0,0.1); }
    50% { box-shadow: 0 0 30px rgba(255,230,0,0.4), 0 0 60px rgba(255,230,0,0.2), 0 0 90px rgba(255,230,0,0.1); }
  }
  /* ─── Vocab-missions strip ─── */
  @keyframes vmPillPulse {
    0%, 100% { box-shadow: 4px 4px 10px rgba(238,43,115,0.35), -3px -3px 8px rgba(255,255,255,0.85), 0 0 0 2px rgba(238,43,115,0.25); }
    50%      { box-shadow: 4px 4px 14px rgba(238,43,115,0.55), -3px -3px 8px rgba(255,255,255,0.85), 0 0 0 3px rgba(238,43,115,0.5); }
  }
  @keyframes vmCtaPulse {
    0%, 100% {
      box-shadow:
        0 10px 28px rgba(255,184,0,0.55),
        0 0 40px rgba(255,230,0,0.4),
        inset 0 2px 8px rgba(255,255,255,0.6),
        inset 0 -3px 8px rgba(255,184,0,0.35);
    }
    50% {
      box-shadow:
        0 14px 40px rgba(255,184,0,0.75),
        0 0 60px rgba(255,230,0,0.65),
        0 0 0 6px rgba(255,230,0,0.22),
        inset 0 2px 8px rgba(255,255,255,0.7),
        inset 0 -3px 8px rgba(255,184,0,0.4);
    }
  }
  .cell-vocab-missions:hover { transform: translateY(-4px); }
  .vm-pills-row::-webkit-scrollbar { height: 6px; }
  .vm-pills-row::-webkit-scrollbar-thumb { background: rgba(238,43,115,0.35); border-radius: 999px; }
  .vm-pill:not(:disabled):hover { transform: translateY(-2px) scale(1.015); }
  .vm-pill:not(:disabled):active { transform: scale(0.97); }
  @keyframes icon-bounce {
    0%, 100% { transform: translateY(0) scale(1); }
    25% { transform: translateY(-6px) scale(1.1); }
    50% { transform: translateY(0) scale(1); }
    75% { transform: translateY(-3px) scale(1.05); }
  }
  @keyframes streak-fire {
    0%, 100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
    25% { transform: scale(1.15) rotate(-5deg); filter: brightness(1.2); }
    50% { transform: scale(1.05) rotate(3deg); filter: brightness(1.1); }
    75% { transform: scale(1.12) rotate(-2deg); filter: brightness(1.15); }
  }
  @keyframes tilt-hover {
    0%, 100% { transform: translateY(-8px) rotate(0deg); }
    25% { transform: translateY(-10px) rotate(1.5deg); }
    75% { transform: translateY(-6px) rotate(-1.5deg); }
  }
  @keyframes progress-shine {
    0% { left: -30%; }
    100% { left: 130%; }
  }
  @keyframes blob-drift-1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(40px, -30px) scale(1.05); }
    66% { transform: translate(-20px, 20px) scale(0.96); }
  }
  @keyframes blob-drift-2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(-50px, 30px) scale(0.95); }
    66% { transform: translate(30px, -40px) scale(1.04); }
  }
  @keyframes blob-drift-3 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(30px, 50px) scale(1.08); }
  }

  .clay-float { animation: clay-float 8s ease-in-out infinite; }
  .clay-float-alt { animation: clay-float-alt 10s ease-in-out infinite; }
  .clay-breathe { animation: clay-breathe 5s ease-in-out infinite; }
  .animate-wiggle { animation: wiggle 5s ease-in-out infinite; }
  .animate-icon-bounce { animation: icon-bounce 2s ease-in-out infinite; }
  .animate-streak-fire { animation: streak-fire 2s ease-in-out infinite; }

  /* ── Interactive ── */
  .bento-cell {
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
                box-shadow 0.4s ease,
                filter 0.3s ease;
    cursor: pointer;
  }
  .bento-cell:hover {
    filter: brightness(1.04);
  }
  .bento-cell:active { transform: scale(0.95); }

  /* ── Hover: each cell type gets its own effect ── */
  .cell-hero:hover { transform: translateY(-8px) rotate(-1deg); }
  .cell-streak:hover { transform: translateY(-8px) scale(1.03); }
  .cell-progress:hover { transform: translateY(-8px); }
  .cell-practice1:hover,
  .cell-practice2:hover { transform: translateY(-10px) rotate(-1.5deg); }
  .cell-practice3:hover,
  .cell-practice4:hover { transform: translateY(-10px) rotate(1.5deg); }
  .cell-nav1:hover,
  .cell-nav2:hover { transform: translateX(-6px) translateY(-4px); }
  .cell-tts:hover { transform: translateY(-4px); }

  /* ── Character images inside practice cells ── */
  .char-decor {
    position: absolute;
    bottom: 0;
    width: 100px;
    opacity: 0.2;
    pointer-events: none;
    max-height: 70%;
    object-fit: contain;
    object-position: bottom;
  }
  .char-decor.char-left { left: 5px; }
  .char-decor.char-right { right: 5px; }

  /* ── Icon hover animations on practice cells ── */
  .bento-cell:hover .icon-box {
    animation: icon-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* ── Shimmer effect on hero title ── */
  .shimmer-text {
    background: linear-gradient(90deg, white 0%, white 40%, var(--yellow) 50%, white 60%, white 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 4s linear infinite;
  }

  /* ── Progress bar shine ── */
  .progress-bar-container {
    position: relative;
    overflow: hidden;
  }
  .progress-bar-container::after {
    content: '';
    position: absolute;
    top: 0;
    left: -30%;
    width: 30%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    animation: progress-shine 3s ease-in-out infinite;
    border-radius: 20px;
  }

  .btn-squish {
    transition: all 0.15s;
    cursor: pointer;
  }
  .btn-squish:hover { transform: translateY(-2px); }
  .btn-squish:active { transform: scale(0.92); }

  /* ── Background blobs ── */
  .blob {
    position: fixed;
    border-radius: 50%;
    filter: blur(100px);
    opacity: 0.08;
    pointer-events: none;
    z-index: 0;
  }
  .blob-1 {
    width: 600px; height: 600px;
    background: linear-gradient(135deg, #8B5CF6, #EC4899);
    top: -10%; right: -5%;
    animation: blob-drift-1 25s ease-in-out infinite;
  }
  .blob-2 {
    width: 500px; height: 500px;
    background: linear-gradient(135deg, #EE2B73, #F97316);
    bottom: 10%; left: -8%;
    animation: blob-drift-2 30s ease-in-out infinite;
  }
  .blob-3 {
    width: 400px; height: 400px;
    background: linear-gradient(135deg, #6C63FF, #10B981);
    top: 50%; right: 30%;
    animation: blob-drift-3 22s ease-in-out infinite;
  }

  /* ── Bento Grid ── */
  .mega-bento {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    grid-auto-rows: 100px;
    gap: 16px;
  }

  /* ── Cell assignments (desktop) ── */
  .cell-hero     { grid-column: span 8; grid-row: span 4; }
  .cell-streak   { grid-column: span 4; grid-row: span 2; }
  .cell-progress { grid-column: span 4; grid-row: span 2; }
  .cell-vocab-missions { grid-column: span 12; grid-row: span 2; }
  .cell-practice1 { grid-column: span 3; grid-row: span 3; }
  .cell-practice2 { grid-column: span 3; grid-row: span 3; }
  .cell-practice3 { grid-column: span 3; grid-row: span 3; }
  .cell-practice4 { grid-column: span 3; grid-row: span 3; }
  .cell-nav1     { grid-column: span 4; grid-row: span 2; }
  .cell-nav2     { grid-column: span 4; grid-row: span 2; }
  .cell-tts      { grid-column: span 4; grid-row: span 2; }

  /* ── Tablet ── */
  @media (min-width: 769px) and (max-width: 1024px) {
    .mega-bento {
      grid-template-columns: repeat(6, 1fr);
      grid-auto-rows: 90px;
    }
    .cell-hero     { grid-column: span 6; grid-row: span 4; }
    .cell-streak   { grid-column: span 3; grid-row: span 2; }
    .cell-progress { grid-column: span 3; grid-row: span 2; }
    .cell-vocab-missions { grid-column: span 6; grid-row: span 2; }
    .cell-practice1 { grid-column: span 3; grid-row: span 3; }
    .cell-practice2 { grid-column: span 3; grid-row: span 3; }
    .cell-practice3 { grid-column: span 3; grid-row: span 3; }
    .cell-practice4 { grid-column: span 3; grid-row: span 3; }
    .cell-nav1     { grid-column: span 3; grid-row: span 2; }
    .cell-nav2     { grid-column: span 3; grid-row: span 2; }
    .cell-tts      { grid-column: span 6; grid-row: span 2; }
  }

  /* Desktop layout override for the unified .znk-cta-primary class.
     The shared global class enforces width: 100% !important because
     that's correct for every other gateway. On /vocabulary the CTA sits
     inside a flex row alongside the mission-pills strip (.vm-body),
     so a 100%-wide CTA breaks the layout (forces a wrap, button drops
     below the pills). Restore the previous narrow-column-on-the-right
     placement by capping width on viewports >768px. Mobile keeps the
     full-width treatment via the existing rule inside the mobile @media.
     The visual contract (font, gradient, glow, pulse) stays unified. */
  @media (min-width: 769px) {
    .cell-vocab-missions .vm-cta.znk-cta-primary {
      width: auto !important;
      min-width: 220px !important;
      max-width: 280px !important;
      flex: 0 0 auto !important;
      align-self: stretch;
      margin-top: 0 !important;
    }
  }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .mega-bento {
      grid-template-columns: 1fr 1fr;
      grid-auto-rows: auto;
      gap: 12px;
    }
    .mega-bento > * {
      grid-column: span 1 !important;
      grid-row: span 1 !important;
    }
    /* Mobile reordering — daily missions FIRST after the hero so the
       student lands on what they actually came to do; the stage tile
       and weak-words tile drop below the fold (per 2026-04-25 user
       feedback). Each cell explicitly numbered so the visual order is
       unambiguous regardless of DOM order. */
    .cell-hero            { order: 1; }
    .cell-vocab-missions  { order: 2; }
    .cell-progress        { order: 3; }   /* "המסע שלך" */
    .cell-streak          { order: 4; }   /* "מילים לחיזוק" */
    .cell-practice1       { order: 5; }
    .cell-practice2       { order: 6; }
    .cell-practice3       { order: 7; }
    .cell-practice4       { order: 8; }
    .cell-nav1            { order: 9; }
    .cell-nav2            { order: 10; }
    .cell-tts             { order: 11; }

    .cell-hero {
      grid-column: span 2 !important;
      min-height: auto;
      padding: 24px 20px !important;
      border-radius: 28px !important;
    }
    .cell-vocab-missions {
      grid-column: span 2 !important;
      padding: 18px 16px !important;
      border-radius: 24px !important;
      /* Prevent any descendant from forcing the cell to grow horizontally */
      max-width: 100%;
    }
    /* Header stacks cleanly — title on top, progress bar below; no wrap */
    .cell-vocab-missions .vm-header {
      flex-direction: column !important;
      align-items: stretch !important;
      flex-wrap: nowrap !important;
      gap: 12px !important;
      margin-bottom: 14px !important;
    }
    /* Progress bar takes full width without the desktop flex-basis */
    .cell-vocab-missions .vm-header > div:last-child {
      min-width: 0 !important;
      flex: 1 1 auto !important;
      width: 100%;
    }
    /* Body stacks cleanly; no wrap; children never exceed parent width */
    .cell-vocab-missions .vm-body {
      flex-direction: column !important;
      flex-wrap: nowrap !important;
      align-items: stretch !important;
      gap: 12px !important;
      max-width: 100%;
      min-width: 0;
    }
    .cell-vocab-missions .vm-pills-row {
      order: 1;
      min-width: 0 !important;
      max-width: 100%;
      width: 100%;
      /* Horizontal scroll still works but confined to cell width */
    }
    /* Each pill is a touch-friendly size on mobile */
    .cell-vocab-missions .vm-pill {
      min-width: 160px !important;
      max-width: 200px !important;
    }
    .cell-vocab-missions .vm-cta {
      width: 100% !important;
      order: 2;
      min-width: 0 !important;
      padding: 13px 18px !important;
    }
    /* Title text wraps cleanly on narrow screens */
    .cell-vocab-missions .vm-header h3 {
      font-size: 16px !important;
      line-height: 1.2 !important;
    }
    .cell-vocab-missions .vm-header p {
      font-size: 11.5px !important;
    }
    .cell-hero > div:first-of-type,
    .cell-hero > div:nth-of-type(2),
    .cell-hero > div:nth-of-type(3) {
      width: 100px !important;
      height: 100px !important;
    }
    .cell-hero > div:nth-of-type(4) {
      max-width: 100% !important;
    }
    .cell-hero h1 {
      font-size: 1.7rem !important;
      margin-bottom: 4px !important;
    }
    .cell-hero p {
      font-size: 12.5px !important;
      margin-bottom: 10px !important;
    }
    /* Hide the 3-stat row on mobile — the daily-missions card right
       below has its own progress bar and the data here is redundant.
       Saves ~80px of vertical real estate so the "יאללה, נתחיל" CTA
       fits above the fold on iPhone SE. */
    .cell-hero .hero-stat,
    .cell-hero > div[style*="position: relative"] > div[style*="display: flex"][style*="gap"] {
      display: none !important;
    }
    .cell-hero > img {
      width: 130px !important;
      bottom: auto !important;
      top: 10px !important;
      left: 10px !important;
      opacity: 0.8 !important;
    }
    .hero-tip {
      display: none !important;
    }
    .cell-streak {
      border-radius: 24px !important;
      padding: 16px 12px !important;
    }
    .cell-streak .font-heading:first-of-type {
      font-size: 2rem !important;
    }
    .cell-streak .animate-streak-fire {
      font-size: 28px !important;
    }
    .cell-progress {
      border-radius: 24px !important;
      padding: 16px 18px !important;
    }
    .cell-progress .font-heading:first-of-type {
      font-size: 16px !important;
    }
    .cell-progress span[style*="font-size: 26px"],
    .cell-progress span[style*="fontSize: 26"] {
      font-size: 20px !important;
    }
    .cell-progress span[style*="font-size: 28px"],
    .cell-progress span[style*="fontSize: 28"] {
      font-size: 22px !important;
    }
    .cell-practice1,
    .cell-practice2,
    .cell-practice3,
    .cell-practice4 {
      border-radius: 24px !important;
      padding: 20px 16px !important;
      min-height: 160px;
    }
    .cell-practice1 .icon-box,
    .cell-practice2 .icon-box,
    .cell-practice3 .icon-box,
    .cell-practice4 .icon-box {
      width: 52px !important;
      height: 52px !important;
      border-radius: 18px !important;
      margin-bottom: 12px !important;
    }
    .cell-practice1 .icon-box img,
    .cell-practice2 .icon-box img,
    .cell-practice3 .icon-box img,
    .cell-practice4 .icon-box img {
      width: 24px !important;
      height: 24px !important;
    }
    .cell-practice1 h3,
    .cell-practice2 h3,
    .cell-practice3 h3,
    .cell-practice4 h3 {
      font-size: 14px !important;
    }
    .cell-practice1 p,
    .cell-practice2 p,
    .cell-practice3 p,
    .cell-practice4 p {
      font-size: 11px !important;
    }
    .char-decor {
      width: 70px !important;
      max-height: 55% !important;
    }
    .cell-nav1,
    .cell-nav2 {
      border-radius: 24px !important;
      padding: 16px 18px !important;
    }
    .cell-nav1 .icon-box,
    .cell-nav2 .icon-box {
      width: 44px !important;
      height: 44px !important;
      border-radius: 16px !important;
    }
    .cell-nav1 h3,
    .cell-nav2 h3 {
      font-size: 14px !important;
    }
    .cell-tts {
      grid-column: span 2 !important;
      border-radius: 24px !important;
      padding: 18px 20px !important;
    }
    .znk-tooltip {
      display: none !important;
    }
    .bento-cell:hover {
      transform: none !important;
      filter: none !important;
    }
    .bento-cell:active {
      transform: scale(0.97) !important;
    }
    .blob-1 { width: 300px !important; height: 300px !important; }
    .blob-2 { width: 250px !important; height: 250px !important; }
    .blob-3 { width: 200px !important; height: 200px !important; }
    .vh-main {
      padding: 12px 10px !important;
    }
  }

  /* ── Small mobile (under 400px) — still 2 columns, just tighter ── */
  @media (max-width: 400px) {
    .mega-bento {
      gap: 8px;
    }
    .vh-main {
      padding: 8px 6px !important;
    }
    .cell-hero {
      padding: 18px 14px !important;
    }
    .cell-hero > img {
      width: 110px !important;
      opacity: 0.4 !important;
    }
    .cell-hero h1 {
      font-size: 1.6rem !important;
    }
    .cell-hero p {
      font-size: 11px !important;
      margin-bottom: 12px !important;
    }
    .hero-stat {
      padding: 6px 6px !important;
    }
    .hero-stat .font-heading {
      font-size: 16px !important;
    }
    .hero-stat span:last-of-type:not(.font-heading) {
      font-size: 7px !important;
    }
    .cell-streak {
      padding: 12px 8px !important;
    }
    .cell-progress {
      padding: 12px 12px !important;
    }
    .cell-progress .font-heading[style*="font-size: 20px"] {
      font-size: 14px !important;
    }
    .cell-practice1,
    .cell-practice2,
    .cell-practice3,
    .cell-practice4 {
      padding: 16px 10px !important;
      min-height: 140px;
    }
    .cell-practice1 .icon-box,
    .cell-practice2 .icon-box,
    .cell-practice3 .icon-box,
    .cell-practice4 .icon-box {
      width: 44px !important;
      height: 44px !important;
      margin-bottom: 10px !important;
    }
    .cell-practice1 h3,
    .cell-practice2 h3,
    .cell-practice3 h3,
    .cell-practice4 h3 {
      font-size: 12px !important;
    }
    .cell-practice1 p,
    .cell-practice2 p,
    .cell-practice3 p,
    .cell-practice4 p {
      font-size: 10px !important;
    }
    .char-decor {
      width: 55px !important;
    }
    .cell-nav1,
    .cell-nav2 {
      padding: 12px 12px !important;
    }
    .cell-nav1 .icon-box,
    .cell-nav2 .icon-box {
      width: 38px !important;
      height: 38px !important;
    }
    .cell-nav1 h3,
    .cell-nav2 h3 {
      font-size: 12px !important;
    }
  }

  /* ── Custom Tooltip ── */
  .bento-cell {
    position: relative;
  }
  .znk-tooltip {
    position: absolute;
    bottom: calc(100% + 12px);
    left: 50%;
    transform: translateX(-50%) translateY(8px);
    background: var(--navy);
    color: white;
    font-family: 'Heebo', sans-serif;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 16px;
    border-radius: 16px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    z-index: 100;
    box-shadow:
      0 8px 24px rgba(13, 41, 75, 0.25),
      0 2px 8px rgba(0, 0, 0, 0.1);
    line-height: 1.5;
  }
  .znk-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 8px solid transparent;
    border-top-color: var(--navy);
  }
  .bento-cell:hover {
    z-index: 50;
  }
  .bento-cell:hover .znk-tooltip {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  /* Tooltip accent colors per group */
  .znk-tooltip.tip-pink {
    background: linear-gradient(135deg, #EE2B73, #C2185B);
  }
  .znk-tooltip.tip-pink::after {
    border-top-color: #EE2B73;
  }
  .znk-tooltip.tip-yellow {
    background: linear-gradient(135deg, var(--yellow), #F5D000);
    color: var(--navy);
  }
  .znk-tooltip.tip-yellow::after {
    border-top-color: var(--yellow);
  }
  .znk-tooltip.tip-blue {
    background: linear-gradient(135deg, #4F4780, #6C63FF);
  }
  .znk-tooltip.tip-blue::after {
    border-top-color: #4F4780;
  }
  .znk-tooltip .tip-emoji {
    font-size: 16px;
    margin-inline-end: 6px;
  }

  /* ── Streak/Progress tooltip arrows point DOWN (tooltip is below) ── */
  .cell-streak .znk-tooltip::after {
    top: auto !important;
    bottom: 100%;
    border-top-color: transparent !important;
    border-bottom-color: #EE2B73;
  }
  .cell-progress .znk-tooltip::after {
    top: auto !important;
    bottom: 100%;
    border-top-color: transparent !important;
    border-bottom-color: var(--yellow);
  }

  /* ── Hero stat tooltips ── */
  .hero-tip {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%) translateY(8px);
    background: rgba(13, 41, 75, 0.92);
    color: white;
    font-family: 'Heebo', sans-serif;
    font-size: 12px;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 12px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    z-index: 100;
    box-shadow: 0 4px 16px rgba(13, 41, 75, 0.3);
  }
  .hero-tip::after {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-bottom-color: rgba(13, 41, 75, 0.92);
  }
  .hero-stat:hover .hero-tip {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .clay-float, .clay-float-alt, .clay-breathe, .animate-wiggle,
    .animate-streak-fire, .animate-icon-bounce, .shimmer-text { animation: none !important; }
    .bento-cell { opacity: 1 !important; transform: none !important; }
    .bento-cell { transition: none; }
    .progress-bar-container::after { animation: none; }
  }
`
