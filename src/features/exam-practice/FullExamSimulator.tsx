import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExamStore } from '../../stores/examStore'
import { useGamificationStore } from '../../stores/gamificationStore'
import { SpeakerBtn, TTSSpeedBtn } from '../../utils/tts'
import { ClickableEnglishText } from '../../components/common/ClickableEnglishText'
import { playSound } from '../../utils/sounds'
import { detectAndSaveUnknownWords } from '../../utils/wordDetection'
import { recordError, recordAnswer, onSessionComplete, selectQuestionsByElo } from '../../utils/examHelpers'
import { useStudentProfileStore } from '../../stores/studentProfileStore'
import { asset } from '../../utils/assetUrl'
import { g } from '../../utils/gender'
import scQuestions from '../../data/exam/sentence-completion.json'
import restQuestions from '../../data/exam/restatements.json'
import rcData from '../../data/exam/reading-comprehension.json'
import { InstructionsOverlay, useInstructions } from '../../components/common/InstructionsOverlay'
import { ExamModeIntro } from '../../components/common/ExamModeIntro'
import { useSyncExternalStore } from 'react'
import { getModeIntroActive, subscribeModeIntro } from '../../utils/modeIntroState'
import { ExamResultScreen, type ReviewQuestion } from './ExamResultScreen'

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

interface Question {
  id: string
  type: 'sc' | 'restatement' | 'rc'
  sentence: string
  options: string[]
  correct: number
  passage?: string
  passageTitle?: string
  // Explanation data varies by type
  explanation?: any
}

const EXAM_TIME = 20 * 60

export function FullExamSimulator() {
  const navigate = useNavigate()
  const { addAttempt } = useExamStore()
  const { addXP, checkStreak, awardBadge } = useGamificationStore()
  const instructions = useInstructions('exam-full')
  // True while the brand-y mode-intro overlay is on screen. We use this to
  // gate BOTH the exam timer (no countdown until the student has seen the
  // intro and the first-time instructions) and the instructions overlay
  // itself (so the intro plays in full before the instructions modal layers
  // on top — that order was the explicit student-facing requirement).
  const introActive = useSyncExternalStore(subscribeModeIntro, getModeIntroActive, getModeIntroActive)

  const questions = useMemo(() => {
    const result: Question[] = []

    const examElo = useStudentProfileStore.getState().examElo
    const sc = selectQuestionsByElo(scQuestions as any[], examElo, 8)
    sc.forEach((q) => result.push({
      id: q.id, type: 'sc', sentence: q.sentence, options: q.options, correct: q.correct,
      explanation: q.explanation,
    }))

    const rest = selectQuestionsByElo(restQuestions as any[], examElo, 4)
    rest.forEach((q) => result.push({
      id: q.id, type: 'restatement', sentence: q.sentence, options: q.options, correct: q.correct,
      explanation: q.explanation,
    }))

    const rc = rcData as any[]
    if (rc.length > 0) {
      const allRcQs: Question[] = []
      rc.forEach((passage: any) => {
        passage.questions.forEach((q: any) => {
          allRcQs.push({
            id: q.id, type: 'rc', sentence: q.question, options: q.options, correct: q.correct,
            passage: passage.passage, passageTitle: passage.title,
            explanation: q.explanation,
          })
        })
      })
      result.push(...allRcQs.sort(() => Math.random() - 0.5).slice(0, 10))
    }

    return result
  }, [])

  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  // Per-question time-spent, keyed by question id. Fed into the review UI so
  // the card header can display "42 שנ׳" for each question, and so that
  // questions answered in < 8s can be flagged as "rushed" in a future version.
  const [times, setTimes] = useState<Record<string, number>>({})
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(EXAM_TIME)
  const [startTime] = useState(Date.now())
  const [isFinished, setIsFinished] = useState(false)
  const [showRcPassage, setShowRcPassage] = useState(true)
  const [questionStart, setQuestionStart] = useState(Date.now())

  // Use refs so finishExam always has latest values
  const answersRef = useRef(answers)
  answersRef.current = answers
  const scoreRef = useRef(score)
  scoreRef.current = score

  const finishExam = useCallback(() => {
    if (isFinished) return
    setIsFinished(true)
    playSound('complete')
    const timeSpent = Math.round((Date.now() - startTime) / 1000)
    addAttempt({
      id: Date.now().toString(), type: 'full',
      questionIds: questions.map((q) => q.id),
      answers: answersRef.current,
      score: scoreRef.current,
      totalQuestions: questions.length, timeSpent,
      completedAt: new Date().toISOString(),
    })
    const pct = questions.length > 0 ? scoreRef.current / questions.length : 0
    addXP(Math.round(pct * 100))
    checkStreak()
    awardBadge('exam-first')
    if (pct === 1) awardBadge('exam-perfect')
    onSessionComplete({ score: scoreRef.current, totalQuestions: questions.length, type: 'exam' })
  }, [isFinished, startTime, questions, addAttempt, addXP, checkStreak, awardBadge])

  useEffect(() => {
    if (isFinished) return
    // Don't run the timer while the first-time instructions overlay is up,
    // and don't run it while the brand mode-intro animation is still on
    // screen — both block the student from starting the exam, so counting
    // down feels punitive. (Reported bug: the clock had already shed ~10s
    // by the time the modal was dismissed; same logic applies to the intro.)
    if (instructions.shouldShow) return
    if (introActive) return
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { finishExam(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isFinished, finishExam, instructions.shouldShow, introActive])

  // Keyboard shortcuts: 1-4 to select, Enter to submit
  const submitBtnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (isFinished) return
    const handler = (e: KeyboardEvent) => {
      const key = e.key
      if (key >= '1' && key <= '4') {
        const idx = parseInt(key) - 1
        const q = questions[current]
        if (q && idx < q.options.length) {
          playSound('click')
          setSelected(idx)
        }
      } else if (key === 'Enter' && selected !== null) {
        submitBtnRef.current?.click()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isFinished, current, questions, selected])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const timeWarning = timeLeft < 120
  const timeCritical = timeLeft < 60

  const [expandedQ, setExpandedQ] = useState<string | null>(null)
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong' | 'correct'>('all')
  const [reviewIdx, setReviewIdx] = useState(0) // currently viewed question index in review

  const typeLabelsResult: Record<string, string> = { sc: 'השלמת משפטים', restatement: 'ניסוח מחדש', rc: 'הבנת הנקרא' }

  // Helper to render explanation for each question type
  function renderExplanation(q: Question) {
    const exp = q.explanation
    if (!exp) return null

    if (q.type === 'sc') {
      // SC: mambal, translations, fullTranslation, optionAnalysis
      return (
        <div className="mt-3 space-y-2" dir="rtl">
          <div className="p-3 rounded-xl" style={{ background: BG, boxShadow: S.inset }}>
            <p className="text-sm mb-2">
              <span className="font-bold" style={{ color: ACCENT }}>ממב״ל: </span>
              <span style={{ color: TEXT }}>{exp.mambal}</span>
            </p>
            <p className="text-sm mb-2" style={{ color: MUTED }}>{exp.fullTranslation}</p>
            {exp.optionAnalysis ? (
              <div className="space-y-1.5">
                <span className="text-sm font-bold" style={{ color: TEXT }}>ניתוח תשובות:</span>
                {exp.optionAnalysis.map((analysis: string, i: number) => (
                  <div key={i} className="text-sm p-2 rounded-lg" style={{
                    background: i === q.correct ? '#ECFDF5' : 'transparent',
                    color: i === q.correct ? CORRECT : MUTED,
                    fontWeight: i === q.correct ? 600 : 400,
                  }}>
                    <span className="font-semibold">({i + 1}) {q.options[i]} = {exp.translations?.[i]}: </span>{analysis}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {exp.translations?.map((t: string, i: number) => (
                  <div key={i} className="text-sm flex gap-2" style={{ color: i === q.correct ? CORRECT : MUTED, fontWeight: i === q.correct ? 700 : 400 }}>
                    <span>({i + 1})</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )
    }

    if (q.type === 'restatement') {
      // Restatement: sentenceTranslation, optionAnalysis
      return (
        <div className="mt-3 space-y-2" dir="rtl">
          <div className="p-3 rounded-xl" style={{ background: BG, boxShadow: S.inset }}>
            <p className="text-sm mb-2">
              <span className="font-bold" style={{ color: ACCENT }}>תרגום המשפט: </span>
              <span style={{ color: TEXT }}>{exp.sentenceTranslation}</span>
            </p>
            <div className="space-y-1.5">
              <span className="text-sm font-bold" style={{ color: TEXT }}>ניתוח תשובות:</span>
              {exp.optionAnalysis?.map((analysis: string, i: number) => (
                <div key={i} className="text-sm p-2 rounded-lg" style={{
                  background: i === q.correct ? '#ECFDF5' : 'transparent',
                  color: i === q.correct ? CORRECT : MUTED,
                  fontWeight: i === q.correct ? 600 : 400,
                }}>
                  <span className="font-semibold">({i + 1}) </span>{analysis}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    if (q.type === 'rc') {
      // RC: string or structured explanation
      return (
        <div className="mt-3" dir="rtl">
          <div className="p-3 rounded-xl" style={{ background: BG, boxShadow: S.inset }}>
            {typeof exp === 'string' ? (
              <p className="text-sm" style={{ color: TEXT }}>
                <span className="font-bold" style={{ color: ACCENT }}>הסבר: </span>
                {exp}
              </p>
            ) : exp.optionAnalysis ? (
              <div>
                <p className="text-sm mb-2" style={{ color: MUTED }}>{exp.questionTranslation}</p>
                <div className="space-y-1.5">
                  <span className="text-sm font-bold" style={{ color: TEXT }}>ניתוח תשובות:</span>
                  {exp.optionAnalysis.map((analysis: string, i: number) => (
                    <div key={i} className="text-sm p-2 rounded-lg" style={{
                      background: i === q.correct ? '#ECFDF5' : 'transparent',
                      color: i === q.correct ? CORRECT : MUTED,
                      fontWeight: i === q.correct ? 600 : 400,
                    }}>
                      <span className="font-semibold">({i + 1}) </span>{analysis}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm" style={{ color: TEXT }}>
                <span className="font-bold" style={{ color: ACCENT }}>הסבר: </span>
                {exp.explanation || ''}
              </p>
            )}
          </div>
        </div>
      )
    }

    return null
  }

  if (isFinished) {
    // Extract stem + explanation + per-option analysis once per question.
    // The explanation shape differs per type (SC / Restatement / RC), so we
    // narrow the union here, and we surface `optionAnalysis[]` separately
    // because the new review UI renders it inline under each option row.
    const buildReview = (q: Question): {
      stem: string
      explanation?: string
      optionAnalysis?: string[]
    } => {
      const stem = (q as unknown as { sentence?: string; question?: string }).sentence
                ?? (q as unknown as { question?: string }).question
                ?? ''
      const rawExp = (q as unknown as { explanation?: unknown }).explanation
      let explanation: string | undefined
      let optionAnalysis: string[] | undefined
      if (typeof rawExp === 'string') {
        explanation = rawExp
      } else if (rawExp && typeof rawExp === 'object') {
        const exp = rawExp as {
          mambal?: string
          fullTranslation?: string
          sentenceTranslation?: string
          questionTranslation?: string
          optionAnalysis?: string[]
        }
        // SC uses `mambal` as the headline Hebrew reasoning; Restatement/RC
        // use *Translation fields. Prefer the richest one available.
        explanation = exp.mambal ?? exp.fullTranslation ?? exp.sentenceTranslation ?? exp.questionTranslation
        optionAnalysis = Array.isArray(exp.optionAnalysis) ? exp.optionAnalysis : undefined
      }
      return { stem, explanation, optionAnalysis }
    }

    // Full review — every question the student saw, correct OR wrong. All
    // four options are carried through (not just user's pick + correct) so
    // the new card UI can render distractor analysis per option.
    const allQuestions: ReviewQuestion[] = questions.map((q) => {
      const chosen = answers[q.id]
      const { stem, explanation, optionAnalysis } = buildReview(q)
      return {
        stem,
        userAnswer: chosen !== undefined ? q.options[chosen] : '—',
        correctAnswer: q.options[q.correct],
        correct: chosen !== undefined && chosen === q.correct,
        explanation,
        qType: q.type,
        options: q.options,
        correctIdx: q.correct,
        userIdx: chosen !== undefined ? chosen : null,
        optionAnalysis,
        passage: q.passage,
        passageTitle: q.passageTitle,
        timeSpentMs: times[q.id],
      }
    })

    // Legacy wrong-only list — kept for the top "errors to review" summary
    // that ExamResultScreen still shows when no `allQuestions` flows in.
    const wrongQuestions = allQuestions
      .filter((r) => !r.correct)
      .map(({ stem, userAnswer, correctAnswer, explanation }) => ({
        stem, userAnswer, correctAnswer, explanation,
      }))

    const xpEarned = score * 20 + (questions.length - score) * 5

    // Estimated AMIR score — published AMIR/Amirnet scale is 50–150, with
    // 134 as the exemption threshold. Linear estimate from raw accuracy; the
    // result screen renders "פטור!" when ≥134, and a tiered encouragement
    // message below that.
    const pct = questions.length > 0 ? score / questions.length : 0
    const estimatedAmirScore = Math.round(50 + pct * 100)

    return (
      <ExamResultScreen
        questionType="mixed"
        score={score}
        total={questions.length}
        startTime={startTime}
        xpEarned={xpEarned}
        wrongQuestions={wrongQuestions}
        allQuestions={allQuestions}
        estimatedAmirScore={estimatedAmirScore}
        onBack={() => navigate('/exam/full')}
        onRetry={() => window.location.reload()}
        onPlayDifferent={() => navigate('/exam')}
      />
    )
  }

  const q = questions[current]
  if (!q) {
    if (!isFinished) setTimeout(() => finishExam(), 0)
    return null
  }

  const typeLabels: Record<string, string> = { sc: 'השלמת משפטים', restatement: 'ניסוח מחדש', rc: 'הבנת הנקרא' }

  const handleSubmit = () => {
    if (selected === null) return
    // Update answers and score synchronously via refs
    playSound('click')
    const isCorrect = selected === q.correct
    const responseTimeMs = Date.now() - questionStart
    const newAnswers = { ...answersRef.current, [q.id]: selected }
    const newScore = isCorrect ? scoreRef.current + 1 : scoreRef.current
    setAnswers(newAnswers)
    setScore(newScore)
    setTimes(prev => ({ ...prev, [q.id]: responseTimeMs }))
    answersRef.current = newAnswers
    scoreRef.current = newScore

    // Update Elo system — RC questions use 'reading', others use 'exam'
    const dimension = q.type === 'rc' ? 'reading' as const : 'exam' as const
    recordAnswer({ questionId: q.id, dimension, correct: isCorrect, responseTimeMs })

    // Track wrong answers: word detection + error lab
    if (!isCorrect) {
      const sourceMap = { sc: 'sc' as const, restatement: 'restatement' as const, rc: 'rc' as const }
      detectAndSaveUnknownWords([q.sentence, q.options[q.correct]], sourceMap[q.type])
      recordError({
        questionId: q.id, questionType: q.type, questionText: q.sentence,
        options: q.options, correctIndex: q.correct, selectedIndex: selected,
        responseTime: Math.round(responseTimeMs / 1000), source: 'full-exam',
      })
    }

    if (current >= questions.length - 1) {
      finishExam()
    } else {
      setCurrent((c) => c + 1)
      setSelected(null)
      setShowRcPassage(true)
      setQuestionStart(Date.now())
    }
  }

  return (
    <div className="space-y-5 animate-fadeIn pb-4 fes-wrapper">
      <ExamModeIntro modeId="exam-full" />
      {/* Defer the first-time instructions modal until the mode-intro
          animation has fully exited. Without this gate the instructions
          modal (z-9999) would layer on top of the intro (z-9998), hiding
          the brand animation behind it. */}
      {!introActive && instructions.shouldShow && (
        <InstructionsOverlay modeId="exam-full" onDone={instructions.dismiss} />
      )}
      <div className="flex items-center justify-between">
        {/* Prominent timer */}
        <div
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl ${timeCritical ? 'animate-pulse' : ''}`}
          style={{
            background: timeCritical
              ? 'linear-gradient(135deg, #EF4444, #F97316)'
              : timeWarning
                ? 'linear-gradient(135deg, #F59E0B, #F97316)'
                : 'linear-gradient(135deg, #4F4780, #6C63FF)',
            boxShadow: timeCritical
              ? '0 4px 16px rgba(239,68,68,0.35)'
              : timeWarning
                ? '0 4px 16px rgba(245,158,11,0.35)'
                : '0 4px 16px rgba(108,99,255,0.3)',
          }}
        >
          <img src={asset('znk-icon-04.png')} alt="" style={{ width: 20, height: 20, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          <span className="font-extrabold text-lg" style={{ color: '#fff', fontFamily: 'var(--font-display)' }}>
            {formatTime(timeLeft)}
          </span>
        </div>
        <span className="text-xs px-3 py-1 rounded-full font-semibold"
          style={{ background: BG, boxShadow: S.extrudedSm, color: MUTED, fontFamily: 'var(--font-display)' }}>
          {typeLabels[q.type]}
        </span>
        <div className="flex items-center gap-2">
          <TTSSpeedBtn size={14} />
          <span className="text-sm font-bold" style={{ color: MUTED, fontFamily: 'var(--font-display)' }}>{current + 1}/{questions.length}</span>
        </div>
      </div>

      <div className="h-3 rounded-xl overflow-hidden" style={{ background: BG, boxShadow: S.inset }} dir="ltr">
        <div className="h-full rounded-xl transition-[transform,box-shadow,background-color,border-color,opacity] duration-300"
          style={{
            width: `${((current + 1) / questions.length) * 100}%`,
            background: timeCritical ? `linear-gradient(90deg, ${WRONG}, #F97316)` : `linear-gradient(90deg, ${ACCENT}, ${SECONDARY})`,
          }} />
      </div>

      {q.type === 'rc' && q.passage && (
        <>
          <button className="w-full py-3 rounded-xl font-bold text-sm text-center"
            style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }}
            onClick={() => setShowRcPassage(!showRcPassage)}>
            {showRcPassage ? 'הסתר קטע' : 'הצג קטע'} — {q.passageTitle}
          </button>
          {showRcPassage && (
            <div className="max-h-[35vh] overflow-y-auto" style={{ background: BG, boxShadow: S.extruded, borderRadius: 28, padding: 24 }}>
              <div dir="ltr" className="text-left">
                <div className="flex items-center justify-end mb-3">
                  <SpeakerBtn text={q.passage} size={18} />
                </div>
                {q.passage.split('\n\n').map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed mb-3 last:mb-0" style={{ color: TEXT, fontFamily: 'var(--font-body)' }}><ClickableEnglishText text={para} source="exam" paragraphs={false} /></p>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div dir="ltr" className="text-left space-y-3">
        <div style={{ background: BG, boxShadow: S.extruded, borderRadius: 28, padding: 24 }}>
          <div className="flex items-start gap-3">
            <p className="text-lg leading-relaxed flex-1" style={{ color: TEXT, fontFamily: 'var(--font-body)' }}><ClickableEnglishText text={q.sentence} source="exam" /></p>
            <SpeakerBtn text={q.sentence} size={18} />
          </div>
        </div>

        <div className="space-y-3">
          {q.options.map((opt, i) => {
            const isSelected = selected === i
            return (
              <div key={i} className="cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 hover:-translate-y-0.5"
                style={{
                  background: isSelected ? '#EEF2FF' : BG,
                  boxShadow: isSelected ? S.inset : S.extrudedSm,
                  borderRadius: 20, padding: '16px 20px',
                  outline: isSelected ? `3px solid ${ACCENT}` : 'none',
                }}
                onClick={() => { playSound('click'); setSelected(i) }}>
                <span className="flex items-start gap-3">
                  <span className="text-sm mt-0.5" style={{ color: isSelected ? ACCENT : MUTED, fontWeight: isSelected ? 700 : 400 }}>({i + 1})</span>
                  <span className="text-sm leading-relaxed flex-1" style={{ color: TEXT, fontWeight: isSelected ? 600 : 400 }}><ClickableEnglishText text={opt} source="exam" /></span>
                  <SpeakerBtn text={opt} size={14} />
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <button ref={submitBtnRef} className="neu-btn-accent w-full text-sm py-3.5 fes-inline-next"
        style={{ opacity: selected === null ? 0.5 : 1 }}
        disabled={selected === null}
        onClick={handleSubmit}>
        {current < questions.length - 1 ? 'הבא ←' : 'סיום מבחן'}
      </button>

      {/* Mobile-only sticky Next button */}
      {selected !== null && (
        <div className="fes-sticky-next" role="region" aria-label="המשך">
          <button
            className="fes-sticky-next-btn"
            onClick={handleSubmit}
            aria-label={current < questions.length - 1 ? 'שאלה הבאה' : 'סיום מבחן'}
          >
            <span>{current < questions.length - 1 ? 'הבא' : 'סיום מבחן'}</span>
            <span className="fes-sticky-next-arrow">{current < questions.length - 1 ? '←' : '🏆'}</span>
          </button>
        </div>
      )}

      <style>{`
        .fes-sticky-next { display: none; }
        @media (max-width: 720px) {
          .fes-inline-next { display: none !important; }
          .fes-sticky-next {
            display: block;
            position: fixed;
            bottom: calc(88px + env(safe-area-inset-bottom, 12px));
            left: 12px; right: 12px; z-index: 40;
            animation: fesSlideUp 0.35s cubic-bezier(.2,.9,.3,1.2) both;
          }
          .fes-wrapper { padding-bottom: 100px !important; }
        }
        @keyframes fesSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .fes-sticky-next-btn {
          width: 100%; padding: 15px 22px; min-height: 52px;
          background: linear-gradient(135deg, #6C63FF, #38B2AC); color: white;
          border: 0; border-radius: 18px;
          font-family: var(--font-display); font-weight: 800; font-size: 15px;
          box-shadow: 0 10px 28px rgba(108,99,255,0.5), 0 2px 6px rgba(0,0,0,0.1);
          display: flex; align-items: center; justify-content: center; gap: 12px;
          cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .fes-sticky-next-btn:hover { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(108,99,255,0.6); }
        .fes-sticky-next-btn:active { transform: scale(0.97); }
        .fes-sticky-next-arrow { font-size: 18px; line-height: 1; }
      `}</style>
    </div>
  )
}
