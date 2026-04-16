import { useState, useCallback } from 'react'
import type { Word } from '../../../../data/vocabulary/types'
import type { WordAssociations } from '../../../../services/associationApi'
import { getWordImageUrl, hasWordImage } from '../../../../utils/wordImages'
import { CARD_BG, ACCENT, TEXT, MUTED, BRAND_GRADIENT, CARD_BORDER, SECONDARY } from '../constants'
import { SpeakerBtn } from '../../../../utils/tts'
import type { useGameSession } from '../hooks/useGameSession'

// ─── Types ──────────────────────────────────────────────────────

interface WordHackPhase1Props {
  words: Word[]
  associations: Record<number, WordAssociations>
  onComplete: () => void
  gameSession: ReturnType<typeof useGameSession>
}

// ─── Helpers ────────────────────────────────────────────────────

interface ResolvedAssociation {
  text: string
  source: 'original' | 'ai' | 'student'
  authorName: string | null
  associationId: number | null
}

/** Pick the best association for a word from the associations map */
function getBestAssociation(
  word: Word,
  wordAssociations: WordAssociations | undefined,
): ResolvedAssociation {
  if (!wordAssociations || wordAssociations.associations.length === 0) {
    // Fallback: use the word's local association field
    return {
      text: word.association,
      source: 'original',
      authorName: null,
      associationId: null,
    }
  }

  const { associations, originalId } = wordAssociations

  // Prefer the original association if it exists
  if (originalId) {
    const original = associations.find((a) => a.id === originalId && a.status === 'active')
    if (original) {
      return {
        text: original.text,
        source: 'original',
        authorName: null,
        associationId: original.id,
      }
    }
  }

  // Otherwise pick the highest-rated active association
  const active = associations
    .filter((a) => a.status === 'active')
    .sort((a, b) => b.avg_rating - a.avg_rating)

  if (active.length > 0) {
    return {
      text: active[0].text,
      source: active[0].source,
      authorName: active[0].author_name,
      associationId: active[0].id,
    }
  }

  // Final fallback
  return {
    text: word.association,
    source: 'original',
    authorName: null,
    associationId: null,
  }
}

/** Source tag label and color */
function getSourceBadge(source: 'original' | 'ai' | 'student', authorName: string | null) {
  switch (source) {
    case 'original':
      return { label: 'מקורית', bg: '#FBBF24', color: '#78350F' }
    case 'ai':
      return { label: 'AI', bg: 'rgba(168,85,247,0.2)', color: '#C084FC' }
    case 'student':
      return { label: authorName || 'תלמיד', bg: 'rgba(74,222,128,0.2)', color: '#4ADE80' }
  }
}

// ─── Component ──────────────────────────────────────────────────

export function WordHackPhase1({
  words,
  associations,
  onComplete,
  gameSession,
}: WordHackPhase1Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [slideDirection, setSlideDirection] = useState<'in' | 'out'>('in')

  const word = words[currentIndex]
  if (!word) return null

  const assoc = getBestAssociation(word, associations[word.id])
  const imageUrl = getWordImageUrl(word.id)
  const badge = getSourceBadge(assoc.source, assoc.authorName)

  const handleAdvance = useCallback(() => {
    // Award XP for viewing this word
    gameSession.recordAnswer(word.id, true, 5, undefined, word, 5)

    if (currentIndex + 1 >= words.length) {
      onComplete()
      return
    }

    // Trigger slide-out, then slide-in for next word
    setSlideDirection('out')
    setTimeout(() => {
      setCurrentIndex((i) => i + 1)
      setSlideDirection('in')
    }, 200)
  }, [currentIndex, words.length, word, gameSession, onComplete])

  return (
    <div className="space-y-4" dir="rtl">
      {/* Main word card */}
      <div
        key={`phase1-${word.id}`}
        className="relative text-center py-8 px-6"
        style={{
          background: CARD_BG,
          borderRadius: 28,
          border: CARD_BORDER,
          animation: slideDirection === 'in'
            ? 'wordHackSlideIn 0.35s ease-out'
            : 'wordHackSlideOut 0.2s ease-in',
        }}
      >
        {/* English word + speaker */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <span
            className="text-2xl font-extrabold"
            dir="ltr"
            style={{ color: TEXT, fontFamily: 'var(--font-display)', fontSize: 24 }}
          >
            {word.english}
          </span>
          <SpeakerBtn text={word.english} size={20} />
        </div>

        {/* Hebrew translation */}
        <p
          className="text-sm font-semibold mb-4"
          style={{ color: ACCENT, fontFamily: 'var(--font-display)', fontSize: 14 }}
        >
          {word.hebrew}
        </p>

        {/* Word image */}
        {imageUrl && (
          <div className="flex justify-center mb-4">
            <div
              className="overflow-hidden"
              style={{
                borderRadius: 14,
                border: `1px solid rgba(255,255,255,0.06)`,
                width: 130,
                height: 90,
                background: '#fff',
              }}
            >
              <img
                src={imageUrl}
                alt={word.english}
                loading="lazy"
                className="w-full h-full transition-opacity duration-300"
                style={{ display: 'block', objectFit: 'cover' }}
              />
            </div>
          </div>
        )}

        {/* Association */}
        {assoc.text && (
          <div
            className="text-right p-4 rounded-2xl mb-4"
            style={{ background: 'rgba(129,140,248,0.08)', borderRadius: 16 }}
          >
            <div className="flex items-start gap-2">
              <span className="text-base flex-shrink-0 mt-0.5">💡</span>
              <p className="text-sm leading-relaxed flex-1" style={{ color: ACCENT }}>
                {assoc.text}
              </p>
            </div>
            {/* Source badge */}
            <div className="mt-2 flex justify-start">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: badge.bg,
                  color: badge.color,
                  fontFamily: 'var(--font-display)',
                }}
              >
                {badge.label}
              </span>
            </div>
          </div>
        )}

        {/* Example sentence */}
        {word.example && (
          <div
            className="text-right p-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12 }}
          >
            <p
              className="text-sm leading-relaxed mb-1"
              dir="ltr"
              style={{ color: TEXT, textAlign: 'left' }}
            >
              {word.example}
            </p>
            {word.exampleHebrew && (
              <p
                className="text-xs leading-relaxed"
                style={{ color: MUTED }}
              >
                {word.exampleHebrew}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Advance button */}
      <button
        className="w-full py-4 text-base font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-95"
        style={{
          background: BRAND_GRADIENT,
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-display)',
          boxShadow: 'none',
        }}
        onClick={handleAdvance}
      >
        הבנתי
      </button>

      {/* Progress indicator */}
      <div className="text-center">
        <span className="text-xs font-semibold" style={{ color: MUTED }}>
          {currentIndex + 1}/{words.length}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-1.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${((currentIndex + 1) / words.length) * 100}%`,
            background: `linear-gradient(90deg, ${ACCENT}, ${SECONDARY})`,
          }}
        />
      </div>

      {/* Slide animation keyframes */}
      <style>{`
        @keyframes wordHackSlideIn {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes wordHackSlideOut {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(30px); }
        }
      `}</style>
    </div>
  )
}
