import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useVocabStore } from '../../stores/vocabStore'
import { useMyWordsStore, type WordSource } from '../../stores/myWordsStore'
import { speakWordAndMeaning } from '../../utils/tts'
import { playSound } from '../../utils/sounds'
import { translateWord, getCachedTranslation } from '../../utils/translationCache'

/* ── Design tokens (matches neumorphic theme) ── */
const BG = '#E0E5EC'
const ACCENT = '#6C63FF'
const TEXT = '#3D4852'
const MUTED = '#6B7280'
const CORRECT = '#10B981'
const S_SM = '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)'

/* ── Helpers ── */
function cleanWord(w: string): string {
  return w.replace(/[^a-zA-Z'-]/g, '').toLowerCase()
}

function tokenize(text: string): { word: string; isWord: boolean }[] {
  const tokens: { word: string; isWord: boolean }[] = []
  const regex = /(\S+)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ word: text.slice(lastIndex, match.index), isWord: false })
    }
    tokens.push({ word: match[1], isWord: true })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    tokens.push({ word: text.slice(lastIndex), isWord: false })
  }
  return tokens
}

/* ── Props ── */
interface ClickableEnglishTextProps {
  /** The English text to render with clickable words */
  text: string
  /** Source tag for words added to personal vocabulary */
  source?: WordSource
  /** CSS class for the wrapper */
  className?: string
  /** Inline styles for the wrapper */
  style?: React.CSSProperties
  /** Font size override (default: inherit) */
  fontSize?: number | string
  /** Show paragraph breaks on double-newlines (default: true) */
  paragraphs?: boolean
  /** Enable long-press highlighting (marker) — for practice mode, not exams */
  allowHighlight?: boolean
}

/* ══════════════════════════════════════════════════════════════════
   ClickableEnglishText
   Makes every word in an English text clickable — shows translation
   popup and lets the user add it to their personal dictionary.
   ══════════════════════════════════════════════════════════════════ */
export function ClickableEnglishText({
  text,
  source = 'manual',
  className = '',
  style,
  fontSize,
  paragraphs = true,
  allowHighlight = false,
}: ClickableEnglishTextProps) {
  const vocabWords = useVocabStore((s) => s.words)
  const { addWord: addMyWord, hasWord: hasMyWord } = useMyWordsStore()

  // Highlighting (marker) state — long-press to toggle
  const [highlightedWords, setHighlightedWords] = useState<Set<number>>(new Set())
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleWordPointerDown = useCallback((wordIndex: number) => {
    if (!allowHighlight) return
    longPressTimer.current = setTimeout(() => {
      setHighlightedWords(prev => {
        const next = new Set(prev)
        if (next.has(wordIndex)) next.delete(wordIndex)
        else next.add(wordIndex)
        return next
      })
      // Prevent the click popup from opening after long-press
      longPressTimer.current = null
    }, 400) // 400ms long-press
  }, [allowHighlight])

  const handleWordPointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const [tappedIdx, setTappedIdx] = useState<number | null>(null)
  const [apiTranslation, setApiTranslation] = useState<string | null>(null)
  const [apiLoading, setApiLoading] = useState(false)
  const [justAdded, setJustAdded] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  // Build vocab lookup map
  const vocabMap = useMemo(() => {
    const map = new Map<string, { hebrew: string; id: number }>()
    for (const w of vocabWords) {
      map.set(w.english.toLowerCase(), { hebrew: w.hebrew, id: w.id })
    }
    return map
  }, [vocabWords])

  // Tokenize text
  const tokens = useMemo(() => tokenize(text), [text])

  // Close popup on outside click
  useEffect(() => {
    if (tappedIdx === null) return
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setTappedIdx(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [tappedIdx])

  // Close popup when text changes (e.g. new question)
  useEffect(() => {
    setTappedIdx(null)
  }, [text])

  const handleWordTap = useCallback((idx: number) => {
    setTappedIdx((prev) => {
      if (prev === idx) return null
      // When opening a new popup, check if we need API translation
      const token = tokens[idx]
      if (token?.isWord) {
        const clean = cleanWord(token.word)
        const match = vocabMap.get(clean)
        if (!match && clean.length > 1) {
          // Check cache first
          const cached = getCachedTranslation(clean)
          if (cached) {
            setApiTranslation(cached)
            setApiLoading(false)
          } else {
            setApiTranslation(null)
            setApiLoading(true)
            translateWord(clean).then((result) => {
              setApiTranslation(result)
              setApiLoading(false)
            })
          }
        } else {
          setApiTranslation(null)
          setApiLoading(false)
        }
      }
      return idx
    })
  }, [tokens, vocabMap])

  const handleAddWord = useCallback((english: string, hebrewOverride?: string) => {
    const clean = cleanWord(english)
    const match = vocabMap.get(clean)
    const hebrew = hebrewOverride || match?.hebrew || ''
    addMyWord(clean, hebrew, source, match?.id ?? null)
    playSound('correct')
    setJustAdded(true)
    setTimeout(() => { setJustAdded(false); setTappedIdx(null) }, 1200)
  }, [vocabMap, addMyWord, source])

  return (
    <span
      className={className}
      dir="ltr"
      style={{ ...style, fontSize, lineHeight: 1.7 }}
    >
      {tokens.map((token, i) => {
        if (!token.isWord) {
          if (paragraphs && token.word.includes('\n\n')) {
            return <span key={i} className="block mb-4" />
          }
          return <span key={i}>{token.word}</span>
        }

        const clean = cleanWord(token.word)
        const inMyWords = clean.length > 1 && hasMyWord(clean)
        const inDict = clean.length > 1 && vocabMap.has(clean)

        return (
          <span key={i} className="relative inline">
            <span
              className="cursor-pointer transition-colors duration-150 hover:bg-[#6C63FF10]"
              style={{
                borderBottom: inMyWords
                  ? `2px dotted ${ACCENT}50`
                  : inDict
                    ? `1px dashed ${MUTED}30`
                    : 'none',
                borderRadius: 2,
                background: highlightedWords.has(i) ? 'rgba(250, 204, 21, 0.4)' : undefined,
                padding: highlightedWords.has(i) ? '1px 2px' : undefined,
              }}
              onClick={() => handleWordTap(i)}
              onPointerDown={() => handleWordPointerDown(i)}
              onPointerUp={handleWordPointerUp}
              onPointerCancel={handleWordPointerUp}
            >
              {token.word}
            </span>

            {/* Word popup */}
            {tappedIdx === i && (
              <div
                ref={popupRef}
                className="absolute z-[100] animate-fadeIn"
                style={{
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 8,
                  background: BG,
                  boxShadow: `${S_SM}, 0 4px 20px rgba(0,0,0,0.12)`,
                  borderRadius: 14,
                  padding: '10px 14px',
                  minWidth: 170,
                  whiteSpace: 'nowrap',
                }}
              >
                {(() => {
                  if (justAdded) {
                    return (
                      <div className="text-center">
                        <p className="text-sm font-bold" style={{ color: CORRECT }}>✓ נוסף!</p>
                      </div>
                    )
                  }
                  const match = vocabMap.get(clean)
                  const hebrew = match?.hebrew || apiTranslation || ''
                  if (!match && !apiTranslation && !apiLoading) {
                    return (
                      <div className="text-center">
                        <p className="text-sm font-bold mb-0.5" style={{ color: TEXT }}>{clean}</p>
                        <p className="text-[10px]" style={{ color: MUTED }}>לא נמצא תרגום</p>
                        <button
                          className="mt-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
                          style={{ background: `${MUTED}20`, color: MUTED, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)' }}
                          onClick={(e) => { e.stopPropagation(); handleAddWord(token.word) }}
                        >
                          + הוסף בכל זאת
                        </button>
                      </div>
                    )
                  }
                  if (!match && apiLoading) {
                    return (
                      <div className="text-center">
                        <p className="text-sm font-bold mb-0.5" style={{ color: TEXT }}>{clean}</p>
                        <p className="text-[10px]" style={{ color: MUTED }}>מתרגם...</p>
                      </div>
                    )
                  }
                  return (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-0.5">
                        <p className="text-sm font-bold" style={{ color: TEXT }}>
                          <span style={{ color: ACCENT }}>{clean}</span> = {hebrew}
                        </p>
                        <button
                          className="flex items-center justify-center rounded-full transition-[transform,box-shadow,background-color,border-color,opacity] active:scale-90"
                          style={{ width: 24, height: 24, background: `${ACCENT}15`, border: 'none', cursor: 'pointer' }}
                          onClick={(e) => { e.stopPropagation(); speakWordAndMeaning(clean, hebrew) }}
                          title="הקרא מילה ותרגום"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={ACCENT}><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.5v7a4.49 4.49 0 0 0 2.5-3.5zM14 3.23v2.06a7.007 7.007 0 0 1 0 13.42v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                        </button>
                      </div>
                      {inMyWords ? (
                        <p className="text-[10px] mt-1" style={{ color: CORRECT }}>✓ כבר ברשימה שלך</p>
                      ) : (
                        <button
                          className="mt-1.5 px-3 py-1 rounded-full text-[11px] font-bold znk-tooltip"
                          style={{ background: `linear-gradient(135deg, ${ACCENT}, #8B5CF6)`, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)' }}
                          onClick={(e) => { e.stopPropagation(); handleAddWord(token.word, hebrew) }}
                        >
                          <span className="znk-tip" data-placement="top" role="tooltip">
                            תופיע בתרגולים הבאים — מילים אישיות נכבשות הכי מהר
                          </span>
                          + הוסף ללמידה
                        </button>
                      )}
                    </div>
                  )
                })()}
                {/* Arrow pointer */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: -6,
                    left: '50%',
                    transform: 'translateX(-50%) rotate(45deg)',
                    width: 12,
                    height: 12,
                    background: BG,
                    boxShadow: '3px 3px 6px rgb(163,177,198,0.4)',
                  }}
                />
              </div>
            )}
          </span>
        )
      })}
    </span>
  )
}
