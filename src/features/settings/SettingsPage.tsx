import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudentProfileStore } from '../../stores/studentProfileStore'
import { g } from '../../utils/gender'
import { playSound } from '../../utils/sounds'
import { ArrowLeft, CalendarBlank, GraduationCap, TrashSimple, Warning } from '@phosphor-icons/react'
import { SoundSettingsCard } from '../../components/common/SoundControls'

const BG = '#E0E5EC'
const TEXT = '#3D4852'
const MUTED = '#6B7280'
const ACCENT = '#7C3AED'
const DANGER = '#EF4444'

const S = {
  extruded: '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)',
  extrudedSm: '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)',
  inset: 'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)',
}

function formatDate(iso: string | null): string {
  if (!iso) return 'לא נקבע'
  if (iso === 'none') return 'לא עושה קורס'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function SettingsPage() {
  const navigate = useNavigate()
  const profile = useStudentProfileStore()
  const { examDate, psychoCourseDate, updateProfile } = profile

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [editingExam, setEditingExam] = useState(false)
  const [editingPsycho, setEditingPsycho] = useState(false)
  const [examUnknown, setExamUnknown] = useState(!examDate)
  const [psychoOption, setPsychoOption] = useState<'date' | 'unknown' | 'none'>(
    psychoCourseDate === 'none' ? 'none' : psychoCourseDate ? 'date' : 'unknown'
  )

  const today = new Date().toISOString().split('T')[0]

  const handleExamDateChange = (value: string) => {
    updateProfile({ examDate: value })
    setExamUnknown(false)
    setEditingExam(false)
    playSound('correct')
  }

  const handleExamUnknown = () => {
    updateProfile({ examDate: null })
    setExamUnknown(true)
    setEditingExam(false)
    playSound('correct')
  }

  const handlePsychoSave = (option: 'date' | 'unknown' | 'none', date?: string) => {
    setPsychoOption(option)
    if (option === 'none') {
      updateProfile({ psychoCourseDate: 'none' })
    } else if (option === 'unknown') {
      updateProfile({ psychoCourseDate: null })
    } else if (date) {
      updateProfile({ psychoCourseDate: date })
    }
    setEditingPsycho(false)
    playSound('correct')
  }

  const handleReset = () => {
    localStorage.clear()
    sessionStorage.clear()
    window.location.href = window.location.pathname + '#/'
    window.location.reload()
  }

  return (
    <div style={{ background: BG, minHeight: '100vh' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 mb-6"
        style={{ padding: '8px 0' }}
      >
        <button
          onClick={() => navigate(-1)}
          onMouseEnter={() => playSound('hover')}
          className="flex items-center justify-center rounded-xl border-none cursor-pointer transition-transform hover:-translate-x-1"
          style={{
            width: 40, height: 40, background: BG,
            boxShadow: S.extrudedSm, color: MUTED,
          }}
        >
          <ArrowLeft weight="bold" size={20} />
        </button>
        <h1
          style={{
            fontSize: 24, fontWeight: 900, color: TEXT,
            fontFamily: 'var(--font-display)', margin: 0,
          }}
        >
          ⚙️ הגדרות
        </h1>
      </div>

      <div className="flex flex-col gap-4" style={{ maxWidth: 600 }}>

        {/* ── Card 1: Exam Date ── */}
        <div
          className="rounded-2xl"
          style={{ background: BG, boxShadow: S.extruded, padding: '20px 24px' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #EE2B73, #FF6B9D)' }}
            >
              <CalendarBlank weight="fill" size={20} color="white" />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: TEXT, fontFamily: 'var(--font-display)', margin: 0 }}>
              תאריך הבחינה באנגלית
            </h2>
          </div>

          {!editingExam ? (
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 15, color: examUnknown ? MUTED : TEXT, fontWeight: 600 }}>
                {examUnknown ? `עדיין לא ${g('יודע', 'יודעת')}` : formatDate(examDate)}
              </span>
              <button
                onClick={() => setEditingExam(true)}
                onMouseEnter={() => playSound('hover')}
                className="rounded-xl border-none cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] active:scale-95"
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 700,
                  background: BG, boxShadow: S.extrudedSm, color: ACCENT,
                  fontFamily: 'var(--font-display)',
                }}
              >
                שינוי
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <input
                type="date"
                min={today}
                defaultValue={examDate || ''}
                onChange={(e) => e.target.value && handleExamDateChange(e.target.value)}
                className="rounded-xl border-none text-center"
                style={{
                  padding: '10px 16px', fontSize: 16, fontWeight: 600,
                  background: BG, boxShadow: S.inset, color: TEXT,
                  fontFamily: 'var(--font-body)',
                }}
              />
              <button
                onClick={handleExamUnknown}
                onMouseEnter={() => playSound('hover')}
                className="rounded-xl border-none cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] active:scale-95"
                style={{
                  padding: '10px', fontSize: 13, fontWeight: 600,
                  background: BG, boxShadow: S.extrudedSm, color: MUTED,
                }}
              >
                🤷 עדיין לא {g('יודע', 'יודעת')}
              </button>
            </div>
          )}
        </div>

        {/* ── Card 2: Psychometric Course ── */}
        <div
          className="rounded-2xl"
          style={{ background: BG, boxShadow: S.extruded, padding: '20px 24px' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #5B21B6, #8B5CF6)' }}
            >
              <GraduationCap weight="fill" size={20} color="white" />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: TEXT, fontFamily: 'var(--font-display)', margin: 0 }}>
              קורס פסיכומטרי
            </h2>
          </div>

          {!editingPsycho ? (
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 15, color: psychoOption === 'date' ? TEXT : MUTED, fontWeight: 600 }}>
                {psychoOption === 'none'
                  ? 'לא עושה קורס'
                  : psychoOption === 'unknown'
                    ? `עדיין לא ${g('יודע', 'יודעת')} מתי`
                    : `מתחיל ${formatDate(psychoCourseDate)}`}
              </span>
              <button
                onClick={() => setEditingPsycho(true)}
                onMouseEnter={() => playSound('hover')}
                className="rounded-xl border-none cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] active:scale-95"
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 700,
                  background: BG, boxShadow: S.extrudedSm, color: ACCENT,
                  fontFamily: 'var(--font-display)',
                }}
              >
                שינוי
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div
                className="rounded-xl cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] active:scale-[0.98]"
                style={{
                  padding: '12px 16px', fontSize: 14, fontWeight: 600,
                  background: psychoOption === 'date' ? '#F3E8FF' : BG,
                  boxShadow: psychoOption === 'date' ? S.inset : S.extrudedSm,
                  color: TEXT, textAlign: 'center',
                }}
                onClick={() => setPsychoOption('date')}
              >
                🗓️ כן, הקורס מתחיל ב...
              </div>
              {psychoOption === 'date' && (
                <input
                  type="date"
                  min={today}
                  defaultValue={psychoCourseDate && psychoCourseDate !== 'none' ? psychoCourseDate : ''}
                  onChange={(e) => e.target.value && handlePsychoSave('date', e.target.value)}
                  className="rounded-xl border-none text-center"
                  style={{
                    padding: '10px 16px', fontSize: 16, fontWeight: 600,
                    background: BG, boxShadow: S.inset, color: TEXT,
                    fontFamily: 'var(--font-body)',
                  }}
                />
              )}
              <button
                onClick={() => handlePsychoSave('unknown')}
                onMouseEnter={() => playSound('hover')}
                className="rounded-xl border-none cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] active:scale-95"
                style={{
                  padding: '10px', fontSize: 13, fontWeight: 600,
                  background: psychoOption === 'unknown' ? '#F3E8FF' : BG,
                  boxShadow: S.extrudedSm, color: MUTED,
                }}
              >
                🤷 כן, אבל עדיין לא {g('יודע', 'יודעת')} מתי
              </button>
              <button
                onClick={() => handlePsychoSave('none')}
                onMouseEnter={() => playSound('hover')}
                className="rounded-xl border-none cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] active:scale-95"
                style={{
                  padding: '10px', fontSize: 13, fontWeight: 600,
                  background: psychoOption === 'none' ? '#F3E8FF' : BG,
                  boxShadow: S.extrudedSm, color: MUTED,
                }}
              >
                ✌️ אני לא עושה קורס פסיכומטרי
              </button>
            </div>
          )}
        </div>

        {/* ── Card: Sound & Music ── */}
        <SoundSettingsCard />

        {/* ── Card 3: Reset Progress ── */}
        <div
          className="rounded-2xl"
          style={{ background: BG, boxShadow: S.extruded, padding: '20px 24px' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #EF4444, #F97316)' }}
            >
              <TrashSimple weight="fill" size={20} color="white" />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: TEXT, fontFamily: 'var(--font-display)', margin: 0 }}>
              איפוס התקדמות
            </h2>
          </div>

          <p style={{ fontSize: 13, color: MUTED, marginBottom: 12, lineHeight: 1.5 }}>
            איפוס מלא של כל ההתקדמות — כולל ציונים, מילים, רצפים, והשאלון הראשוני. תחזור למסך ההתחלה.
          </p>

          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              onMouseEnter={() => playSound('hover')}
              className="w-full rounded-xl border-none cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] active:scale-95 znk-tooltip"
              style={{
                padding: '12px', fontSize: 14, fontWeight: 700,
                background: BG, boxShadow: S.extrudedSm,
                color: DANGER, fontFamily: 'var(--font-display)',
              }}
            >
              <span className="znk-tip tip-pink" data-placement="top" role="tooltip">
                ⚠️ זה ימחק את כל ההתקדמות — ציונים, מילים, רצפים. לא הפיך
              </span>
              🗑️ איפוס מלא
            </button>
          ) : (
            <div
              className="rounded-xl flex flex-col gap-3"
              style={{
                padding: '16px', background: '#FEF2F2',
                border: `2px solid ${DANGER}`,
              }}
            >
              <div className="flex items-center gap-2">
                <Warning weight="fill" size={20} color={DANGER} />
                <span style={{ fontSize: 14, fontWeight: 700, color: DANGER }}>
                  {g('בטוח', 'בטוחה')}? זה לא הפיך!
                </span>
              </div>
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
                כל ההתקדמות תימחק — ציונים, מילים שנלמדו, נקודות זינוק, רצפים, וגם תצטרך למלא שוב את השאלון.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex-1 rounded-xl border-none cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] active:scale-95 text-white"
                  style={{
                    padding: '10px', fontSize: 13, fontWeight: 700,
                    background: DANGER, fontFamily: 'var(--font-display)',
                  }}
                >
                  כן, {g('אפס', 'אפסי')} הכל
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  onMouseEnter={() => playSound('hover')}
                  className="flex-1 rounded-xl border-none cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] active:scale-95"
                  style={{
                    padding: '10px', fontSize: 13, fontWeight: 700,
                    background: BG, boxShadow: S.extrudedSm, color: MUTED,
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
