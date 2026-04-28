import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { playSound } from '../../utils/sounds'
import { stopAllTTS } from '../../utils/tts'
import { useTTSSettingsStore } from '../../stores/ttsSettingsStore'
import { pushModeIntroActive, popModeIntroActive } from '../../utils/modeIntroState'

/* ═══════════════════════════════════════════════════════════════════
   ModeIntro — short brand-y entrance overlay shown when a student
   first opens a practice mode in the current session. ~1.1s end-to-end
   so it doesn't delay learning. Plays ONCE per (mode × tab session)
   via sessionStorage — the next mode entry in the same tab is skipped,
   tomorrow's tab gets a fresh intro.

   Visual story (1.1s total):
     0.00–0.18s  Navy backdrop fades in over the practice screen
     0.10–0.45s  Icon scales in with a small overshoot
     0.25–0.55s  Title text slides in from the inline-end (RTL forward)
     0.45–0.75s  Yellow accent underline expands from the title's start
     0.85–1.10s  Whole overlay fades out, revealing the practice beneath
   ═══════════════════════════════════════════════════════════════════ */

const SESSION_PREFIX = 'znk-mode-intro-'

export function shouldShowModeIntro(_modeId: string): boolean {
  /* Per the latest student-facing requirement, the brand mode-intro
     animation should ALWAYS play when entering a practice or game —
     not just on the first visit per tab session. The previous
     sessionStorage-gated behaviour skipped the intro on subsequent
     entries within the same session, which the team wants reverted.
     We still call markModeIntroSeen() inside ModeIntro so that other
     consumers / analytics can observe whether the student has been
     exposed to the intro at least once, but the visibility gate is
     no longer driven by it. */
  return true
}

function markModeIntroSeen(modeId: string): void {
  try { sessionStorage.setItem(SESSION_PREFIX + modeId, '1') } catch { /* ok */ }
}

interface ModeIntroProps {
  /** Stable id used as the sessionStorage key (e.g., 'flashcards', 'exam-sc'). */
  modeId: string
  /** Hebrew display title shown center-stage. */
  title: string
  /** Either an emoji string OR a relative asset path to a PNG. */
  icon: string
  /** Brand accent color for the underline glow. Defaults to ZNK yellow. */
  accentColor?: string
  /** Optional secondary line under the title (mode subtitle). */
  subtitle?: string
  /** Fired after the intro fully finishes its exit. Parent should mount the
   *  practice content only after this fires (or render it under and let the
   *  intro fade out on top). */
  onComplete: () => void
}

export function ModeIntro({
  modeId,
  title,
  icon,
  accentColor = '#FFE600',
  subtitle,
  onComplete,
}: ModeIntroProps) {
  const [visible, setVisible] = useState(true)

  // Mark seen on mount — even if the student backs out mid-intro, we
  // shouldn't replay it on the next entry within the same session.
  // Also fire a brand intro sound (respects the SFX mute toggle), and
  // signal to the rest of the app that an intro is on screen so the
  // practice timer / auto-TTS / instructions modal can hold off until
  // the animation finishes.
  useEffect(() => {
    markModeIntroSeen(modeId)
    try { playSound('sessionStart') } catch { /* ok */ }
    pushModeIntroActive()
    // Stop any in-flight TTS and prevent auto-TTS hooks from kicking in
    // while the intro is on screen — same pattern InstructionsOverlay
    // already uses for first-time instruction modals.
    const setGatedByOverlay = useTTSSettingsStore.getState().setGatedByOverlay
    setGatedByOverlay(true)
    try { stopAllTTS() } catch { /* ok */ }
    return () => {
      popModeIntroActive()
      // Small grace period so a freshly mounting practice doesn't snap-play
      // an auto-TTS exactly as the intro is fading out — matches the same
      // 260ms grace window the instructions overlay uses on close.
      setTimeout(() => setGatedByOverlay(false), 260)
    }
  }, [modeId])

  // Fixed timeline: hold for 2500ms, then trigger exit. Total visible
  // window is ~2.75s including the 250ms fade-out.
  useEffect(() => {
    const hold = setTimeout(() => setVisible(false), 2500)
    return () => clearTimeout(hold)
  }, [])

  // Decide whether icon is an emoji vs an image path. Bare emojis are
  // 1-2 chars and don't contain '/' or '.'.
  const isImagePath = /[/.]/.test(icon)

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {visible && (
        <motion.div
          key="mode-intro"
          role="presentation"
          aria-hidden="true"
          /* Backdrop appears INSTANTLY (initial: 1) so the game UI
             beneath never flashes through during a fade-in. The exit
             still fades out via the transition + exit prop. */
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          onClick={() => setVisible(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background:
              'radial-gradient(ellipse at center, #0d294b 0%, #050a18 70%, #000 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            // Soft inner glow tinted toward the mode's accent.
            boxShadow: `inset 0 0 140px 60px ${hexToRgba(accentColor, 0.15)}`,
          }}
        >
          <div
            dir="rtl"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 18,
              padding: 24,
              maxWidth: '90%',
            }}
          >
            {/* Icon — scales in with a tiny overshoot */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1], delay: 0.10 }}
              style={{
                width: 132,
                height: 132,
                borderRadius: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: hexToRgba(accentColor, 0.14),
                border: `2.5px solid ${hexToRgba(accentColor, 0.5)}`,
                boxShadow: `0 16px 40px ${hexToRgba(accentColor, 0.35)}, inset 0 1px 0 rgba(255,255,255,0.08)`,
                fontSize: 64,
                lineHeight: 1,
              }}
            >
              {isImagePath ? (
                /* The `icon` path that consumers pass already comes through
                   `asset()` in their config (see GAME_CONFIGS in
                   src/features/vocabulary/games/constants.ts), so this
                   <img> uses it as-is. The previous code wrapped it in
                   asset() AGAIN, which double-prefixed Vite's BASE_URL
                   ("/test/") and produced broken URLs like
                   "/test/test/znk-icon-08.png" — the reason students saw
                   a broken image in the LearnMode / AdaptivePractice
                   intro. */
                <img
                  src={icon}
                  alt=""
                  style={{ width: '74%', height: '74%', objectFit: 'contain' }}
                />
              ) : (
                <span>{icon}</span>
              )}
            </motion.div>

            {/* Title — slides in from inline-end (RTL forward direction) */}
            <motion.div
              initial={{ x: 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.25 }}
              style={{
                fontFamily: "var(--font-display, 'Heebo', system-ui, sans-serif)",
                fontWeight: 900,
                fontSize: 'clamp(28px, 5.4vw, 48px)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                color: '#fff',
                textShadow: '0 2px 24px rgba(0,0,0,0.5)',
                textAlign: 'center',
                position: 'relative',
              }}
            >
              {title}

              {/* Yellow accent underline — expands from origin (RTL: right) */}
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.45 }}
                style={{
                  position: 'absolute',
                  insetInlineStart: 0,
                  insetInlineEnd: 0,
                  bottom: -10,
                  height: 5,
                  borderRadius: 3,
                  background: accentColor,
                  boxShadow: `0 0 24px ${hexToRgba(accentColor, 0.7)}`,
                  transformOrigin: 'right',
                  display: 'block',
                }}
              />
            </motion.div>

            {/* Optional subtitle — fades in last */}
            {subtitle && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 0.78, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut', delay: 0.55 }}
                style={{
                  fontFamily: "var(--font-display, 'Heebo', system-ui, sans-serif)",
                  fontWeight: 600,
                  fontSize: 'clamp(13px, 2.2vw, 18px)',
                  color: 'rgba(255,255,255,0.78)',
                  marginTop: 14,
                  textAlign: 'center',
                  letterSpacing: '0.01em',
                }}
              >
                {subtitle}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Tiny helper — converts #RRGGBB to rgba(...) without pulling in a lib. */
function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '').match(/.{2}/g)
  if (!m || m.length < 3) return `rgba(255,230,0,${alpha})`
  const [r, g, b] = m.map((h) => parseInt(h, 16))
  return `rgba(${r},${g},${b},${alpha})`
}
