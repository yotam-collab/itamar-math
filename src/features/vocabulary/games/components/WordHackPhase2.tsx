import { useState, useCallback } from 'react'
import type { Word } from '../../../../data/vocabulary/types'
import type { WordAssociations, Association } from '../../../../services/associationApi'
import { rateAssociation, submitAssociation, isOffensive, getUserId } from '../../../../services/associationApi'
import { getWordImageUrl, hasWordImage } from '../../../../utils/wordImages'
import { CARD_BG, ACCENT, TEXT, MUTED, BRAND_GRADIENT, CARD_BORDER, CORRECT, WRONG } from '../constants'
import type { useGameSession } from '../hooks/useGameSession'

// ─── Types ──────────────────────────────────────────────────────

interface WordHackPhase2Props {
  words: Word[]
  associations: Record<number, WordAssociations>
  userId: string
  onComplete: () => void
  onRatingGiven: () => void
  onAssociationCreated: () => void
  gameSession: ReturnType<typeof useGameSession>
}

// ─── Helpers ────────────────────────────────────────────────────

/** Get the main association to rate for a word */
function getMainAssociation(
  word: Word,
  wordAssociations: WordAssociations | undefined,
): Association | null {
  if (!wordAssociations || wordAssociations.associations.length === 0) return null

  const { associations, originalId } = wordAssociations

  // Prefer the original
  if (originalId) {
    const original = associations.find((a) => a.id === originalId && a.status === 'active')
    if (original) return original
  }

  // Highest rated active
  const active = associations
    .filter((a) => a.status === 'active')
    .sort((a, b) => b.avg_rating - a.avg_rating)

  return active.length > 0 ? active[0] : null
}

/** Get the best community association that differs from the main one */
function getCommunityBest(
  wordAssociations: WordAssociations | undefined,
  mainId: number | null,
): Association | null {
  if (!wordAssociations) return null

  const candidates = wordAssociations.associations
    .filter((a) => a.status === 'active' && a.id !== mainId && a.source === 'student')
    .sort((a, b) => b.avg_rating - a.avg_rating)

  return candidates.length > 0 ? candidates[0] : null
}

// ─── Star Rating Component ──────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className="text-2xl transition-transform hover:scale-110 active:scale-95"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            filter: n <= value ? 'none' : 'grayscale(1) opacity(0.3)',
          }}
        >
          ⭐
        </button>
      ))}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────

export function WordHackPhase2({
  words,
  associations,
  userId,
  onComplete,
  onRatingGiven,
  onAssociationCreated,
  gameSession,
}: WordHackPhase2Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [ratings, setRatings] = useState<number[]>(() => new Array(words.length).fill(0))
  const [showCreate, setShowCreate] = useState(false)
  const [newAssocText, setNewAssocText] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'flagged' | 'error' | 'offensive'>('idle')
  const [createdForWord, setCreatedForWord] = useState<Set<number>>(() => new Set())

  const word = words[currentIndex]
  if (!word) return null

  const mainAssoc = getMainAssociation(word, associations[word.id])
  const communityBest = getCommunityBest(associations[word.id], mainAssoc?.id ?? null)
  const imageUrl = getWordImageUrl(word.id)
  const currentRating = ratings[currentIndex]
  const hasRated = currentRating > 0
  const hasCreated = createdForWord.has(word.id)

  // ── Rating handler ──

  const handleRate = useCallback((rating: number) => {
    setRatings((prev) => {
      const next = [...prev]
      next[currentIndex] = rating
      return next
    })

    // Fire-and-forget API call
    if (mainAssoc) {
      rateAssociation(mainAssoc.id, userId, rating)
    }

    onRatingGiven()
  }, [currentIndex, mainAssoc, userId, onRatingGiven])

  // ── Create association handler ──

  const handleSubmit = useCallback(async () => {
    const text = newAssocText.trim()
    if (!text) return

    // Client-side offensive check
    if (isOffensive(text)) {
      setSubmitStatus('offensive')
      return
    }

    setSubmitStatus('submitting')

    const result = await submitAssociation(
      word.id,
      word.english,
      text,
      userId,
      '', // author_name — empty for anonymous
    )

    if (!result) {
      setSubmitStatus('error')
      return
    }

    if (result.moderation === 'flagged') {
      setSubmitStatus('flagged')
    } else {
      setSubmitStatus('success')
      setCreatedForWord((prev) => new Set(prev).add(word.id))
      onAssociationCreated()
    }
  }, [newAssocText, word, userId, onAssociationCreated])

  // ── Advance handler ──

  const handleAdvance = useCallback(() => {
    // XP: +5 for rating, +10 if also created
    const xp = hasCreated ? 10 : 5
    gameSession.recordAnswer(word.id, true, 5, undefined, word, xp)

    if (currentIndex + 1 >= words.length) {
      onComplete()
      return
    }

    // Reset per-word state
    setShowCreate(false)
    setNewAssocText('')
    setSubmitStatus('idle')
    setCurrentIndex((i) => i + 1)
  }, [currentIndex, words.length, word, hasCreated, gameSession, onComplete])

  // ── Determine association text to show ──
  const assocText = mainAssoc?.text || word.association
  const assocSource = mainAssoc?.source || 'original'

  return (
    <div className="space-y-4" dir="rtl">
      {/* Word header with thumbnail */}
      <div
        className="flex items-center gap-3 p-4"
        style={{ background: CARD_BG, borderRadius: 20, border: CARD_BORDER }}
      >
        {/* Thumbnail */}
        {imageUrl && (
          <div
            className="flex-shrink-0 overflow-hidden"
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#fff',
            }}
          >
            <img
              src={imageUrl}
              alt={word.english}
              className="w-full h-full"
              style={{ objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p
            className="text-lg font-extrabold truncate"
            dir="ltr"
            style={{ color: TEXT, fontFamily: 'var(--font-display)' }}
          >
            {word.english}
          </p>
          <p className="text-sm" style={{ color: ACCENT }}>
            {word.hebrew}
          </p>
        </div>
      </div>

      {/* Association + rating card */}
      <div
        className="p-5"
        style={{ background: CARD_BG, borderRadius: 20, border: CARD_BORDER }}
      >
        {/* Association text */}
        <div
          className="p-3 rounded-xl mb-4"
          style={{ background: 'rgba(129,140,248,0.08)', borderRadius: 14 }}
        >
          <p className="text-sm leading-relaxed" style={{ color: TEXT }}>
            {assocText}
          </p>
        </div>

        {/* Star rating */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-semibold" style={{ color: MUTED }}>
            כמה עזר לך הטריק?
          </p>
          <StarRating value={currentRating} onChange={handleRate} />
        </div>
      </div>

      {/* Community best association */}
      {communityBest && (
        <div
          className="p-4"
          style={{
            background: CARD_BG,
            borderRadius: 20,
            border: `1px solid rgba(74,222,128,0.15)`,
          }}
        >
          <p
            className="text-[10px] font-bold mb-2 px-2 py-0.5 rounded-full inline-block"
            style={{
              background: 'rgba(74,222,128,0.15)',
              color: CORRECT,
              fontFamily: 'var(--font-display)',
            }}
          >
            הכי פופולרי
          </p>
          <p className="text-sm leading-relaxed mb-2" style={{ color: TEXT }}>
            {communityBest.text}
          </p>
          <div className="flex items-center gap-2 text-xs" style={{ color: MUTED }}>
            {communityBest.author_name && (
              <span>
                <span style={{ opacity: 0.6 }}>👤</span> {communityBest.author_name}
              </span>
            )}
            <span>
              <span style={{ opacity: 0.6 }}>⭐</span> {communityBest.avg_rating.toFixed(1)}
            </span>
          </div>
        </div>
      )}

      {/* Create your own association */}
      <div>
        {!showCreate ? (
          <button
            className="w-full py-3 text-sm font-semibold rounded-xl transition-all hover:scale-[1.01] active:scale-95"
            style={{
              background: 'rgba(129,140,248,0.1)',
              color: ACCENT,
              border: `1px solid rgba(129,140,248,0.2)`,
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
            }}
            onClick={() => setShowCreate(true)}
          >
            יש לך רעיון טוב יותר?
          </button>
        ) : (
          <div
            className="p-4"
            style={{ background: CARD_BG, borderRadius: 20, border: CARD_BORDER }}
          >
            <textarea
              value={newAssocText}
              onChange={(e) => {
                setNewAssocText(e.target.value)
                if (submitStatus !== 'idle') setSubmitStatus('idle')
              }}
              placeholder="כתוב את הטריק שלך לזכירה..."
              rows={3}
              className="w-full text-sm p-3 rounded-xl resize-none"
              dir="rtl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: TEXT,
                border: '1px solid rgba(255,255,255,0.1)',
                outline: 'none',
                fontFamily: 'var(--font-body)',
              }}
              disabled={submitStatus === 'submitting' || submitStatus === 'success'}
            />

            {/* Status messages */}
            {submitStatus === 'offensive' && (
              <p className="text-xs mt-2" style={{ color: WRONG }}>
                הטקסט מכיל תוכן לא מתאים. נסה שוב.
              </p>
            )}
            {submitStatus === 'error' && (
              <p className="text-xs mt-2" style={{ color: WRONG }}>
                שגיאה בשליחה. נסה שוב.
              </p>
            )}
            {submitStatus === 'flagged' && (
              <p className="text-xs mt-2" style={{ color: '#FBBF24' }}>
                האסוציאציה נשלחה לבדיקה.
              </p>
            )}
            {submitStatus === 'success' && (
              <p className="text-xs mt-2" style={{ color: CORRECT }}>
                נשלח בהצלחה! תודה!
              </p>
            )}

            {/* Submit button */}
            {submitStatus !== 'success' && (
              <button
                className="w-full py-3 mt-3 text-sm font-bold rounded-xl transition-all hover:scale-[1.01] active:scale-95"
                style={{
                  background: newAssocText.trim() ? ACCENT : 'rgba(129,140,248,0.2)',
                  color: newAssocText.trim() ? '#fff' : MUTED,
                  border: 'none',
                  cursor: newAssocText.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'var(--font-display)',
                }}
                onClick={handleSubmit}
                disabled={!newAssocText.trim() || submitStatus === 'submitting'}
              >
                {submitStatus === 'submitting' ? 'שולח...' : 'שלח'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Advance button */}
      <button
        className="w-full py-4 text-base font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-95"
        style={{
          background: hasRated ? BRAND_GRADIENT : 'rgba(255,255,255,0.06)',
          color: hasRated ? '#fff' : MUTED,
          border: 'none',
          cursor: hasRated ? 'pointer' : 'not-allowed',
          fontFamily: 'var(--font-display)',
          boxShadow: 'none',
          opacity: hasRated ? 1 : 0.5,
        }}
        onClick={handleAdvance}
        disabled={!hasRated}
      >
        הבא
      </button>

      {/* Progress */}
      <div className="text-center">
        <span className="text-xs font-semibold" style={{ color: MUTED }}>
          {currentIndex + 1}/{words.length}
        </span>
      </div>
    </div>
  )
}
