/**
 * Unified exam practice component for mission-based sessions.
 * Sequences SC → Restatement → RC questions in a single session.
 * Reads question counts from URL params (?sc=6&rest=3&rc=4).
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useExamStore } from '../../stores/examStore'
import { useGamificationStore } from '../../stores/gamificationStore'
import { useStudentProfileStore } from '../../stores/studentProfileStore'
import { SpeakerBtn, TTSSpeedBtn } from '../../utils/tts'
import { ClickableEnglishText } from '../../components/common/ClickableEnglishText'
import { playSound } from '../../utils/sounds'
import { onSCWrongAnswer, onRestatementWrongAnswer, onRCWrongAnswer } from '../../utils/wordDetection'
import { recordError, recordAnswer, onSessionComplete, selectQuestionsByElo, selectPassageByElo } from '../../utils/examHelpers'
import { asset } from '../../utils/assetUrl'
import { g } from '../../utils/gender'
import scData from '../../data/exam/sentence-completion.json'
import restData from '../../data/exam/restatements.json'
import rcData from '../../data/exam/reading-comprehension.json'
import { ExamResultScreen, type ExamQuestionType, type WrongQuestion, type ReviewQuestion } from './ExamResultScreen'
import { useGameStatsStore } from '../../stores/gameStatsStore'
import { ExamModeIntro } from '../../components/common/ExamModeIntro'

const S = {
  extruded: '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)',
  extrudedSm: '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)',
  inset: 'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)',
  insetDeep: 'inset 10px 10px 20px rgb(163,177,198,0.7), inset -10px -10px 20px rgba(255,255,255,0.6)',
} as const

const BG = '#E0E5EC'
const ACCENT = '#6C63FF'
const SECONDARY = '#38B2AC'
const TEXT = '#3D4852'
const MUTED = '#6B7280'
const CORRECT = '#10B981'
const WRONG = '#EF4444'

// ── Types ────────────────────────────────────────────────────────────────────

interface SCQuestion { id: string; sentence: string; options: string[]; correct: number; explanation: { mambal: string; translations: string[]; fullTranslation: string; optionAnalysis?: string[] } }
interface RestQuestion { id: string; sentence: string; options: string[]; correct: number; explanation: { sentenceTranslation: string; optionAnalysis: string[] } }
interface RCQuestion { id: string; question: string; options: string[]; correct: number; explanation: string | { questionTranslation: string; optionAnalysis: string[] } }
interface RCPassage { id: string; title: string; passage: string; questions: RCQuestion[] }

type MixedQuestion =
  | { qType: 'sc'; data: SCQuestion }
  | { qType: 'restatement'; data: RestQuestion }
  | { qType: 'rc'; data: RCQuestion; passage: RCPassage }

const SECTION_META = {
  sc: { icon: '✏️', label: 'השלמת משפטים', color: '#EC4899' },
  restatement: { icon: '🔄', label: 'ניסוח מחדש', color: '#8B5CF6' },
  rc: { icon: '📖', label: 'הבנת הנקרא', color: '#14B8A6' },
}

// ── Default allocation by student profile ────────────────────────────────────
function getDefaultAllocation(): { sc: number; rest: number; rc: number } {
  try {
    const state = useStudentProfileStore.getState()
    const elo = state.examElo || 1000
    const dailyMinutes = state.dailyMinutes || 30
    if (elo < 900 || dailyMinutes < 20) return { sc: 3, rest: 2, rc: 3 }
    if (elo < 1100 || dailyMinutes < 30) return { sc: 5, rest: 3, rc: 4 }
    return { sc: 6, rest: 4, rc: 5 }
  } catch { return { sc: 5, rest: 3, rc: 4 } }
}

// ── Component ────────────────────────────────────────────────────────────────

export function ExamMissionPractice() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { addAttempt } = useExamStore()
  const { addXP, checkStreak } = useGamificationStore()

  // Read counts from URL or use smart defaults (with validation)
  const defaults = useMemo(getDefaultAllocation, [])
  const scCount = Math.max(0, Math.min(30, Math.floor(Number(searchParams.get('sc') || defaults.sc)) || 0))
  const restCount = Math.max(0, Math.min(30, Math.floor(Number(searchParams.get('rest') || defaults.rest)) || 0))
  const rcCount = Math.max(0, Math.min(30, Math.floor(Number(searchParams.get('rc') || defaults.rc)) || 0))

  // Build question queue: SC → REST → RC
  const { questions, rcPassageData } = useMemo(() => {
    const examElo = useStudentProfileStore.getState().examElo || 1000
    const readingElo = useStudentProfileStore.getState().readingElo || 1000
    const queue: MixedQuestion[] = []

    // SC
    if (scCount > 0) {
      const pool = selectQuestionsByElo(scData as SCQuestion[], examElo, scCount)
      pool.forEach(q => queue.push({ qType: 'sc', data: q }))
    }
    // Restatement
    if (restCount > 0) {
      const pool = selectQuestionsByElo(restData as RestQuestion[], examElo, restCount)
      pool.forEach(q => queue.push({ qType: 'restatement', data: q }))
    }
    // RC
    let passage: RCPassage | null = null
    if (rcCount > 0) {
      const all = rcData as (RCPassage & { difficulty?: number })[]
      const filtered = selectPassageByElo(all, readingElo)
      passage = filtered[Math.floor(Math.random() * filtered.length)] || null
      if (passage) {
        passage.questions.slice(0, rcCount).forEach(q =>
          queue.push({ qType: 'rc', data: q, passage: passage! })
        )
      }
    }
    return { questions: queue, rcPassageData: passage }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalQuestions = questions.length

  // Session state
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [score, setScore] = useState(0)
  const [startTime] = useState(Date.now())
  const [questionStart, setQuestionStart] = useState(Date.now())
  const [showPassage, setShowPassage] = useState(true)
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestion[]>([])
  /* Full answer log — every question the student faced with their verdict,
     for the full question-by-question review UI on the result screen. */
  const [allReviewQuestions, setAllReviewQuestions] = useState<ReviewQuestion[]>([])

  const nextBtnRef = useRef<HTMLButtonElement>(null)
  const isFromMission = searchParams.has('sc') || searchParams.has('rest') || searchParams.has('rc')

  // Current question
  const mq = current < totalQuestions ? questions[current] : null
  const currentSection = mq?.qType || 'sc'

  // ── Answer handler ─────────────────────────────────────────────────────────
  const handleSelect = useCallback((i: number) => {
    if (selected !== null || !mq) return
    const responseTimeMs = Date.now() - questionStart
    const responseTime = Math.round(responseTimeMs / 1000)

    // Get common fields
    const qId = mq.data.id
    const options = mq.data.options
    const correctIdx = mq.data.correct
    const isCorrect = i === correctIdx

    playSound(isCorrect ? 'correct' : 'wrong')

    // Record to adaptive system
    const dimension = mq.qType === 'rc' ? 'reading' : 'exam'
    recordAnswer({ questionId: qId, dimension, correct: isCorrect, responseTimeMs })

    /* Build stem + explanation + optionAnalysis once — shared across both
       the wrong log AND the full review log. */
    let stem = ''
    let explanation: string | undefined
    let optionAnalysis: string[] | undefined
    let passage: string | undefined
    let passageTitle: string | undefined
    if (mq.qType === 'sc') {
      const d = mq.data
      stem = d.sentence
      explanation = d.explanation?.fullTranslation || d.explanation?.mambal
      optionAnalysis = d.explanation?.optionAnalysis
    } else if (mq.qType === 'restatement') {
      const d = mq.data
      stem = d.sentence
      explanation = d.explanation?.sentenceTranslation
      optionAnalysis = d.explanation?.optionAnalysis
    } else {
      const d = mq.data as RCQuestion & { passage?: string; passageTitle?: string; optionAnalysis?: string[] }
      stem = d.question
      explanation = typeof d.explanation === 'string'
        ? d.explanation
        : d.explanation?.questionTranslation
      optionAnalysis = typeof d.explanation === 'object' && d.explanation !== null
        ? (d.explanation as { optionAnalysis?: string[] }).optionAnalysis
        : undefined
      passage = d.passage
      passageTitle = d.passageTitle
    }

    // Always log into the full review list (correct AND incorrect).
    setAllReviewQuestions(prev => [...prev, {
      stem,
      userAnswer: options[i] ?? '',
      correctAnswer: options[correctIdx] ?? '',
      correct: isCorrect,
      explanation,
      qType: mq.qType,
      options,
      correctIdx,
      userIdx: i,
      optionAnalysis,
      passage,
      passageTitle,
      timeSpentMs: responseTimeMs,
    }])

    if (isCorrect) {
      setScore(s => s + 1)
    } else {
      // Legacy wrong-only log + dimension-specific error bookkeeping
      if (mq.qType === 'sc') {
        const d = mq.data
        onSCWrongAnswer(d.sentence, d.options[d.correct], d.explanation?.translations)
        recordError({ questionId: qId, questionType: 'sc', questionText: d.sentence, options, correctIndex: correctIdx, selectedIndex: i, responseTime })
      } else if (mq.qType === 'restatement') {
        const d = mq.data
        onRestatementWrongAnswer(d.sentence, d.options[d.correct])
        recordError({ questionId: qId, questionType: 'restatement', questionText: d.sentence, options, correctIndex: correctIdx, selectedIndex: i, responseTime })
      } else {
        const d = mq.data as RCQuestion
        onRCWrongAnswer(d.question, d.options[d.correct])
        recordError({ questionId: qId, questionType: 'rc', questionText: d.question, options, correctIndex: correctIdx, selectedIndex: i, responseTime })
      }
      setWrongQuestions(prev => [...prev, {
        stem,
        userAnswer: options[i] ?? '',
        correctAnswer: options[correctIdx] ?? '',
        explanation,
      }])
    }

    setSelected(i)
    setShowExplanation(true)
  }, [selected, mq, questionStart])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4' && selected === null) {
        handleSelect(parseInt(e.key) - 1)
      } else if (e.key === 'Enter' && showExplanation) {
        nextBtnRef.current?.click()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSelect, showExplanation, selected])

  // Scroll the Next button into view on mobile when the explanation reveals
  useEffect(() => {
    if (showExplanation) {
      setTimeout(() => {
        nextBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 120)
    }
  }, [showExplanation])

  // ── Next question handler ──────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    const isCorrect = mq && selected === mq.data.correct
    addXP(isCorrect ? 15 : 5)
    checkStreak()

    if (current === totalQuestions - 1) {
      playSound('complete')
      // Complete mission
      const mid = localStorage.getItem('znk-active-mission')
      if (mid) {
        localStorage.removeItem('znk-active-mission')
        import('../../stores/coachStore').then(({ useCoachStore }) =>
          useCoachStore.getState().completeMission(mid)
        )
      }
      // Save attempt
      addAttempt({
        id: Date.now().toString(),
        type: 'sc', // primary type for stats
        questionIds: questions.map(q => q.data.id),
        answers: {},
        score,
        totalQuestions,
        timeSpent: Math.round((Date.now() - startTime) / 1000),
        completedAt: new Date().toISOString(),
      })
      onSessionComplete({ score, totalQuestions, type: 'exam' })
    }

    setCurrent(c => c + 1)
    setSelected(null)
    setShowExplanation(false)
    setQuestionStart(Date.now())
  }, [current, totalQuestions, mq, selected, score, questions, startTime, addXP, checkStreak, addAttempt])

  const handleBack = useCallback(() => {
    navigate(isFromMission ? '/' : '/exam')
  }, [navigate, isFromMission])

  // ── Finished screen ────────────────────────────────────────────────────────
  if (current >= totalQuestions) {
    /* Use the shared ExamResultScreen component — same UI the student
       sees after SC / Restatement / RC standalone sessions. Gives the
       mission-completion flow a proper end screen with confetti, tiered
       celebration, wrong-question review, and a "next mission" CTA that
       picks up from where the student left off. */
    const xpEarned = score * 15 + (totalQuestions - score) * 5
    // Determine the primary question type for this mission
    const primaryType: ExamQuestionType =
      scCount > 0 && restCount === 0 && rcCount === 0 ? 'sc'
      : restCount > 0 && scCount === 0 && rcCount === 0 ? 'restatement'
      : rcCount > 0 && scCount === 0 && restCount === 0 ? 'rc'
      : 'mixed'
    // ExamResultScreen takes `isPersonalBest` as a plain boolean — gameStats
    // store's isPersonalBest type is keyed to vocab GameIds. We don't have a
    // matching key for exam-mission sessions yet, so just pass false here.
    const isPersonalBest = false
    return (
      <ExamResultScreen
        questionType={primaryType}
        score={score}
        total={totalQuestions}
        startTime={startTime}
        xpEarned={xpEarned}
        wrongQuestions={wrongQuestions}
        allQuestions={allReviewQuestions}
        isPersonalBest={isPersonalBest}
        onBack={handleBack}
        onRetry={() => window.location.reload()}
        onPlayDifferent={() => navigate('/exam')}
      />
    )
  }
  // Dead-code zone retained to minimise diff — previous bare-bones end
  // screen lived here; replaced by <ExamResultScreen /> above.
  if (false) {
    return (
      <div className="space-y-6 animate-fadeIn pb-4">
        <div className="flex gap-3">
          <button className="flex-1 py-3.5 rounded-xl font-bold text-sm" style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }} onClick={handleBack}>
            ← {isFromMission ? 'חזרה הביתה' : 'חזרה'}
          </button>
          <button className="neu-btn-accent flex-1 text-sm py-3.5" onClick={() => window.location.reload()}>
            עוד סיבוב! 🔄
          </button>
        </div>
      </div>
    )
  }

  if (!mq) return null

  // Common values
  const correctIdx = mq.data.correct
  const options = mq.data.options
  const meta = SECTION_META[currentSection]

  // Detect section transitions for label
  const prevSection = current > 0 ? questions[current - 1].qType : null
  const isNewSection = prevSection !== null && prevSection !== currentSection

  const getOptionStyle = (i: number) => {
    if (selected === null) return { background: BG, boxShadow: S.extrudedSm, outline: 'none' }
    if (i === correctIdx) return { background: '#ECFDF5', boxShadow: S.inset, outline: `3px solid ${CORRECT}` }
    if (i === selected && i !== correctIdx) return { background: '#FEF2F2', boxShadow: S.inset, outline: `3px solid ${WRONG}` }
    return { background: BG, boxShadow: S.extrudedSm, outline: 'none', opacity: 0.6 }
  }

  return (
    <div className="space-y-5 animate-fadeIn pb-4 emp-wrapper">
      {/* Brand intro animation — plays for ~2.5s every time the student
          enters the daily "תרגול שאלות" mission. While it's on screen the
          intro overlay sits above the practice content (z-9998) and the
          shared modeIntroState signal pauses any auto-TTS / instructions
          modals so the animation gets to play uninterrupted. */}
      <ExamModeIntro modeId="exam-practice" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <button className="px-4 py-2 rounded-xl font-bold text-sm" style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }} onClick={handleBack}>
          ← {isFromMission ? 'ביתה' : 'חזרה'}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: meta.color }}>{meta.icon}</span>
          <h2 className="font-bold text-sm" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>{meta.label}</h2>
        </div>
        <div className="flex items-center gap-2">
          <TTSSpeedBtn size={14} />
          <span className="text-sm font-bold" style={{ color: MUTED, fontFamily: 'var(--font-display)' }}>{current + 1}/{totalQuestions}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 rounded-xl overflow-hidden" style={{ background: BG, boxShadow: S.inset }} dir="ltr">
        <div className="h-full rounded-xl transition-[transform,box-shadow,background-color,border-color,opacity] duration-300" style={{ width: `${((current + 1) / totalQuestions) * 100}%`, background: `linear-gradient(90deg, ${ACCENT}, ${SECONDARY})` }} />
      </div>

      {/* Section transition label */}
      {isNewSection && (
        <div className="text-center py-2 animate-fadeIn">
          <span className="text-xs font-bold px-4 py-1.5 rounded-full" style={{ background: meta.color + '15', color: meta.color }}>
            {meta.icon} עוברים ל{meta.label}
          </span>
        </div>
      )}

      {/* RC Passage (only for RC questions) */}
      {currentSection === 'rc' && rcPassageData && (
        <>
          <button
            /* Inline znk-tooltip — tooltip explains the (non-obvious)
               fact that the passage stays available even after hide. */
            className="w-full py-3 rounded-xl font-bold text-sm text-center znk-tooltip"
            style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }}
            onClick={() => setShowPassage(!showPassage)}
          >
            <span className="znk-tip" data-placement="bottom" role="tooltip">
              הקטע זמין לאורך כל המשימה — בחר מתי להציג ומתי להסתיר
            </span>
            {showPassage ? 'הסתר קטע 📄' : 'הצג קטע 📄'} — {rcPassageData.title}
          </button>
          {showPassage && (
            <div className="max-h-[40vh] overflow-y-auto" style={{ background: BG, boxShadow: S.extruded, borderRadius: 28, padding: 24 }}>
              <div dir="ltr" className="text-left">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-base" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>{rcPassageData.title}</h3>
                  <SpeakerBtn text={rcPassageData.passage} size={20} />
                </div>
                {rcPassageData.passage.split('\n\n').map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed mb-3 last:mb-0" style={{ color: TEXT, fontFamily: 'var(--font-body)' }}>
                    <ClickableEnglishText text={para} source="rc" paragraphs={false} allowHighlight />
                  </p>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Question display — type-specific */}
      <div dir="ltr" className="text-left space-y-4">
        <div style={{ background: BG, boxShadow: S.extruded, borderRadius: 28, padding: 24 }}>
          {currentSection === 'sc' && (
            <div className="flex items-start gap-3">
              <p className="text-lg leading-relaxed flex-1" style={{ color: TEXT, fontFamily: 'var(--font-body)' }}>
                <ClickableEnglishText text={(mq.data as SCQuestion).sentence} source="sc" allowHighlight />
              </p>
              <SpeakerBtn text={(mq.data as SCQuestion).sentence} size={18} />
            </div>
          )}
          {currentSection === 'restatement' && (
            <>
              <p className="text-xs mb-2" dir="rtl" style={{ color: MUTED }}>המשפט המקורי:</p>
              <div className="flex items-start gap-3">
                <p className="text-lg leading-relaxed flex-1" style={{ color: TEXT, fontFamily: 'var(--font-body)' }}>
                  <ClickableEnglishText text={(mq.data as RestQuestion).sentence} source="restatement" allowHighlight />
                </p>
                <SpeakerBtn text={(mq.data as RestQuestion).sentence} size={18} />
              </div>
            </>
          )}
          {currentSection === 'rc' && (
            <div className="flex items-start gap-3">
              <p className="text-sm font-semibold flex-1" style={{ color: TEXT, fontFamily: 'var(--font-body)' }}>
                <ClickableEnglishText text={(mq.data as RCQuestion).question} source="rc" />
              </p>
              <SpeakerBtn text={(mq.data as RCQuestion).question} size={16} />
            </div>
          )}
        </div>

        {/* Options */}
        <div className="space-y-3">
          {options.map((opt, i) => (
            <div
              key={i}
              className={`cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 ${selected === null ? 'hover:-translate-y-0.5' : ''}`}
              style={{ ...getOptionStyle(i), borderRadius: 20, padding: '16px 20px' }}
              onClick={() => handleSelect(i)}
            >
              <span className="flex items-start gap-3">
                <span className="text-sm mt-0.5" style={{ color: selected !== null && i === correctIdx ? CORRECT : selected === i ? WRONG : MUTED }}>({i + 1})</span>
                <span className="text-sm leading-relaxed flex-1" style={{ color: TEXT, fontFamily: 'var(--font-body)' }}>
                  <ClickableEnglishText text={opt} source={currentSection === 'sc' ? 'sc' : currentSection} />
                </span>
                <SpeakerBtn text={opt} size={14} />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Explanation */}
      {showExplanation && (
        <div className="animate-fadeIn" style={{ background: BG, boxShadow: S.inset, borderRadius: 24, padding: 20 }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: selected === correctIdx ? CORRECT : WRONG, boxShadow: `0 2px 8px ${selected === correctIdx ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
              <span className="text-white text-xs font-bold">{selected === correctIdx ? '✓' : '✗'}</span>
            </div>
            <span className="font-bold" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
              תשובה ({correctIdx + 1}) נכונה
            </span>
          </div>

          {/* SC explanation */}
          {currentSection === 'sc' && (() => {
            const d = mq.data as SCQuestion
            return (
              <>
                <div className="mb-4">
                  <span className="text-base font-semibold leading-relaxed" style={{ color: ACCENT }}>ממב״ל: </span>
                  <span className="text-base leading-relaxed" style={{ color: TEXT }}>{d.explanation.mambal}</span>
                </div>
                <div className="mb-4">
                  <p className="text-base leading-relaxed" style={{ color: MUTED }}>{d.explanation.fullTranslation}</p>
                </div>
                {d.explanation.optionAnalysis && (
                  <div className="space-y-2.5 mb-4">
                    <span className="text-base font-semibold" style={{ color: TEXT }}>ניתוח תשובות:</span>
                    {d.explanation.optionAnalysis.map((analysis, i) => (
                      <div key={i} className="text-base p-3 rounded-xl leading-relaxed" style={{ background: i === correctIdx ? '#ECFDF5' : 'transparent', color: i === correctIdx ? CORRECT : MUTED, fontWeight: i === correctIdx ? 600 : 400 }}>
                        <span className="font-semibold">({i + 1}) {d.options[i]} = {d.explanation.translations[i]}: </span>
                        {analysis}
                      </div>
                    ))}
                  </div>
                )}
                {!d.explanation.optionAnalysis && (
                  <div className="space-y-1.5">
                    {d.explanation.translations.map((t, i) => (
                      <div key={i} className="text-base flex gap-2 leading-relaxed" style={{ color: i === correctIdx ? CORRECT : MUTED, fontWeight: i === correctIdx ? 700 : 400 }}>
                        <span>({i + 1})</span><span>{t}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          })()}

          {/* Restatement explanation */}
          {currentSection === 'restatement' && (() => {
            const d = mq.data as RestQuestion
            return (
              <>
                <div className="mb-4">
                  <span className="text-base font-semibold leading-relaxed" style={{ color: ACCENT }}>תרגום המשפט: </span>
                  <span className="text-base leading-relaxed" style={{ color: TEXT }}>{d.explanation.sentenceTranslation}</span>
                </div>
                <div className="space-y-2.5">
                  <span className="text-base font-semibold" style={{ color: TEXT }}>ניתוח תשובות:</span>
                  {d.explanation.optionAnalysis.map((analysis, i) => (
                    <div key={i} className="text-base p-3 rounded-xl leading-relaxed" style={{ background: i === correctIdx ? '#ECFDF5' : 'transparent', color: i === correctIdx ? CORRECT : MUTED, fontWeight: i === correctIdx ? 600 : 400 }}>
                      <span className="font-semibold">({i + 1}) </span>{analysis}
                    </div>
                  ))}
                </div>
              </>
            )
          })()}

          {/* RC explanation */}
          {currentSection === 'rc' && (() => {
            const d = mq.data as RCQuestion
            if (typeof d.explanation === 'string') {
              return <p className="text-base leading-relaxed mb-6" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>{d.explanation}</p>
            }
            return (
              <div className="mb-6">
                <p className="text-base leading-relaxed mb-4" style={{ color: MUTED }}>{d.explanation.questionTranslation}</p>
                <div className="space-y-2.5">
                  <span className="text-base font-semibold" style={{ color: TEXT }}>ניתוח תשובות:</span>
                  {d.explanation.optionAnalysis.map((analysis, i) => (
                    <div key={i} className="text-base p-3 rounded-xl leading-relaxed" style={{ background: i === correctIdx ? '#ECFDF5' : 'transparent', color: i === correctIdx ? CORRECT : MUTED, fontWeight: i === correctIdx ? 600 : 400 }}>
                      <span className="font-semibold">({i + 1}) </span>{analysis}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          <button ref={nextBtnRef} className="neu-btn-accent w-full text-sm py-3.5 mt-8 emp-inline-next" onClick={handleNext}>
            {current < totalQuestions - 1 ? 'הבא ←' : 'סיום 🏆'}
          </button>
        </div>
      )}

      {/* Mobile-only sticky Next button */}
      {showExplanation && (
        <div className="emp-sticky-next" role="region" aria-label="המשך">
          <button
            className="emp-sticky-next-btn"
            onClick={handleNext}
            aria-label={current < totalQuestions - 1 ? 'שאלה הבאה' : 'סיום'}
          >
            <span>{current < totalQuestions - 1 ? 'הבא' : 'סיום'}</span>
            <span className="emp-sticky-next-arrow">{current < totalQuestions - 1 ? '←' : '🏆'}</span>
          </button>
        </div>
      )}

      <style>{`
        .emp-sticky-next { display: none; }
        @media (max-width: 720px) {
          .emp-inline-next { display: none !important; }
          .emp-sticky-next {
            display: block;
            position: fixed;
            bottom: calc(88px + env(safe-area-inset-bottom, 12px));
            left: 12px; right: 12px; z-index: 40;
            animation: empSlideUp 0.35s cubic-bezier(.2,.9,.3,1.2) both;
          }
          .emp-wrapper { padding-bottom: 100px !important; }
        }
        @keyframes empSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .emp-sticky-next-btn {
          width: 100%; padding: 15px 22px; min-height: 52px;
          background: linear-gradient(135deg, #6C63FF, #38B2AC); color: white;
          border: 0; border-radius: 18px;
          font-family: var(--font-display); font-weight: 800; font-size: 15px;
          box-shadow: 0 10px 28px rgba(108,99,255,0.5), 0 2px 6px rgba(0,0,0,0.1);
          display: flex; align-items: center; justify-content: center; gap: 12px;
          cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .emp-sticky-next-btn:hover { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(108,99,255,0.6); }
        .emp-sticky-next-btn:active { transform: scale(0.97); }
        .emp-sticky-next-arrow { font-size: 18px; line-height: 1; }
      `}</style>
    </div>
  )
}
