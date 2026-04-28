import { useNavigate, useParams } from 'react-router-dom'
import { useVocabStore } from '../../stores/vocabStore'
import { GAME_CONFIGS } from './games/constants'
import type { GameId } from './games/types'

/* ---- Light-mode palette (matches VocabHome) ---- */
const CARD_BG = '#FFFFFF'
const ACCENT = '#6366F1'
const SECONDARY = '#8B5CF6'
const TEXT = '#1E293B'
const MUTED = '#94A3B8'
const CORRECT = '#22C55E'
const S = {
  card: '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
}

const UNIT_MODES: { gameId: GameId; label: string; icon: string; gradient: string; shadow: string; tooltip: string }[] = [
  {
    gameId: 'flashcards',
    label: 'כרטיסיות היכרות 🃏',
    icon: '🃏',
    gradient: 'linear-gradient(135deg, #34D399, #059669)',
    shadow: 'rgba(16,185,129,0.35)',
    tooltip: 'הפוך כרטיסיה — אנגלית בצד אחד, עברית בשני. החלקה עם האגודל קובעת',
  },
  {
    gameId: 'learnMode',
    label: 'שינון מילים חדשות 📖',
    icon: '📖',
    gradient: 'linear-gradient(135deg, #FF6B9D, #EE2B73)',
    shadow: 'rgba(238,43,115,0.35)',
    tooltip: 'למידה רגועה — מילה, תרגום, משפט והקראה. הקצב שלך, אין לחץ',
  },
  {
    gameId: 'adaptivePractice',
    label: 'תרגול אדפטיבי 🎯',
    icon: '🎯',
    gradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
    shadow: 'rgba(245,158,11,0.35)',
    tooltip: 'המערכת בוחרת את סוג התרגול שהכי יעזור לך עכשיו',
  },
  {
    gameId: 'gravity',
    label: 'שליפה מהירה ⚡',
    icon: '⚡',
    gradient: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    shadow: 'rgba(139,92,246,0.35)',
    tooltip: 'מילים נופלות — תפוס אותן לפני שיגיעו לקרקע',
  },
]

export function UnitModePicker() {
  const navigate = useNavigate()
  const { unitNum } = useParams<{ unitNum: string }>()
  const unit = Number(unitNum) || 1
  const { getWordsForUnit, getUnitProgress } = useVocabStore()

  const unitWords = getWordsForUnit(unit)
  const progress = getUnitProgress(unit)

  const handleModeClick = (gameId: GameId) => {
    navigate(`/vocabulary/games/${gameId}?unit=${unit}`)
  }

  if (unitWords.length === 0) {
    return (
      <div className="space-y-6 animate-fadeIn pb-4" dir="rtl">
        <div
          className="text-center py-12"
          style={{ background: CARD_BG, boxShadow: S.card, borderRadius: 32 }}
        >
          <p className="text-lg mb-4" style={{ color: MUTED }}>
            יחידה לא נמצאה
          </p>
          <button
            className="px-6 py-3 rounded-xl font-bold text-sm transition-[transform,box-shadow,background-color,border-color,opacity] hover:scale-[1.02]"
            style={{
              background: ACCENT,
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
            }}
            onClick={() => navigate('/vocabulary/units')}
          >
            חזרה ליחידות
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fadeIn pb-6" dir="rtl">
      {/* Header */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #2D1B69 0%, #4F4780 40%, #7B5EA7 70%, #C084FC 100%)',
          boxShadow: '0 8px 30px rgba(45, 27, 105, 0.3)',
          borderRadius: 24,
          padding: '24px 24px 28px',
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -30, left: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -15, right: -15, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <h2
              className="font-extrabold text-2xl"
              style={{ color: '#fff', fontFamily: 'var(--font-display)' }}
            >
              יחידה {unit}
            </h2>
            <button
              className="px-4 py-2 rounded-xl font-bold text-xs transition-[transform,box-shadow,background-color,border-color,opacity] hover:scale-[1.03]"
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                backdropFilter: 'blur(4px)',
              }}
              onClick={() => navigate('/vocabulary/units')}
            >
              ← חזרה ליחידות
            </button>
          </div>

          <p
            className="text-sm mb-4"
            style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-body)' }}
          >
            {unitWords.length} מילים · {progress.mastered} נלמדו
          </p>

          {/* Progress bar */}
          <div
            className="w-full h-2.5 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.15)' }}
            dir="ltr"
          >
            <div
              className="h-full rounded-full transition-[transform,box-shadow,background-color,border-color,opacity] duration-300 var(--ease-out)"
              style={{
                width: `${progress.pct}%`,
                background: progress.pct === 100
                  ? CORRECT
                  : 'linear-gradient(90deg, #818CF8, #C084FC)',
              }}
            />
          </div>
          <p
            className="text-xs mt-2"
            style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-body)' }}
          >
            {progress.pct === 100 ? '🎉 סיימת את היחידה!' : `${progress.mastered} מתוך ${progress.total} מילים`}
          </p>
        </div>
      </div>

      {/* Mode buttons — 2×2 grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
        }}
      >
        {UNIT_MODES.map((mode) => (
          <div
            key={mode.gameId}
            className="flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 hover:-translate-y-1 active:translate-y-0 znk-tooltip"
            style={{
              background: mode.gradient,
              boxShadow: `0 6px 20px ${mode.shadow}`,
              borderRadius: 20,
              padding: '22px 14px',
            }}
            onClick={() => handleModeClick(mode.gameId)}
            role="button"
          >
            <span className="znk-tip" data-placement="top" role="tooltip">{mode.tooltip}</span>
            <span style={{ fontSize: 28 }}>{mode.icon}</span>
            <span
              className="text-sm font-bold text-center leading-tight"
              style={{ color: '#fff', fontFamily: 'var(--font-display)' }}
            >
              {mode.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
