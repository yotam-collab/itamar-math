import { useEffect, useId, useRef, useState, type ReactNode, type CSSProperties } from 'react'

/**
 * Tooltip — wraps any focusable element with a brand-styled hover/focus
 * tooltip. Shows on:
 *  · mouse hover (after 550ms grace, set in tokens.css)
 *  · keyboard focus (fast — assistive-tech students shouldn't wait)
 *  · touch long-press (fired manually on touchstart > 450ms)
 *
 * Hebrew RTL by default. The bubble auto-truncates at 280px / 90vw via
 * the .znk-tip CSS in tokens.css.
 *
 * Usage:
 *   <Tooltip text="לחץ לפתיחת המפה — תראה איפה אתה במסע">
 *     <button>המסע שלך</button>
 *   </Tooltip>
 */

type Placement = 'top' | 'bottom' | 'left' | 'right'
type Variant = 'navy' | 'pink' | 'yellow'

interface TooltipProps {
  /** The Hebrew (or English) text to surface. Plain string keeps a11y simple. */
  text: string
  /** Single child — usually a button or other interactive element. */
  children: ReactNode
  /** Where the bubble appears relative to the host. Defaults to bottom. */
  placement?: Placement
  /** Color theme. Defaults to navy. */
  variant?: Variant
  /** Optional inline style on the wrapper (rare; usually you don't need this). */
  style?: CSSProperties
  /** Optional class on the wrapper. */
  className?: string
  /** Long-press duration in ms for touch devices. Default 450ms. */
  touchHoldMs?: number
}

export function Tooltip({
  text,
  children,
  placement = 'bottom',
  variant = 'navy',
  style,
  className = '',
  touchHoldMs = 450,
}: TooltipProps) {
  const tipId = useId()
  const wrapperRef = useRef<HTMLSpanElement | null>(null)
  const touchTimerRef = useRef<number | null>(null)
  const [touchActive, setTouchActive] = useState(false)

  /* Touch long-press: hold the host for `touchHoldMs` to flip the
     `znk-tip-active` modifier on the wrapper, which the CSS rule reveals
     the same way as :hover. Cancel the timer if the user lifts/scrolls
     before the threshold. Auto-hide 2.5s after release. */
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const startTouch = () => {
      if (touchTimerRef.current) window.clearTimeout(touchTimerRef.current)
      touchTimerRef.current = window.setTimeout(() => {
        setTouchActive(true)
        // Auto-hide after a readable window
        touchTimerRef.current = window.setTimeout(() => setTouchActive(false), 2500)
      }, touchHoldMs)
    }
    const cancelTouch = () => {
      if (touchTimerRef.current) {
        window.clearTimeout(touchTimerRef.current)
        touchTimerRef.current = null
      }
    }

    el.addEventListener('touchstart', startTouch, { passive: true })
    el.addEventListener('touchend', cancelTouch)
    el.addEventListener('touchcancel', cancelTouch)
    el.addEventListener('touchmove', cancelTouch)
    return () => {
      el.removeEventListener('touchstart', startTouch)
      el.removeEventListener('touchend', cancelTouch)
      el.removeEventListener('touchcancel', cancelTouch)
      el.removeEventListener('touchmove', cancelTouch)
      if (touchTimerRef.current) window.clearTimeout(touchTimerRef.current)
    }
  }, [touchHoldMs])

  const variantClass = variant === 'pink' ? ' tip-pink' : variant === 'yellow' ? ' tip-yellow' : ''
  const activeClass = touchActive ? ' znk-tip-active' : ''

  return (
    <span
      ref={wrapperRef}
      className={`znk-tooltip${activeClass} ${className}`.trim()}
      style={style}
    >
      {/* Wrap the child so it gets aria-describedby pointing at the tip.
          Using a span wrapper keeps the host's own click semantics intact —
          buttons stay buttons, links stay links. */}
      <span className="znk-tooltip-host" aria-describedby={tipId}>
        {children}
      </span>
      <span
        id={tipId}
        role="tooltip"
        className={`znk-tip${variantClass}`}
        data-placement={placement}
      >
        {text}
      </span>
    </span>
  )
}
