import { useEffect, useRef, useState } from 'react'
import { asset } from '../../utils/assetUrl'

/**
 * Decide whether the splash should show on this app boot.
 * Per user direction (2026-04-28): show on EVERY load. Each cold start —
 * full reload, fresh tab, native-app open — gets the brand intro. Soft
 * navigation between routes inside the SPA does NOT re-show, because
 * App.tsx only mounts the splash on its initial render.
 */
export function shouldShowSplash(): boolean {
  return true
}

interface SplashScreenProps {
  /** Called once when the splash finishes (video ended OR timeout fallback). */
  onDone: () => void
}

/**
 * Brand intro splash. Plays a 3.5s burst animation rendered via HyperFrames
 * (yellow flash → logo bursts in with overshoot → sparkle radial → tagline
 * reveal → fade out). Two MP4 variants live in /public/splash/:
 *   - desktop.mp4 (1920×1080) for landscape viewports
 *   - mobile.mp4 (1080×1920) for portrait viewports
 *
 * Picks the variant on first render based on viewport orientation. The
 * video is muted + autoplay so it works without a user gesture (browsers
 * allow autoplay for muted media). A 4-second hard timeout fallback fires
 * `onDone` even if the video fails to load — students should never get
 * stuck on a black screen.
 */
export function SplashScreen({ onDone }: SplashScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [done, setDone] = useState(false)

  // Pick the variant ONCE on mount so it doesn't flicker if the user
  // happens to rotate mid-playback.
  const [src] = useState(() => {
    const isPortrait = typeof window !== 'undefined'
      && window.matchMedia('(orientation: portrait)').matches
    return asset(isPortrait ? 'splash/mobile.mp4' : 'splash/desktop.mp4')
  })

  // Hard timeout fallback. The composition is 3.5s, but if the browser
  // silently blocks autoplay (which is the most common reason students
  // reported "delay then nothing") we want to bail out FAST so the app
  // becomes usable instead of staring at a frozen splash. 2.5s = enough
  // for slow LTE to start streaming if it's going to start at all.
  useEffect(() => {
    if (done) return
    const t = window.setTimeout(() => finish(), 2500)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  const finish = () => {
    if (done) return
    setDone(true)
    // Defer onDone by one frame so the fade-out CSS transition can start.
    requestAnimationFrame(() => onDone())
  }

  // Allow a tap to skip — if a returning student knows what's coming.
  const handleSkip = () => finish()

  return (
    <div
      onClick={handleSkip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#0d294b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        opacity: done ? 0 : 1,
        transition: 'opacity 250ms ease-out',
        pointerEvents: done ? 'none' : 'auto',
      }}
      aria-label="זינוק"
    >
      {/* Visible fallback behind the video — if the MP4 fails to load
          or autoplay is blocked, the student sees the brand mark instead
          of a black void. The video sits on top with `objectFit: cover`,
          so when the video plays it fully obscures this layer. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
          color: '#FFE600',
          fontFamily: "var(--font-display, 'Heebo', system-ui, sans-serif)",
          fontWeight: 900,
          letterSpacing: '0.02em',
        }}
      >
        <span style={{ fontSize: 56, lineHeight: 1 }}>זינוק</span>
        <span style={{ fontSize: 14, opacity: 0.78, fontWeight: 700, letterSpacing: '0.18em' }}>
          AMIRNET · בטעינה
        </span>
      </div>
      <video
        ref={videoRef}
        src={src}
        muted
        autoPlay
        playsInline
        preload="auto"
        onPlay={(e) => {
          // Browsers block unmuted autoplay without a recent user gesture.
          // We still TRY to unmute right after playback starts: many returning
          // students have an existing media-engagement score for this origin
          // and the unmute succeeds silently. If it fails, we just keep the
          // video muted — no error surface, no broken UX.
          const v = e.currentTarget
          try { v.muted = false; v.volume = 0.85 } catch { /* keep muted */ }
        }}
        onEnded={finish}
        onError={(e) => {
          // Surface video-load failures in the console so they're visible
          // during QA / Sentry — the previous silent fallback was the
          // "delay, then nothing" symptom students reported. We still
          // call finish() so the app proceeds without a stuck splash.
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn('[SplashScreen] video failed to load:', src, (e.currentTarget as HTMLVideoElement).error)
          }
          finish()
        }}
        onCanPlay={(e) => {
          // Manually nudge play() — Safari occasionally ignores autoPlay
          // even with muted+playsInline when memory is tight. If play()
          // is rejected (autoplay policy, user gesture missing, etc.)
          // we finish IMMEDIATELY rather than letting the user stare at
          // a frozen splash for the full timeout window.
          const v = e.currentTarget
          if (v.paused) {
            v.play().catch(() => { finish() })
          }
        }}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </div>
  )
}
