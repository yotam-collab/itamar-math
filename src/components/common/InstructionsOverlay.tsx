import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useStudentProfileStore } from '../../stores/studentProfileStore'
import { useTTSSettingsStore } from '../../stores/ttsSettingsStore'
import { INSTRUCTIONS, type InstructionModeId, type InstructionContent } from '../../data/instructions'
import { playSound } from '../../utils/sounds'
import { stopAllTTS } from '../../utils/tts'
import { asset } from '../../utils/assetUrl'
import { getModeIntroActive, subscribeModeIntro } from '../../utils/modeIntroState'

/** Auto-play speed for instruction narration — slightly faster than
 *  associations (which play at 1.0) per the product spec. */
const NARRATION_SPEED = 1.15

/* ═══════════════════════════════════════════════════════════════════
   FIRST-TIME PRACTICE INSTRUCTIONS OVERLAY
   ───────────────────────────────────────────────────────────────────
   Shown once (per student, per mode) when a student first enters a
   practice mode. Dismissible via "הבנתי" button OR "אל תראה שוב"
   checkbox. Once dismissed with the checkbox, never shown again for
   that mode (stored in studentProfileStore.seenInstructions).

   Design language: Arcade Victory × Neo-Brutalist (matches
   ExamResultScreen / ReadingResultScreen). Isolated `.inx-*` prefix.
   ═══════════════════════════════════════════════════════════════════ */

/* ── ZNK tokens (same as ExamResultScreen) ── */
const Z = {
  yellow: '#FFE600', yellowSoft: '#FFF3A3',
  pink: '#EE2B73', pinkSoft: '#FFD0DE',
  navy: '#0d294b',
  purple: '#6B3FA0',
  correct: '#10B981', correctSoft: '#D1FAE5',
  teal: '#0D9488', tealSoft: '#CCFBF1',
  white: '#FFFFFF', black: '#000000',
  cream: '#FFF1CC',
} as const

const FONT_DISPLAY = "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif"
const FONT_BODY = "'Heebo', 'Satoshi', sans-serif"
const hs = (n = 4, color: string = Z.black) => `${n}px ${n}px 0 0 ${color}`

interface Props {
  /** Mode id — must exist as a key in INSTRUCTIONS */
  modeId: InstructionModeId
  /** Called when the user dismisses the overlay (regardless of checkbox) */
  onDone: () => void
  /** Optional override: pass a custom content block for one-off variants. */
  content?: InstructionContent
}

export function InstructionsOverlay(props: Props) {
  /* Wrapper component: defers mounting the actual instructions modal
     while a brand mode-intro animation is on screen. Without this gate
     the instructions modal (z-9999) would layer on top of the intro
     overlay (z-9998), hiding the brand animation behind it.

     Implemented as a wrapper rather than an in-body early-return so the
     inner body's mount effects (body scroll lock, auto-narration audio,
     TTS gating) only fire AFTER the intro exits — i.e. when the modal
     actually becomes visible to the student. */
  const introActive = useSyncExternalStore(subscribeModeIntro, getModeIntroActive, getModeIntroActive)
  if (introActive) return null
  return <InstructionsOverlayBody {...props} />
}

function InstructionsOverlayBody({ modeId, onDone, content }: Props) {
  const markInstructionsSeen = useStudentProfileStore((s) => s.markInstructionsSeen)
  const [dontShowAgain, setDontShowAgain] = useState(true) // default: student usually wants to hide
  const [isClosing, setIsClosing] = useState(false)
  const [isNarrating, setIsNarrating] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const c = content || INSTRUCTIONS[modeId]

  useEffect(() => {
    try { playSound('hover') } catch { /* ok */ }
    // Lock body scroll while open
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Gate auto-TTS under the overlay so the word-card below doesn't start
    // speaking while the student is reading these instructions. Any in-flight
    // TTS is stopped immediately; hooks will skip future scheduled playbacks
    // until the gate is cleared on unmount.
    const setGatedByOverlay = useTTSSettingsStore.getState().setGatedByOverlay
    setGatedByOverlay(true)
    try { stopAllTTS() } catch { /* ok */ }

    return () => {
      document.body.style.overflow = prev
      // Clear the gate when the overlay dismisses — but with a small delay
      // so the word-card TTS doesn't immediately snap-play as the overlay
      // animates out. The card's own effect will fire normally on next mount
      // or next word change.
      setTimeout(() => setGatedByOverlay(false), 260)
    }
  }, [])

  /* Auto-play the Jessica narration (ElevenLabs v3). The audio is generated
     offline via scripts/generate-instructions-audio.mjs and served from
     public/audio/he/instructions/{modeId}.mp3. Falls silent if the file is
     missing — no visible error, just no narration. */
  useEffect(() => {
    const src = asset(`audio/he/instructions/${modeId}.mp3`)
    const audio = new Audio(src)
    audio.preload = 'auto'
    audio.playbackRate = NARRATION_SPEED
    audio.onplay = () => setIsNarrating(true)
    audio.onended = () => setIsNarrating(false)
    audio.onerror = () => setIsNarrating(false)
    audioRef.current = audio

    // Browsers block autoplay without user interaction. The overlay opens
    // from a click (the student entering a practice mode), so we usually
    // have gesture permission. If we don't, .play() will silently reject.
    audio.play().catch(() => {
      // Graceful fallback — student can press the speaker button in the
      // ribbon to start narration manually.
      setIsNarrating(false)
    })

    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
      setIsNarrating(false)
    }
  }, [modeId])

  const toggleNarration = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.currentTime = 0
      audio.playbackRate = NARRATION_SPEED
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }

  const handleDone = () => {
    if (dontShowAgain) markInstructionsSeen(modeId)
    setIsClosing(true)
    try { playSound('click') } catch { /* ok */ }
    // Allow the closing animation to play out before unmounting
    setTimeout(onDone, 260)
  }

  // Keyboard: Escape closes, Enter commits "הבנתי"
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        handleDone()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dontShowAgain])

  return (
    <div className={`inx-backdrop ${isClosing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-label="הנחיות תרגול">
      <style>{cssBlock}</style>
      <div className={`inx-card ${isClosing ? 'is-closing' : ''}`} dir="rtl">
        {/* Close × */}
        <button
          className="inx-close"
          type="button"
          onClick={handleDone}
          aria-label="סגור"
        >×</button>

        {/* Icon ribbon + narration toggle */}
        <div className="inx-ribbon-row">
          <div className="inx-ribbon">
            <span className="inx-ribbon-ico" aria-hidden="true">{c.icon}</span>
            <div className="inx-ribbon-text">
              <b>הנחיות תרגול</b>
              <small>הפעם הראשונה</small>
            </div>
          </div>
          <button
            type="button"
            className={`inx-narrate ${isNarrating ? 'is-playing' : ''}`}
            onClick={toggleNarration}
            aria-label={isNarrating ? 'השתק הקראה' : 'הקרא את ההוראות'}
            title={isNarrating ? 'לחץ כדי להשתיק את ההקראה' : 'לחץ כדי להקריא את ההוראות שוב'}
          >
            {isNarrating ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 5 6 9H2v6h4l5 4z" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>

        {/* Headline */}
        <h2 className="inx-headline">{c.headline}</h2>

        {/* Single body paragraph — all the pedagogy compressed into one block.
            Long-form expansion still comes through the Jessica v3 narration. */}
        <section className="inx-body">
          <p>{c.paragraph}</p>
        </section>

        {/* Tips line — 3 short phrases joined with subtle dividers */}
        {c.tips.length > 0 && (
          <div className="inx-tips" aria-label="טיפים לתרגול">
            <span className="inx-tips-ico" aria-hidden="true">✓</span>
            {c.tips.map((tip, i) => (
              <span key={i} className="inx-tip-item">
                {i > 0 && <span className="inx-tip-sep" aria-hidden="true">·</span>}
                <span>{tip}</span>
              </span>
            ))}
          </div>
        )}

        {/* Footer — checkbox + primary CTA */}
        <div className="inx-footer">
          <label className="inx-checkbox">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            <span className="inx-checkbox-box" aria-hidden="true">
              {dontShowAgain && <span>✓</span>}
            </span>
            <span className="inx-checkbox-label">אל תראה לי את ההנחיות האלה שוב</span>
          </label>

          <button
            type="button"
            className="inx-primary"
            onClick={handleDone}
          >
            {/* Arrow points LEFT — forward direction in RTL */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            הבנתי, יאללה לתרגול
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   useInstructions() — small helper hook used by each mode
   Returns whether to show the overlay (first time only) and a dismiss
   callback. Components render the overlay conditionally.
   ═══════════════════════════════════════════════════════════════════ */
export function useInstructions(modeId: InstructionModeId) {
  const seen = useStudentProfileStore((s) => s.seenInstructions)
  const [manuallyDismissed, setManuallyDismissed] = useState(false)
  const shouldShow = useMemo(
    () => !seen.includes(modeId) && !manuallyDismissed,
    [seen, modeId, manuallyDismissed],
  )
  return {
    shouldShow,
    dismiss: () => setManuallyDismissed(true),
  }
}

/* ═══════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════ */
const cssBlock = `
@keyframes inxBackdropIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes inxCardIn {
  0%   { opacity: 0; transform: translateY(20px) scale(0.96); }
  60%  { opacity: 1; transform: translateY(-2px) scale(1.01); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes inxCardOut {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(12px) scale(0.97); }
}
@keyframes inxSectionIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.inx-backdrop{
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(13, 41, 75, 0.65);
  backdrop-filter: blur(6px) saturate(130%);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  animation: inxBackdropIn .24s cubic-bezier(0.23, 1, 0.32, 1) both;
  overflow-y: auto;
}
.inx-backdrop.is-closing{
  animation: inxBackdropIn .24s cubic-bezier(0.23, 1, 0.32, 1) reverse both;
}

.inx-card{
  position: relative;
  width: 100%; max-width: 580px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  background: ${Z.yellowSoft};
  border: 3px solid ${Z.black};
  border-radius: 24px;
  box-shadow: ${hs(8)};
  padding: 22px 22px 18px;
  font-family: ${FONT_BODY};
  color: ${Z.black};
  animation: inxCardIn .5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  scrollbar-width: thin;
  scrollbar-color: ${Z.pink} transparent;
}
.inx-card.is-closing{ animation: inxCardOut .24s cubic-bezier(0.23, 1, 0.32, 1) both; }
.inx-card::-webkit-scrollbar{ width: 6px; }
.inx-card::-webkit-scrollbar-thumb{ background: ${Z.pink}; border-radius: 999px; }

.inx-close{
  position: absolute; top: 12px; left: 12px;
  width: 36px; height: 36px;
  border-radius: 50%;
  background: ${Z.white}; color: ${Z.black};
  border: 2.5px solid ${Z.black};
  box-shadow: ${hs(2)};
  font-size: 20px; font-weight: 900; line-height: 1;
  cursor: pointer;
  font-family: ${FONT_DISPLAY};
  transition: transform .15s cubic-bezier(0.23, 1, 0.32, 1), box-shadow .15s cubic-bezier(0.23, 1, 0.32, 1);
  z-index: 2;
}
.inx-close:hover{ transform: translate(-1px,-1px); box-shadow: ${hs(3, Z.pink)}; }
.inx-close:active{ transform: translate(1px,1px); box-shadow: ${hs(1)}; }

.inx-ribbon-row{
  display: flex; align-items: center;
  /* flex-start in RTL packs children to the visual RIGHT, next to each other.
     Previously 'space-between' pushed the narrate button to the LEFT edge,
     where it collided with the absolute-positioned close X. */
  justify-content: flex-start;
  gap: 10px; margin-bottom: 12px;
  flex-wrap: wrap;
  /* Clear zone for the absolute close X (36px wide + 12px offset = 48px).
     inline-end = left in RTL. */
  padding-inline-end: 52px;
  min-height: 38px;
}
.inx-ribbon{
  display: inline-flex; align-items: center; gap: 12px;
  padding: 10px 18px 10px 14px;
  background: ${Z.black}; color: ${Z.yellow};
  border: 2.5px solid ${Z.black}; border-radius: 999px;
  box-shadow: ${hs(3, Z.pink)};
  font-family: ${FONT_DISPLAY};
  position: relative;
}
.inx-ribbon::before{
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 999px;
  background: radial-gradient(ellipse at center, rgba(255,230,0,0.3), transparent 70%);
  z-index: -1;
  filter: blur(8px);
  pointer-events: none;
}
.inx-narrate{
  display: inline-flex; align-items: center; justify-content: center;
  width: 38px; height: 38px;
  border-radius: 50%;
  background: ${Z.pink}; color: ${Z.white};
  border: 2.5px solid ${Z.black};
  box-shadow: ${hs(2, Z.navy)};
  cursor: pointer;
  transition: transform .15s cubic-bezier(0.23, 1, 0.32, 1), box-shadow .15s cubic-bezier(0.23, 1, 0.32, 1);
}
.inx-narrate:hover{ transform: translate(-1px,-1px); box-shadow: ${hs(3, Z.navy)}; }
.inx-narrate:active{ transform: translate(1px,1px); box-shadow: ${hs(1, Z.navy)}; }
.inx-narrate.is-playing{
  background: ${Z.navy};
  animation: inxNarrateBeat 1.4s ease-in-out infinite;
}
@keyframes inxNarrateBeat{
  0%,100% { box-shadow: ${hs(2, Z.pink)}; }
  50%     { box-shadow: ${hs(4, Z.pink)}, 0 0 0 4px rgba(238,43,115,0.22); }
}
.inx-ribbon-ico{ font-size: 22px; line-height: 1; }
.inx-ribbon-text{ display: flex; flex-direction: column; text-align: right; line-height: 1.05; gap: 2px; }
/* Primary label — "הנחיות תרגול" prominent and highlighted in bright yellow */
.inx-ribbon-text b{
  font-size: 16px;
  font-weight: 900;
  letter-spacing: -0.01em;
  color: ${Z.yellow};
  text-shadow: 0 0 12px rgba(255,230,0,0.45);
}
/* Sub-label — "הפעם הראשונה" small caps under the main title */
.inx-ribbon-text small{
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: .16em;
  color: rgba(255,230,0,0.72);
  text-transform: uppercase;
}

.inx-headline{
  font-family: ${FONT_DISPLAY};
  font-weight: 800;
  font-size: clamp(20px, 3.8vw, 26px);
  line-height: 1.18;
  letter-spacing: -0.02em;
  color: ${Z.black};
  margin-bottom: 18px;
  max-width: 46ch;
}

/* ─── Compact body paragraph (v2) ─────────────────────────────────
   Replaces the old 4-section layout. One white card with the pedagogy
   explanation in a single paragraph. Half the vertical space. */
.inx-body{
  background: ${Z.white};
  border: 2.5px solid ${Z.black};
  border-radius: 16px;
  box-shadow: ${hs(3)};
  padding: 14px 16px;
  margin-bottom: 12px;
  animation: inxSectionIn .4s cubic-bezier(0.23, 1, 0.32, 1) both;
  animation-delay: .12s;
}
.inx-body p{
  font-size: 14.5px; line-height: 1.6;
  color: ${Z.navy}; font-weight: 500;
}

/* ─── Tips line — 3 short phrases with dot separators ────────────── */
.inx-tips{
  display: flex; flex-wrap: wrap; align-items: center;
  gap: 4px 6px;
  background: ${Z.pinkSoft};
  border: 2.5px solid ${Z.black};
  border-radius: 14px;
  box-shadow: ${hs(2)};
  padding: 10px 14px;
  margin-bottom: 12px;
  font-family: ${FONT_DISPLAY};
  animation: inxSectionIn .4s cubic-bezier(0.23, 1, 0.32, 1) both;
  animation-delay: .22s;
}
.inx-tips-ico{
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%;
  background: ${Z.pink}; color: ${Z.white};
  font-weight: 900; font-size: 11px;
  flex-shrink: 0; margin-inline-end: 4px;
}
.inx-tip-item{
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px; font-weight: 700;
  color: ${Z.navy};
}
.inx-tip-sep{
  font-size: 14px; font-weight: 900; color: ${Z.pink};
  margin-inline-end: 4px;
}

.inx-footer{
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
  padding-top: 14px; margin-top: 10px;
  border-top: 2.5px dashed rgba(10,14,31,0.22);
}
.inx-checkbox{
  display: flex; align-items: center; gap: 8px;
  cursor: pointer;
  user-select: none;
  min-width: 0;
}
.inx-checkbox input{
  position: absolute; opacity: 0; pointer-events: none;
}
.inx-checkbox-box{
  width: 22px; height: 22px; border-radius: 6px;
  background: ${Z.white};
  border: 2.5px solid ${Z.black};
  box-shadow: ${hs(1.5)};
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: background .15s cubic-bezier(0.23, 1, 0.32, 1);
}
.inx-checkbox input:checked + .inx-checkbox-box{
  background: ${Z.black};
  color: ${Z.yellow};
  box-shadow: ${hs(1.5, Z.pink)};
}
.inx-checkbox-box span{
  font-size: 13px; font-weight: 900; color: ${Z.yellow};
  font-family: ${FONT_DISPLAY};
}
.inx-checkbox-label{
  font-size: 13px; font-weight: 700;
  color: ${Z.navy};
}

.inx-primary{
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 20px;
  background: ${Z.pink}; color: ${Z.white};
  border: 2.5px solid ${Z.black}; border-radius: 999px;
  font-family: ${FONT_DISPLAY}; font-weight: 800; font-size: 14px;
  box-shadow: ${hs(4, Z.navy)};
  cursor: pointer;
  transition: transform .15s cubic-bezier(0.23, 1, 0.32, 1), box-shadow .15s cubic-bezier(0.23, 1, 0.32, 1);
}
.inx-primary:hover{ transform: translate(-2px,-2px); box-shadow: ${hs(6, Z.navy)}; }
.inx-primary:active{ transform: translate(2px,2px); box-shadow: ${hs(1, Z.navy)}; }

/* Mobile */
@media (max-width: 520px){
  .inx-backdrop{ padding: 10px; align-items: flex-start; }
  .inx-card{ padding: 16px 14px 12px; border-radius: 20px; }
  .inx-headline{ font-size: 18px; margin-bottom: 12px; max-width: none; }
  .inx-body{ padding: 12px 14px; border-radius: 14px; margin-bottom: 10px; }
  .inx-body p{ font-size: 13px; line-height: 1.55; }
  .inx-tips{ padding: 8px 12px; margin-bottom: 10px; }
  .inx-tip-item{ font-size: 11.5px; }
  .inx-footer{ flex-direction: column; align-items: stretch; gap: 10px; padding-top: 10px; }
  .inx-primary{ width: 100%; justify-content: center; }
  .inx-checkbox-label{ font-size: 12.5px; }
}

@media (prefers-reduced-motion: reduce){
  .inx-backdrop, .inx-card, .inx-body, .inx-tips{ animation: none !important; }
}
`
