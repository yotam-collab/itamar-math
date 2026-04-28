import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useVocabStore } from '../../stores/vocabStore'
import { useGamificationStore } from '../../stores/gamificationStore'
import { speakEnglish, SpeakerBtn } from '../../utils/tts'
import { playSound } from '../../utils/sounds'
import { asset } from '../../utils/assetUrl'
import { getWordImageUrl } from '../../utils/wordImages'
import type { Word } from '../../data/vocabulary/types'
import { fetchAssociationsBatch, type WordAssociations } from '../../services/associationApi'
import { pickBestAssoc } from './utils/assocDisplay'

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

const SWIPE_THRESHOLD = 80

function FlashcardCard({ word, wordAssoc, onRate }: { word: Word; wordAssoc?: WordAssociations; onRate: (quality: number) => void }) {
  const [flipped, setFlipped] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const spokenRef = useRef(false)
  const imageUrl = getWordImageUrl(word.id)

  // ── Swipe state ──
  const [swipeX, setSwipeX] = useState(0)
  const swipingRef = useRef(false)
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 })
  const lockedAxisRef = useRef<'x' | 'y' | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!flipped) return
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
    lockedAxisRef.current = null
    swipingRef.current = true
  }, [flipped])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!flipped || !swipingRef.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y

    if (!lockedAxisRef.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      lockedAxisRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }

    if (lockedAxisRef.current === 'y') {
      swipingRef.current = false
      setSwipeX(0)
      return
    }

    if (lockedAxisRef.current === 'x') {
      e.preventDefault()
      setSwipeX(dx)
    }
  }, [flipped])

  const handleTouchEnd = useCallback(() => {
    if (!flipped || !swipingRef.current) return
    swipingRef.current = false

    if (swipeX > SWIPE_THRESHOLD) {
      playSound('correct')
      onRate(5) // קל
    } else if (swipeX < -SWIPE_THRESHOLD) {
      playSound('wrong')
      onRate(1) // לא ידעתי
    }

    setSwipeX(0)
  }, [flipped, swipeX, onRate])

  // Auto-play word pronunciation when card appears
  useEffect(() => {
    if (!spokenRef.current) {
      spokenRef.current = true
      const t = setTimeout(() => speakEnglish(word.english), 300)
      return () => clearTimeout(t)
    }
  }, [word.english])

  const swipeProgress = Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1)
  const isSwipingRight = swipeX > 20
  const isSwipingLeft = swipeX < -20
  const swipeRotation = (swipeX / 600) * 8

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 200px)', minHeight: 380 }}>
      {/* ── Card area ── */}
      <div
        className="flex-1 min-h-0 perspective-[1000px] relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe indicators */}
        {flipped && isSwipingRight && (
          <div
            className="absolute top-6 right-6 z-20 px-5 py-2.5 rounded-2xl font-bold text-lg"
            style={{
              background: `rgba(16,185,129,${0.1 + swipeProgress * 0.3})`,
              color: '#059669',
              border: '2px solid #059669',
              opacity: swipeProgress,
              fontFamily: 'var(--font-display)',
              transform: `scale(${0.8 + swipeProgress * 0.2})`,
            }}
          >
            קל! 😎
          </div>
        )}
        {flipped && isSwipingLeft && (
          <div
            className="absolute top-6 left-6 z-20 px-5 py-2.5 rounded-2xl font-bold text-lg"
            style={{
              background: `rgba(239,68,68,${0.1 + swipeProgress * 0.3})`,
              color: '#DC2626',
              border: '2px solid #DC2626',
              opacity: swipeProgress,
              fontFamily: 'var(--font-display)',
              transform: `scale(${0.8 + swipeProgress * 0.2})`,
            }}
          >
            לא ידעתי 😕
          </div>
        )}

        <div
          className={`relative w-full h-full transition-transform duration-300 cursor-pointer ${
            flipped ? '[transform:rotateY(180deg)]' : ''
          }`}
          style={{
            transformStyle: 'preserve-3d',
            ...(swipeX !== 0 && flipped
              ? {
                  transform: `rotateY(180deg) translateX(${-swipeX}px) rotate(${-swipeRotation}deg)`,
                  transition: 'none',
                }
              : {}),
          }}
          onClick={() => { if (!flipped) { setFlipped(true); playSound('flip') } }}
        >
          {/* Front - English word */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-8"
            style={{ background: BG, boxShadow: S.extruded, borderRadius: 32, backfaceVisibility: 'hidden' }}
          >
            <span
              className="text-4xl font-extrabold mb-4"
              dir="ltr"
              style={{ color: TEXT, fontFamily: 'var(--font-display)' }}
            >
              {word.english}
            </span>
            <div className="mb-4">
              <SpeakerBtn text={word.english} size={22} />
            </div>
            <span className="text-sm" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
              הקש לחשיפה
            </span>
          </div>

          {/* Back - Hebrew + details (scrollable) */}
          <div
            className="absolute inset-0 flex flex-col items-center gap-3 p-5 overflow-y-auto"
            style={{
              background: BG, boxShadow: S.extruded, borderRadius: 32,
              backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
            }}
          >
            {/* Character image */}
            <img
              src={asset('char-english.png')}
              alt=""
              className="absolute"
              style={{ left: 12, top: 12, width: 56, height: 56, objectFit: 'contain', opacity: 0.5, pointerEvents: 'none' }}
            />

            {/* Hebrew meaning */}
            <div className="flex items-center gap-3">
              <span className="text-3xl md:text-4xl font-extrabold" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
                {word.hebrew}
              </span>
              <SpeakerBtn text={word.english} size={20} />
            </div>

            {/* Word image — compact */}
            {imageUrl && (
              <div className="flex justify-center">
                <div
                  className="overflow-hidden"
                  style={{ borderRadius: 16, boxShadow: S.inset, maxWidth: 180, background: BG }}
                >
                  <img
                    src={imageUrl}
                    alt={word.english}
                    loading="lazy"
                    onLoad={() => setImgLoaded(true)}
                    className={`w-full h-auto transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                    style={{ display: 'block', maxHeight: 110, objectFit: 'cover' }}
                  />
                </div>
              </div>
            )}

            {word.example && (
              <div className="w-full p-4 rounded-2xl" style={{ background: BG, boxShadow: S.inset }}>
                <p className="text-xs font-bold mb-2 px-1" style={{ color: ACCENT, fontFamily: 'var(--font-display)' }}>
                  משפט לדוגמא
                </p>
                <div className="flex items-center gap-2 mb-2 w-full justify-center">
                  <p className="text-base text-center leading-relaxed flex-1" dir="ltr" style={{ color: TEXT, fontFamily: 'var(--font-body)' }}>
                    {word.example}
                  </p>
                  <SpeakerBtn text={word.example} size={18} />
                </div>
                {word.exampleHebrew && (
                  <>
                    <p className="text-xs font-bold mb-1 px-1" style={{ color: MUTED, fontFamily: 'var(--font-display)' }}>
                      פירוש משפט לדוגמא
                    </p>
                    <p className="text-sm text-center" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>{word.exampleHebrew}</p>
                  </>
                )}
              </div>
            )}

            {(() => {
              const pick = pickBestAssoc(word, wordAssoc)
              if (!pick) return null
              return (
                <div className="w-full p-4 rounded-2xl" style={{ background: BG, boxShadow: S.inset }}>
                  <p className="text-xs font-bold mb-1 px-1" style={{ color: ACCENT, fontFamily: 'var(--font-display)' }}>
                    💡 אסוציאציה
                  </p>
                  <p className="text-sm text-center mb-2" style={{ color: TEXT, fontFamily: 'var(--font-body)' }}>
                    {pick.text}
                  </p>
                  <p
                    className="text-[10.5px] text-center"
                    style={{
                      color: pick.isGuide ? ACCENT : MUTED,
                      fontFamily: 'var(--font-display)',
                      fontWeight: pick.isGuide ? 800 : 600,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {pick.isGuide ? '✨' : '👤'} {pick.label}
                  </p>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ── Rating buttons — ALWAYS visible below card ── */}
      {flipped && (
        <div className="flex gap-3 pt-3 pb-1 flex-shrink-0">
          {[
            { label: 'קל! 😎', quality: 5, bg: '#D1FAE5', shadow: '0 2px 8px rgba(16,185,129,0.15)', color: '#059669' },
            { label: 'קשה 🤔', quality: 3, bg: '#FEF3C7', shadow: '0 2px 8px rgba(245,158,11,0.15)', color: '#D97706' },
            { label: 'לא ידעתי 😕', quality: 1, bg: '#FEE2E2', shadow: '0 2px 8px rgba(239,68,68,0.15)', color: '#DC2626' },
          ].map((btn) => (
            <button
              key={btn.quality}
              className="flex-1 py-3 rounded-2xl font-bold text-sm transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 hover:scale-[1.02] active:scale-95"
              style={{
                background: btn.bg,
                boxShadow: btn.shadow,
                color: btn.color,
                fontFamily: 'var(--font-display)',
                border: 'none',
                cursor: 'pointer',
              }}
              onClick={(e) => { e.stopPropagation(); onRate(btn.quality) }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {flipped && (
        <p className="text-center text-xs pb-1 flex-shrink-0" style={{ color: MUTED, opacity: 0.5 }}>
          ← החלק שמאלה / ימינה →
        </p>
      )}
    </div>
  )
}

export function FlashcardDeck() {
  const navigate = useNavigate()
  const location = useLocation()
  const isReviewMode = location.pathname.includes('/review')
  const { currentUnit, getWordsForUnit, getReviewQueue, updateStudentWord } = useVocabStore()
  const { addXP, checkStreak } = useGamificationStore()

  const deckWords = useMemo(() => {
    if (isReviewMode) {
      const queue = getReviewQueue()
      return queue.sort(() => Math.random() - 0.5).slice(0, 30)
    }
    return getWordsForUnit(currentUnit)
  }, [isReviewMode, currentUnit, getWordsForUnit, getReviewQueue])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [reviewed, setReviewed] = useState(0)
  const [key, setKey] = useState(0)

  /* Fetch student-submitted + AI-generated associations for the whole
     deck once on mount. The Cloudflare worker (znk-associations.*) holds
     the live community pool keyed by word_id; pickBestAssoc() decides
     which one to surface per word — preferring well-rated student cards
     over the static word.association from words.json. */
  const [associations, setAssociations] = useState<Record<number, WordAssociations>>({})
  useEffect(() => {
    if (deckWords.length === 0) return
    const wordIds = deckWords.map(w => w.id)
    let cancelled = false
    fetchAssociationsBatch(wordIds).then(data => {
      if (!cancelled) setAssociations(data)
    })
    return () => { cancelled = true }
  }, [deckWords])

  const handleRate = useCallback((quality: number) => {
    const word = deckWords[currentIndex]
    if (!word) return

    updateStudentWord(word.id, quality)
    addXP(quality >= 3 ? 5 : 2)
    checkStreak()
    setReviewed((r) => r + 1)

    if (currentIndex < deckWords.length - 1) {
      setCurrentIndex((i) => i + 1)
      setKey((k) => k + 1)
    }
  }, [currentIndex, deckWords, updateStudentWord, addXP, checkStreak])

  if (deckWords.length === 0) {
    return (
      <div
        className="text-center py-12 rounded-[32px]"
        style={{ background: BG, boxShadow: S.extruded }}
      >
        <p className="text-lg mb-4" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
          {isReviewMode ? 'אין מילים לחזרה כרגע — כל הכבוד!' : 'אין מילים ביחידה זו'}
        </p>
        <button
          className="neu-btn-accent text-sm px-6 py-3"
          onClick={() => navigate('/vocabulary')}
        >
          חזרה למילון
        </button>
      </div>
    )
  }

  const isFinished = currentIndex >= deckWords.length - 1 && reviewed > 0
  const currentWord = deckWords[currentIndex]
  const title = isReviewMode ? 'חזרה יומית' : `יחידה ${currentUnit}`
  const progressPct = ((currentIndex + 1) / deckWords.length) * 100

  return (
    <div
      className="space-y-4 animate-fadeIn"
      /* Padding-bottom clears the fixed mobile bottom-nav (~72px + safe-area)
         so the rating buttons (קל / קשה / לא ידעתי) and the deck-finish
         CTA never sit under the nav on iPhones. md:hidden nav means this
         is harmless extra space on desktop. */
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 10px) + 80px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          className="px-4 py-2 rounded-xl font-bold text-sm"
          style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }}
          onClick={() => navigate('/vocabulary')}
        >
          ← חזרה
        </button>
        <h2 className="font-bold text-lg" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
          {title}
        </h2>
        <span className="text-sm font-bold" style={{ color: MUTED, fontFamily: 'var(--font-display)' }}>
          {currentIndex + 1}/{deckWords.length}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-3 rounded-xl overflow-hidden"
        style={{ background: BG, boxShadow: S.inset }}
        dir="ltr"
      >
        <div
          className="h-full rounded-xl transition-[transform,box-shadow,background-color,border-color,opacity] duration-300"
          style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${ACCENT}, ${SECONDARY})` }}
        />
      </div>

      {isFinished ? (
        <div
          className="text-center py-12 px-6"
          style={{ background: BG, boxShadow: S.extruded, borderRadius: 32 }}
        >
          <div
            className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ background: BG, boxShadow: S.insetDeep }}
          >
            <img src={asset('znk-icon-12.png')} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          </div>
          <h2 className="text-xl font-extrabold mb-2" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
            כל הכבוד!
          </h2>
          <p className="mb-6" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
            סיימת {reviewed} מילים {isReviewMode ? 'בחזרה יומית' : `ביחידה ${currentUnit}`}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              className="px-6 py-3 rounded-xl font-bold text-sm"
              style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }}
              onClick={() => { setCurrentIndex(0); setReviewed(0); setKey((k) => k + 1) }}
            >
              חזרה נוספת
            </button>
            <button
              className="neu-btn-accent text-sm px-6 py-3"
              onClick={() => navigate('/vocabulary')}
            >
              חזרה למילון
            </button>
          </div>
        </div>
      ) : (
        <FlashcardCard key={key} word={currentWord} wordAssoc={associations[currentWord.id]} onRate={handleRate} />
      )}
    </div>
  )
}
