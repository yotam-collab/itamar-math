import { useCallback } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, LayoutGroup } from 'framer-motion'
import type { Icon } from '@phosphor-icons/react'
import {
  Cards,
  ListChecks,
  Exam,
  BookOpenText,
  ClipboardText,
} from '@phosphor-icons/react'
import { playSound } from '../../utils/sounds'
import { useCoachStore } from '../../stores/coachStore'
import { Tooltip } from '../common/Tooltip'

/* ═══════════════════════════════════════════════════════════════════
   BOTTOM NAV · 5-tab mobile nav with Framer Motion halo pill
   ───────────────────────────────────────────────────────────────────
   Rendered via portal to document.body for iOS 18 resilience. RTL:
   first item in the array is on the VISUAL RIGHT — where the thumb
   naturally lands. Active state is a yellow halo pill that SLIDES
   between tabs via `motion.div layoutId`, paired with the Phosphor
   icon's outline→fill morph.

   Tabs (visual right → left in RTL):
     מילים · שאלות · פרק מלא · קריאה · התוכנית

   Design notes:
   — single-word Hebrew labels at 12px (Hebrew is ~15-20% wider than Latin)
   — NO `transform`/`contain`/`will-change` on any ancestor (breaks iOS 18)
   — Background off-white cream #F4F6F9 (kills dated 2020 neumorphism)
   ═══════════════════════════════════════════════════════════════════ */

interface TabDef {
  path: string
  label: string
  Icon: Icon
  /** Any path in this list (prefix match) also lights up this tab.
   *  Lets sub-routes (e.g. /exam/sc) keep the parent tab active. */
  matches?: string[]
  /** Hover/long-press tooltip — one short Hebrew sentence orienting the
   *  student to what's behind the tab. Surfaces on desktop hover and on
   *  mobile via 450ms long-press. */
  tooltip: string
}

/* 5 tabs · the home destination is reachable via the logo at the top
   of the page (Shell.tsx mobile header), so we don't burn a tab on it. */
const TABS: TabDef[] = [
  {
    path: '/vocabulary',
    label: 'מילים',
    Icon: Cards,
    tooltip: 'אוצר מילים — משחקים, כרטיסיות ומסע השלבים שלך',
  },
  {
    path: '/exam',
    label: 'שאלות',
    Icon: ListChecks,
    matches: ['/exam/sc', '/exam/restatement', '/exam/rc', '/exam/practice'],
    tooltip: 'תרגול שאלות בחינה — השלמה, ניסוח, הבנה',
  },
  {
    path: '/exam/full',
    label: 'פרק מלא',
    Icon: Exam,
    matches: ['/exam/full/start'],
    tooltip: 'פרק בחינה מלא — 22 שאלות, 20 דקות, בתנאי אמת',
  },
  {
    path: '/reading',
    label: 'קריאה',
    Icon: BookOpenText,
    tooltip: 'קטעי קריאה אקדמיים עם שאלות הבנה',
  },
  {
    path: '/journey',
    label: 'התוכנית',
    Icon: ClipboardText,
    tooltip: 'התוכנית שלך — מה לעשות היום ולאן זה מוביל',
  },
]

function tabIsActive(tab: TabDef, pathname: string): boolean {
  // Explicit sub-path matches first (e.g. /exam/sc → "שאלות" tab).
  if (tab.matches && tab.matches.some(m => pathname === m || pathname.startsWith(m + '/'))) return true
  // Exact path match (e.g. /exam/full → "פרק מלא" tab).
  if (pathname === tab.path) return true
  if (tab.path === '/') return false
  // Sub-path match, but defer to a more specific tab if one exists. This
  // prevents `/exam` from lighting up when the user is on `/exam/full`.
  if (pathname.startsWith(tab.path + '/')) {
    const moreSpecific = TABS.some(other =>
      other !== tab &&
      other.path.startsWith(tab.path + '/') &&
      (pathname === other.path || pathname.startsWith(other.path + '/'))
    )
    return !moreSpecific
  }
  return false
}

export function BottomNav() {
  const location = useLocation()
  /* Hide the bottom nav when the coach chat widget is open. The chat
     input lives at the bottom of the panel and was being covered by the
     fixed bottom-nav (z-index 9999 vs panel z-50). When the user closes
     the chat, the nav re-appears. */
  const coachOpen = useCoachStore((s) => s.isOpen)

  const onTabClick = useCallback(() => {
    playSound('click')
    // iOS haptic tick — Safari supports the Vibration API via a short buzz.
    if ('vibrate' in navigator) {
      try { (navigator as Navigator & { vibrate: (ms: number) => void }).vibrate(6) } catch { /* no-op */ }
    }
  }, [])

  const nav = (
    <>
      <nav
        id="znk-mobile-nav"
        className="md:hidden znk-bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 9999,
          background: '#F4F6F9',
          boxShadow: '0 -8px 22px rgba(13,41,75,0.06), 0 -1px 0 rgba(13,41,75,0.08)',
          paddingBottom: 'env(safe-area-inset-bottom, 10px)',
          direction: 'rtl',
          /* CRITICAL: no transform/contain/will-change here. iOS 18 breaks
             fixed positioning if an ancestor or this element itself
             creates a new containing block via transform. */
        }}
        role="navigation"
        aria-label="Primary mobile navigation"
      >
        <style>{bottomNavCSS}</style>
        <LayoutGroup id="znk-bottom-nav-indicator">
          <div className="znk-bn-inner">
            {TABS.map((tab) => {
              const active = tabIsActive(tab, location.pathname)
              /* Tooltips on bottom-nav tabs flip UPWARD (placement="top")
                 so they don't get clipped by the viewport bottom edge.
                 Long-press on mobile reveals the bubble for ~2.5s. */
              return (
                <Tooltip key={tab.path} text={tab.tooltip} placement="top">
                  <NavLink
                    to={tab.path}
                    end={tab.path === '/'}
                    onClick={onTabClick}
                    className={`znk-bn-tab ${active ? 'active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="znk-bn-inner-wrap">
                      {active && (
                        <motion.span
                          className="znk-bn-halo"
                          layoutId="znk-bn-halo"
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          aria-hidden="true"
                        />
                      )}
                      <span className="znk-bn-icon" aria-hidden="true">
                        <tab.Icon weight={active ? 'fill' : 'regular'} size={22} />
                      </span>
                    </span>
                    <span className="znk-bn-label">{tab.label}</span>
                  </NavLink>
                </Tooltip>
              )
            })}
          </div>
        </LayoutGroup>
      </nav>

      {/* Spacer below main content to clear the fixed bar.
          Height covers bar (64) + safe-area. */}
      <div
        className="md:hidden"
        style={{ height: 'calc(72px + env(safe-area-inset-bottom, 10px))' }}
        aria-hidden="true"
      />
    </>
  )

  /* While the coach chat is open, render NOTHING — the spacer too is
     dropped so the chat panel can claim the full bottom of the screen
     and the chat input stays unobstructed. */
  if (coachOpen) return null

  return createPortal(nav, document.body)
}

/* CSS namespaced under .znk-bn-* — kept as a string so Shell.tsx edits
   don't need a separate CSS module. Using .md:hidden on the <nav> keeps
   the portal invisible on desktop without extra media queries. */
const bottomNavCSS = `
.znk-bn-inner{
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: stretch;
  max-width: 520px;
  margin: 0 auto;
  padding: 8px 8px 6px;
}
.znk-bn-tab{
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px;
  padding: 4px 2px 2px;
  min-height: 56px;
  background: transparent; border: 0;
  font-family: inherit; cursor: pointer;
  color: #6B7280;
  text-decoration: none;
  transition: color 200ms cubic-bezier(0.23, 1, 0.32, 1);
  -webkit-tap-highlight-color: transparent;
}
.znk-bn-tab.active{ color: #0d294b; }
.znk-bn-tab:active{ transform: scale(0.95); transition-duration: 100ms; }

.znk-bn-inner-wrap{
  position: relative;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 5px 14px;
  min-width: 58px;
  min-height: 32px;
}
.znk-bn-halo{
  position: absolute; inset: 0;
  background: rgba(255,230,0,0.22);
  border-radius: 999px;
  box-shadow: 0 2px 6px rgba(255,184,0,0.22);
  z-index: 0;
}
.znk-bn-icon{
  position: relative; z-index: 1;
  display: inline-flex; align-items: center; justify-content: center;
  transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
}
.znk-bn-tab.active .znk-bn-icon{ transform: translateY(-1px); }

.znk-bn-label{
  font-size: 12px;
  font-weight: 600;
  color: inherit;
  line-height: 1;
  letter-spacing: -0.005em;
  font-family: var(--font-display, inherit);
  transition: font-weight 200ms;
}
.znk-bn-tab.active .znk-bn-label{ font-weight: 800; }

/* Reduced motion — skip the spring slide. */
@media (prefers-reduced-motion: reduce){
  .znk-bn-halo{ transition: none; }
  .znk-bn-tab:active{ transform: none; }
}
`
