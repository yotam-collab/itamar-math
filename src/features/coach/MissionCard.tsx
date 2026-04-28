// src/features/coach/MissionCard.tsx

import { useState, useEffect, useRef } from 'react'
import type { Mission } from '../../services/mockCoachData'
import { Cards, Target, BookOpenText, ListChecks, Check, Lightning, Brain, Lock } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { playSound } from '../../utils/sounds'
import { g } from '../../utils/gender'

const TYPE_STYLES: Record<string, { bg: string; iconBg: string; textColor: string; PhIcon: Icon }> = {
  vocab_flashcards:  { bg: '#FFF0F5', iconBg: 'linear-gradient(135deg, #EE2B73, #FF6B9D)', textColor: '#C2185B', PhIcon: Cards },
  vocab_adaptive:    { bg: '#FFF0E6', iconBg: 'linear-gradient(135deg, #F59E0B, #F97316)', textColor: '#E65100', PhIcon: Target },
  vocab_learn:       { bg: '#FFF5F0', iconBg: 'linear-gradient(135deg, #E67E22, #F39C12)', textColor: '#D35400', PhIcon: Brain },
  vocab_gravity:     { bg: '#FEF3F2', iconBg: 'linear-gradient(135deg, #DC2626, #EF4444)', textColor: '#B91C1C', PhIcon: Lightning },
  vocab_practice:    { bg: '#FFF0E6', iconBg: 'linear-gradient(135deg, #F59E0B, #F97316)', textColor: '#E65100', PhIcon: Target },
  reading:           { bg: '#F0FDF9', iconBg: 'linear-gradient(135deg, #0D9488, #38B2AC)', textColor: '#0D7377', PhIcon: BookOpenText },
  exam_sc:           { bg: '#F0F0FA', iconBg: 'linear-gradient(135deg, #5B21B6, #8B5CF6)', textColor: '#5B21B6', PhIcon: ListChecks },
  exam_restatement:  { bg: '#F0F0FA', iconBg: 'linear-gradient(135deg, #5B21B6, #8B5CF6)', textColor: '#5B21B6', PhIcon: ListChecks },
}

function playCompletionSound() {
  playSound('correct')
  // Haptic feedback on mobile
  try { navigator.vibrate?.(80) } catch { /* ignore */ }
}

interface Props {
  mission: Mission
  onStart: (mission: Mission) => void
  justCompleted?: boolean
}

export default function MissionCard({ mission, onStart, justCompleted }: Props) {
  const style = TYPE_STYLES[mission.type] || TYPE_STYLES['vocab_flashcards']
  const isDone = mission.status === 'completed'
  const isLocked = mission.status === 'locked'
  const [animating, setAnimating] = useState(false)
  const [showLockedTip, setShowLockedTip] = useState(false)
  const hasAnimated = useRef(false)
  const lockedTipTimerRef = useRef<number | null>(null)

  // Play completion animation when justCompleted changes
  useEffect(() => {
    if (justCompleted && isDone && !hasAnimated.current) {
      hasAnimated.current = true
      setAnimating(true)
      playCompletionSound()
      const timer = setTimeout(() => setAnimating(false), 800)
      return () => clearTimeout(timer)
    }
  }, [justCompleted, isDone])

  // Auto-hide the locked-tip bubble after 4s, and clean up on unmount
  useEffect(() => {
    return () => { if (lockedTipTimerRef.current) window.clearTimeout(lockedTipTimerRef.current) }
  }, [])

  const lockedTip = `זה ייפתח ברגע ${g('שתסיים', 'שתסיימי')} את המשימה שמעליו. אנחנו פותחים צעד-צעד כדי שכל דבר ייבנה על קודמיו.`

  const handleLockedTap = () => {
    setShowLockedTip(true)
    // gentle haptic so the student feels the tap registered
    try { navigator.vibrate?.(30) } catch { /* ok */ }
    if (lockedTipTimerRef.current) window.clearTimeout(lockedTipTimerRef.current)
    lockedTipTimerRef.current = window.setTimeout(() => setShowLockedTip(false), 4000)
  }

  return (
    <div style={{ position: 'relative' }}>
    <button
      className={`flex items-center gap-2 w-full text-right rounded-xl border-none transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 relative ${
        isDone ? 'pointer-events-none' : isLocked ? 'cursor-help' : 'active:scale-[0.97]'
      } ${animating ? 'mission-complete-anim' : ''} ${isLocked && showLockedTip ? 'locked-shake' : ''}`}
      aria-label={isLocked ? `${mission.title} — נעול. ${lockedTip}` : undefined}
      aria-describedby={isLocked && showLockedTip ? `locked-tip-${mission.id}` : undefined}
      style={{
        padding: '9px 12px',
        background: isLocked ? (showLockedTip ? '#FEF3C7' : '#F0F0F0') : isDone ? '#F3F4F6' : style.bg,
        fontFamily: "'Heebo', sans-serif",
        fontSize: '12.5px',
        opacity: isLocked ? (showLockedTip ? 0.85 : 0.45) : isDone ? 0.65 : 1,
        transform: animating ? 'scale(0.95)' : undefined,
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        pointerEvents: isDone ? 'none' : 'auto',
        width: '100%',
      }}
      onClick={() => {
        if (isDone) return
        if (isLocked) { handleLockedTap(); return }
        onStart(mission)
      }}
    >
      {/* Icon / Checkmark / Lock */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-[10px] text-white transition-[transform,box-shadow,background-color,border-color,opacity] duration-300"
        style={{
          width: 30, height: 30,
          background: isLocked ? '#D1D5DB' : isDone ? '#10B981' : style.iconBg,
          transform: animating ? 'scale(1.3) rotate(10deg)' : undefined,
          boxShadow: animating ? '0 0 12px rgba(16,185,129,0.5)' : undefined,
        }}
      >
        {isLocked ? (
          <Lock weight="bold" size={14} color="white" />
        ) : isDone ? (
          <Check weight="bold" size={16} color="white" />
        ) : (
          <style.PhIcon weight="fill" size={16} color="white" />
        )}
      </div>

      {/* Title */}
      <div className="flex-1 font-bold" style={{ color: isDone ? '#9CA3AF' : style.textColor }}>
        <span
          className="relative inline-block"
          style={{
            textDecoration: isDone ? 'line-through' : 'none',
            textDecorationColor: '#10B981',
            textDecorationThickness: '2px',
          }}
        >
          {mission.title}
          {/* Animated strikethrough line */}
          {animating && (
            <span
              className="absolute top-1/2 left-0 h-0.5 bg-emerald-500"
              style={{
                animation: 'strikethrough 0.5s ease-out forwards',
                transformOrigin: 'right',
              }}
            />
          )}
        </span>
        <span className="text-[10px] font-normal opacity-60 block">{mission.subtitle}</span>
      </div>

      {/* Time / Done indicator */}
      {!isDone && !isLocked && (
        <>
          <span className="text-[9px] font-bold text-gray-400 flex-shrink-0">~{mission.estimatedMinutes} דק׳</span>
          <span className="text-[13px] opacity-30 flex-shrink-0">←</span>
        </>
      )}
      {isLocked && (
        <span className="text-[9px] font-bold text-gray-400 flex-shrink-0" aria-hidden="true">🔒 נעול</span>
      )}
      {isDone && !animating && (
        <span className="text-[10px] font-bold text-emerald-500 flex-shrink-0">✓</span>
      )}
      {animating && (
        <span
          className="text-[14px] flex-shrink-0"
          style={{ animation: 'popIn 0.4s var(--ease-out)' }}
        >
          ⚡
        </span>
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes strikethrough {
          from { width: 0; }
          to { width: 100%; }
        }
        @keyframes popIn {
          0% { transform: scale(0.95) rotate(-20deg); opacity: 0; }
          60% { transform: scale(1.4) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .mission-complete-anim {
          animation: missionPop 0.6s var(--ease-out);
        }
        @keyframes missionPop {
          0% { transform: scale(1); }
          20% { transform: scale(0.93); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        @keyframes lockedShake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-3px); }
          40% { transform: translateX(3px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
        .locked-shake { animation: lockedShake 0.42s var(--ease-in-out); }
        @keyframes lockedTipIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </button>

    {/* Locked-tip bubble — appears when the student taps a locked mission.
        Positioned below the card, points up with a chevron. Auto-dismisses
        after 4s. Inline so it sits in the same chat bubble flow. */}
    {isLocked && showLockedTip && (
      <div
        id={`locked-tip-${mission.id}`}
        role="status"
        aria-live="polite"
        style={{
          position: 'relative',
          marginTop: 6,
          padding: '10px 12px',
          background: '#FFF8E1',
          border: '1.5px solid #F59E0B',
          borderRadius: 12,
          fontFamily: "'Heebo', sans-serif",
          fontSize: 12,
          lineHeight: 1.45,
          color: '#78350F',
          fontWeight: 500,
          textAlign: 'right',
          direction: 'rtl',
          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.18)',
          animation: 'lockedTipIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Upward-pointing chevron that points at the locked card */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -7,
            right: 24,
            width: 12, height: 12,
            background: '#FFF8E1',
            borderTop: '1.5px solid #F59E0B',
            borderInlineStart: '1.5px solid #F59E0B',
            transform: 'rotate(45deg)',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 15, lineHeight: 1 }} aria-hidden="true">💡</span>
          <div style={{ flex: 1 }}>
            <b style={{ color: '#B45309', fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 2 }}>
              המשימה הזאת עדיין נעולה
            </b>
            <span>{lockedTip}</span>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}
