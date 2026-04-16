import { useState, useCallback, useMemo, useEffect } from 'react'
import type { Word } from '../../../../data/vocabulary/types'
import type { WordAssociations } from '../../../../services/associationApi'
import { getWordImageUrl, hasWordImage } from '../../../../utils/wordImages'
import { playSound } from '../../../../utils/sounds'
import { CARD_BG, ACCENT, TEXT, MUTED, CORRECT, WRONG, CARD_BORDER, BRAND_GRADIENT } from '../constants'

// ─── Types ──────────────────────────────────────────────────

interface WordHackPhase3Props {
  words: Word[]
  allWords: Word[]
  associations: Record<number, WordAssociations>
  onComplete: () => void
  gameSession: {
    recordAnswer: (wordId: number, correct: boolean, quality: number, responseTimeMs?: number, word?: Word, baseXP?: number) => void
    combo: number
    score: number
    totalAnswered: number
    totalXP: number
  }
}

interface Question {
  word: Word
  options: string[]
  correctIndex: number
}

type FeedbackState = 'answering' | 'correct' | 'wrong'

interface HintsUsed {
  association: boolean
  image: boolean
}

// ─── Fisher-Yates shuffle ───────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── XP calculation ─────────────────────────────────────────

function calcBaseXP(hints: HintsUsed): number {
  if (hints.association && hints.image) return 7
  if (hints.association) return 10
  if (hints.image) return 12
  return 15
}

// ─── Best association text ──────────────────────────────────

function getBestAssociationText(
  wordId: number,
  associations: Record<number, WordAssociations>,
  fallbackAssociation: string,
): string {
  const wa = associations[wordId]
  if (!wa || wa.associations.length === 0) return fallbackAssociation
  // Sort by avg_rating descending, pick first
  const sorted = [...wa.associations].sort((a, b) => b.avg_rating - a.avg_rating)
  return sorted[0].text
}

// ─── Component ──────────────────────────────────────────────

export function WordHackPhase3({
  words,
  allWords,
  associations,
  onComplete,
  gameSession,
}: WordHackPhase3Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [feedback, setFeedback] = useState<FeedbackState>('answering')
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showAssociation, setShowAssociation] = useState(false)
  const [showImage, setShowImage] = useState(false)
  const [hintsUsed, setHintsUsed] = useState<HintsUsed>({ association: false, image: false })
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())

  // Generate all questions once
  const questions: Question[] = useMemo(() => {
    return words.map((word) => {
      // Collect candidate distractors: prefer same unit, then any
      const sameUnit = allWords.filter(
        (w) => w.unit === word.unit && w.hebrew !== word.hebrew && w.id !== word.id,
      )
      const otherUnit = allWords.filter(
        (w) => w.unit !== word.unit && w.hebrew !== word.hebrew && w.id !== word.id,
      )

      // Pick 3 distractors, preferring same-unit
      const distractorPool = shuffle([...sameUnit, ...otherUnit])
      const usedTranslations = new Set<string>([word.hebrew])
      const distractors: string[] = []

      for (const candidate of distractorPool) {
        if (distractors.length >= 3) break
        if (!usedTranslations.has(candidate.hebrew)) {
          distractors.push(candidate.hebrew)
          usedTranslations.add(candidate.hebrew)
        }
      }

      // In the unlikely case we have fewer than 3, pad with placeholders
      while (distractors.length < 3) {
        distractors.push(`---`)
      }

      // Build options: correct + 3 distractors, then shuffle
      const allOptions = [word.hebrew, ...distractors]
      const shuffled = shuffle(allOptions)
      const correctIndex = shuffled.indexOf(word.hebrew)

      return { word, options: shuffled, correctIndex }
    })
  }, [words, allWords])

  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1
  const wordImageUrl = currentQuestion ? getWordImageUrl(currentQuestion.word.id) : null
  const wordHasImage = currentQuestion ? hasWordImage(currentQuestion.word.id) : false

  // Reset state when moving to next question
  useEffect(() => {
    setFeedback('answering')
    setSelectedOption(null)
    setShowAssociation(false)
    setShowImage(false)
    setHintsUsed({ association: false, image: false })
    setQuestionStartTime(Date.now())
  }, [currentIndex])

  // Auto-advance after feedback
  useEffect(() => {
    if (feedback === 'answering') return

    const delay = feedback === 'correct' ? 600 : 1500
    const timer = setTimeout(() => {
      if (isLastQuestion) {
        onComplete()
      } else {
        setCurrentIndex((i) => i + 1)
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [feedback, isLastQuestion, onComplete])

  const handleSelectOption = useCallback(
    (optionIndex: number) => {
      if (feedback !== 'answering' || !currentQuestion) return

      const responseTimeMs = Date.now() - questionStartTime
      const isCorrect = optionIndex === currentQuestion.correctIndex
      setSelectedOption(optionIndex)

      if (isCorrect) {
        const baseXP = calcBaseXP(hintsUsed)
        // quality 5 = perfect, 4 = good with hints
        const quality = hintsUsed.association || hintsUsed.image ? 4 : 5
        gameSession.recordAnswer(
          currentQuestion.word.id,
          true,
          quality,
          responseTimeMs,
          currentQuestion.word,
          baseXP,
        )
        setFeedback('correct')
      } else {
        gameSession.recordAnswer(
          currentQuestion.word.id,
          false,
          1,
          responseTimeMs,
          currentQuestion.word,
          0,
        )
        setFeedback('wrong')
      }
    },
    [feedback, currentQuestion, questionStartTime, hintsUsed, gameSession],
  )

  const handleToggleAssociation = useCallback(() => {
    if (feedback !== 'answering') return
    setShowAssociation((prev) => !prev)
    if (!hintsUsed.association) {
      setHintsUsed((prev) => ({ ...prev, association: true }))
    }
  }, [feedback, hintsUsed.association])

  const handleToggleImage = useCallback(() => {
    if (feedback !== 'answering') return
    setShowImage((prev) => !prev)
    if (!hintsUsed.image) {
      setHintsUsed((prev) => ({ ...prev, image: true }))
    }
  }, [feedback, hintsUsed.image])

  if (!currentQuestion) return null

  const associationText = getBestAssociationText(
    currentQuestion.word.id,
    associations,
    currentQuestion.word.association,
  )

  // ─── Option styling helper ──────────────────────────────

  function getOptionStyle(index: number): React.CSSProperties {
    if (feedback === 'answering') {
      return {
        background: CARD_BG,
        border: CARD_BORDER,
        color: TEXT,
        cursor: 'pointer',
      }
    }

    // Feedback state: highlight correct and/or wrong
    if (index === currentQuestion.correctIndex) {
      return {
        background: 'rgba(74,222,128,0.15)',
        border: '1px solid rgba(74,222,128,0.5)',
        color: CORRECT,
        cursor: 'default',
      }
    }
    if (index === selectedOption && feedback === 'wrong') {
      return {
        background: 'rgba(251,113,133,0.15)',
        border: '1px solid rgba(251,113,133,0.5)',
        color: WRONG,
        cursor: 'default',
      }
    }
    return {
      background: CARD_BG,
      border: CARD_BORDER,
      color: MUTED,
      cursor: 'default',
      opacity: 0.5,
    }
  }

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto px-4">
      {/* Progress bar + combo */}
      <div className="flex items-center justify-between w-full mb-6">
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: MUTED, fontFamily: 'var(--font-display)' }}
        >
          {currentIndex + 1}/{questions.length}
        </span>

        {/* Progress dots */}
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                background:
                  i < currentIndex
                    ? ACCENT
                    : i === currentIndex
                      ? TEXT
                      : 'rgba(255,255,255,0.12)',
              }}
            />
          ))}
        </div>

        {gameSession.combo >= 2 && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full"
            style={{
              background: gameSession.combo >= 5
                ? `linear-gradient(135deg, ${ACCENT}, #A855F7)`
                : 'rgba(129,140,248,0.15)',
            }}
          >
            <span className="text-xs">&#x1F525;</span>
            <span
              className="text-xs font-extrabold tabular-nums"
              style={{ color: gameSession.combo >= 5 ? '#fff' : ACCENT }}
            >
              {gameSession.combo}
            </span>
          </div>
        )}
      </div>

      {/* English word */}
      <div className="text-center mb-2">
        <h2
          className="text-[26px] font-bold leading-tight"
          style={{ color: TEXT, fontFamily: 'var(--font-display)' }}
        >
          {currentQuestion.word.english}
        </h2>
        <p className="text-sm mt-1" style={{ color: MUTED }}>
          ???
        </p>
      </div>

      {/* Hint buttons */}
      <div className="flex items-center justify-center gap-3 mt-3 mb-4">
        <button
          onClick={handleToggleAssociation}
          disabled={feedback !== 'answering'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
          style={{
            background: showAssociation ? `${ACCENT}25` : 'rgba(255,255,255,0.05)',
            border: showAssociation ? `1px solid ${ACCENT}40` : '1px solid rgba(255,255,255,0.1)',
            color: showAssociation ? ACCENT : MUTED,
            opacity: feedback !== 'answering' ? 0.4 : 1,
          }}
        >
          <span>&#x1F4A1;</span>
          <span style={{ fontFamily: 'var(--font-display)' }}>&#x05D0;&#x05E1;&#x05D5;&#x05E6;&#x05D9;&#x05D0;&#x05E6;&#x05D9;&#x05D4;</span>
        </button>

        {wordHasImage && (
          <button
            onClick={handleToggleImage}
            disabled={feedback !== 'answering'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
            style={{
              background: showImage ? `${ACCENT}25` : 'rgba(255,255,255,0.05)',
              border: showImage ? `1px solid ${ACCENT}40` : '1px solid rgba(255,255,255,0.1)',
              color: showImage ? ACCENT : MUTED,
              opacity: feedback !== 'answering' ? 0.4 : 1,
            }}
          >
            <span>&#x1F5BC;&#xFE0F;</span>
            <span style={{ fontFamily: 'var(--font-display)' }}>&#x05EA;&#x05DE;&#x05D5;&#x05E0;&#x05D4;</span>
          </button>
        )}
      </div>

      {/* Hint content area */}
      {(showAssociation || showImage) && (
        <div
          className="w-full rounded-xl p-3 mb-4 text-center"
          style={{
            background: 'rgba(129,140,248,0.08)',
            border: `1px solid ${ACCENT}20`,
          }}
        >
          {showAssociation && (
            <p
              className="text-sm leading-relaxed"
              style={{ color: TEXT, fontFamily: 'var(--font-display)' }}
              dir="rtl"
            >
              {associationText}
            </p>
          )}
          {showImage && wordImageUrl && (
            <img
              src={wordImageUrl}
              alt={currentQuestion.word.english}
              className="mx-auto rounded-lg mt-2 max-h-32 object-contain"
              style={{ maxWidth: '80%' }}
            />
          )}
        </div>
      )}

      {/* Answer options */}
      <div className="flex flex-col gap-2.5 w-full mt-1">
        {currentQuestion.options.map((option, i) => {
          const style = getOptionStyle(i)
          const isSelectedWrong = feedback === 'wrong' && i === selectedOption
          const isCorrectHighlight = feedback !== 'answering' && i === currentQuestion.correctIndex

          return (
            <button
              key={`${currentIndex}-${i}`}
              onClick={() => handleSelectOption(i)}
              disabled={feedback !== 'answering'}
              className={`w-full py-3.5 px-4 rounded-xl text-base font-bold transition-all
                ${feedback === 'answering' ? 'hover:scale-[1.01] active:scale-[0.98]' : ''}
                ${isSelectedWrong ? 'animate-[shake_0.3s_ease-in-out]' : ''}
                ${isCorrectHighlight && feedback === 'correct' ? 'animate-[pulse_0.4s_ease-in-out]' : ''}
              `}
              style={{
                ...style,
                fontFamily: 'var(--font-display)',
                direction: 'rtl',
              }}
            >
              <span className="flex items-center justify-between">
                <span>{option}</span>
                {isCorrectHighlight && feedback !== null && (
                  <span className="text-sm ml-2">&#x2713;</span>
                )}
                {isSelectedWrong && (
                  <span className="text-sm ml-2">&#x2717;</span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* Wrong answer: show correct translation */}
      {feedback === 'wrong' && (
        <p
          className="mt-3 text-sm font-bold text-center animate-[fadeIn_0.3s_ease-in]"
          style={{ color: CORRECT, fontFamily: 'var(--font-display)' }}
          dir="rtl"
        >
          {currentQuestion.word.english} = {currentQuestion.word.hebrew}
        </p>
      )}

      {/* XP indicator */}
      <div className="mt-4 text-center">
        <span
          className="text-xs font-bold"
          style={{ color: MUTED, fontFamily: 'var(--font-display)' }}
        >
          XP: {gameSession.totalXP}
        </span>
      </div>

      {/* Inline keyframes for shake and fadeIn */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
