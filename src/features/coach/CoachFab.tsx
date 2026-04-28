// src/features/coach/CoachFab.tsx

import { useCoachStore } from '../../stores/coachStore'

export default function CoachFab() {
  const { isOpen, unreadCount, openWidget } = useCoachStore()

  if (isOpen) return null

  return (
    <button
      onClick={openWidget}
      /* znk-tooltip on the button itself (not a wrapper span) — the FAB
         is position:fixed so a wrapper would put the tooltip at the
         span's normal-flow location, not next to the visible FAB. */
      className="fixed z-50 flex items-center justify-center transition-[transform,box-shadow,background-color,border-color,opacity] duration-300 znk-tooltip"
      style={{
        bottom: 80,
        left: 16,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #1B3A6B, #6B3FA0)',
        border: '3px solid rgba(255,255,255,0.3)',
        boxShadow: '0 6px 24px rgba(27,58,107,0.35), 0 2px 6px rgba(0,0,0,0.15)',
      }}
      aria-label="פתח צ'אט מאמן"
    >
      {/* Hover/focus tooltip — placed to the RIGHT of the FAB so it
          opens away from the screen edge in RTL layouts. */}
      <span className="znk-tip tip-pink" data-placement="right" role="tooltip">
        צ׳אט עם המאמן שלך — שאלות, תכנון ומוטיבציה
      </span>
      <img
        src="znk-logo-clean.png"
        alt="זינוק"
        className="rounded-full"
        style={{ width: 34, height: 34 }}
      />
      {unreadCount > 0 && (
        <span
          className="absolute flex items-center justify-center text-white font-extrabold"
          style={{
            top: -3, right: -3,
            width: 22, height: 22,
            borderRadius: '50%',
            background: '#E91E78',
            fontSize: 11,
            border: '2px solid #E0E5EC',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          {unreadCount}
        </span>
      )}
    </button>
  )
}
