import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useReadingStore } from '../../stores/readingStore'
import { useGamificationStore } from '../../stores/gamificationStore'
import { useVocabStore } from '../../stores/vocabStore'
import { useMyWordsStore } from '../../stores/myWordsStore'
import { SpeakerBtn, TTSSpeedBtn, speakWithTrackingAsync, stopAllTTS, speakEnglish } from '../../utils/tts'
import { playSound } from '../../utils/sounds'
import { onSessionComplete } from '../../utils/examHelpers'
import { asset } from '../../utils/assetUrl'
import { useTTSSettingsStore } from '../../stores/ttsSettingsStore'
import { translateWord, getCachedTranslation } from '../../utils/translationCache'
import textsData from '../../data/reading/texts.json'
import readingImages from '../../data/reading/reading-images.json'
import { ReadingResultScreen } from './ReadingResultScreen'
import { InstructionsOverlay, useInstructions } from '../../components/common/InstructionsOverlay'

/* ─── Design tokens ─── */
const S = {
  extruded: '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)',
  extrudedSm: '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)',
  inset: 'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)',
} as const

const BG = '#E0E5EC'
const ACCENT = '#6C63FF'
const SECONDARY = '#38B2AC'
const TEXT = '#3D4852'
const MUTED = '#6B7280'
const CORRECT = '#10B981'
const WRONG = '#EF4444'
const READING_BG = '#F7F5EF' // warm reading background

/* Map raw passage difficulty (1..5) into a 4-band bucket so that the
   level shown here matches the recommendation cards / library grid in
   ReadingHome (BUCKET_OF_LEGACY there is the source of truth). Without
   this mapping a passage labelled "בינוני" on the library showed up as
   "מתקדם" inside the reader — the same physical passage with two
   different difficulty captions, which confused students. */
const BUCKET_OF_LEGACY: Record<number, 1 | 2 | 3 | 4> = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4 }
const bucketLabels: Record<1 | 2 | 3 | 4, string> = {
  1: 'קל',
  2: 'בינוני',
  3: 'קשה',
  4: 'מומחה',
}
const bucketColors: Record<1 | 2 | 3 | 4, string> = {
  1: CORRECT,
  2: '#F59E0B',
  3: '#EE2B73',
  4: '#6B3FA0',
}
const labelForDifficulty = (d: number): string => bucketLabels[BUCKET_OF_LEGACY[d] ?? 1]
const colorForDifficulty = (d: number): string => bucketColors[BUCKET_OF_LEGACY[d] ?? 1]

/* ─── Types ─── */
interface RCQuestion {
  id: string
  question: string
  options: string[]
  correct: number
  explanation: string | { questionTranslation: string; optionAnalysis: string[] }
}

interface ReadingPassage {
  id: string
  title: string
  titleHe?: string         // Hebrew title (from texts.json)
  descriptionHe?: string   // Hebrew 1-2 sentence teaser
  difficulty: number
  topic: string
  wordCount: number
  passage: string
  questions: RCQuestion[]
}

type Phase = 'reading' | 'quiz' | 'results'

/* ─── Helpers ─── */
/** Split text into tokens preserving whitespace for reconstruction */
function tokenize(text: string): { word: string; isWord: boolean; charStart: number }[] {
  const tokens: { word: string; isWord: boolean; charStart: number }[] = []
  const regex = /(\S+)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ word: text.slice(lastIndex, match.index), isWord: false, charStart: lastIndex })
    }
    tokens.push({ word: match[1], isWord: true, charStart: match.index })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    tokens.push({ word: text.slice(lastIndex), isWord: false, charStart: lastIndex })
  }
  return tokens
}

/** Strip punctuation for dictionary lookup */
function cleanWord(w: string): string {
  return w.replace(/[^a-zA-Z'-]/g, '').toLowerCase()
}

/* ================================================================== */
/*  InAppReader                                                        */
/* ================================================================== */

export function InAppReader() {
  const navigate = useNavigate()
  const { passageId } = useParams<{ passageId: string }>()
  const instructions = useInstructions('reading-passage')
  const { addSession } = useReadingStore()
  const { addXP, checkStreak } = useGamificationStore()
  const vocabWords = useVocabStore((s) => s.words)
  const { addWord: addMyWord, hasWord: hasMyWord } = useMyWordsStore()

  const passage = useMemo(() => {
    return (textsData as ReadingPassage[]).find((p) => p.id === passageId) ?? null
  }, [passageId])

  const [phase, setPhase] = useState<Phase>('reading')
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [score, setScore] = useState(0)
  const [startTime] = useState(Date.now())
  const [resultsSaved, setResultsSaved] = useState(false)
  // Per-question chosen option index (parallel to questions[] order). Used by
  // ReadingResultScreen to build the "wrong questions" review list.
  const [answers, setAnswers] = useState<number[]>([])

  /* When the student navigates to a DIFFERENT passage (e.g., via the
     "suggested passages" cards on the result screen), the URL parameter
     changes but React keeps this component mounted. Without an explicit
     reset, the student lands on the new URL but still sees the OLD
     result-phase or mid-quiz state. Forcing full state reset on
     passageId change fixes the broken-link symptom. */
  useEffect(() => {
    setPhase('reading')
    setCurrentQ(0)
    setSelected(null)
    setShowExplanation(false)
    setScore(0)
    setAnswers([])
    setResultsSaved(false)
    // Scroll to top so the new passage starts visually fresh
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [passageId])

  /* ─── Reading mission timer ─── */
  // Increments `znk-reading-timer` only while the student is inside a passage.
  // The reading library (ReadingHome) intentionally does NOT run this — this
  // ensures the coach's "reading minutes" mission reflects actual reading,
  // not mere browsing.
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const id = window.setInterval(() => {
      try {
        const raw = localStorage.getItem('znk-reading-timer')
        let base = 0
        if (raw) {
          const prev = JSON.parse(raw)
          if (prev.date === today) base = prev.elapsedSec || 0
        }
        localStorage.setItem(
          'znk-reading-timer',
          JSON.stringify({ date: today, elapsedSec: base + 1 }),
        )
      } catch { /* ignore */ }
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // Word-tap state
  const [tappedIdx, setTappedIdx] = useState<number | null>(null)
  const [apiTranslation, setApiTranslation] = useState<string | null>(null)
  const [apiLoading, setApiLoading] = useState(false)
  const [sessionAdded, setSessionAdded] = useState<Set<string>>(new Set())
  const popupRef = useRef<HTMLDivElement>(null)

  // TTS tracking state
  const [highlightCharIdx, setHighlightCharIdx] = useState<number | null>(null)
  const [isReadAloud, setIsReadAloud] = useState(false)
  const cancelTTSRef = useRef<(() => void) | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  // Scroll progress
  const readingContainerRef = useRef<HTMLDivElement>(null)
  // Ref to the "הבא ←" button on the quiz panel so Enter can trigger it
  // once an answer is revealed — matches SentenceCompletion's pattern.
  const quizNextBtnRef = useRef<HTMLButtonElement>(null)
  const [scrollPct, setScrollPct] = useState(0)

  // Build vocab lookup map
  const vocabMap = useMemo(() => {
    const map = new Map<string, { hebrew: string; id: number }>()
    for (const w of vocabWords) {
      map.set(w.english.toLowerCase(), { hebrew: w.hebrew, id: w.id })
    }
    return map
  }, [vocabWords])

  // Tokenize passage
  const tokens = useMemo(() => {
    if (!passage) return []
    return tokenize(passage.passage)
  }, [passage])

  // Close popup on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setTappedIdx(null)
      }
    }
    if (tappedIdx !== null) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [tappedIdx])

  // Track scroll progress
  useEffect(() => {
    const el = readingContainerRef.current
    if (!el || phase !== 'reading') return
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement
      const pct = scrollHeight > clientHeight ? Math.min(100, Math.round((scrollTop / (scrollHeight - clientHeight)) * 100)) : 100
      setScrollPct(pct)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [phase])

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      if (cancelTTSRef.current) cancelTTSRef.current()
      if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current.currentTime = 0 }
      stopAllTTS()
    }
  }, [])

  // Keyboard shortcuts for the quiz phase: 1-4 to pick an option, Enter to
  // advance once the explanation is visible. Matches the UX already shipped
  // in SentenceCompletion / Restatement / ReadingComprehension so students
  // can blaze through the whole track without reaching for the mouse.
  useEffect(() => {
    if (phase !== 'quiz') return
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const passage = passageId ? (textsData as unknown as ReadingPassage[]).find((p) => p.id === passageId) : null
      const q = passage?.questions?.[currentQ]
      if (!q) return
      const key = e.key
      if (key >= '1' && key <= '4') {
        const idx = parseInt(key, 10) - 1
        if (idx >= 0 && idx < q.options.length && selected === null) {
          e.preventDefault()
          setSelected(idx)
          playSound(idx === q.correct ? 'correct' : 'wrong')
          if (idx === q.correct) setScore((s) => s + 1)
          setAnswers((prev) => {
            const next = prev.slice()
            next[currentQ] = idx
            return next
          })
          setShowExplanation(true)
        }
      } else if (key === 'Enter' && showExplanation) {
        e.preventDefault()
        quizNextBtnRef.current?.click()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, currentQ, selected, showExplanation, passageId])

  const handleWordTap = useCallback((idx: number) => {
    setTappedIdx((prev) => {
      if (prev === idx) return null
      const token = tokens[idx]
      if (token?.isWord) {
        const clean = cleanWord(token.word)
        const match = vocabMap.get(clean)
        if (!match && clean.length > 1) {
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

  const handleAddWord = useCallback((english: string) => {
    const clean = cleanWord(english)
    const match = vocabMap.get(clean)
    if (match) {
      addMyWord(clean, match.hebrew, 'reading', match.id)
    } else {
      addMyWord(clean, '', 'reading', null)
    }
    setSessionAdded((prev) => new Set(prev).add(clean))
  }, [vocabMap, addMyWord])

  // Pre-generated audio: 75 passages have matching MP3 recordings
  const [audioLookup, setAudioLookup] = useState<Record<string, string>>({})
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'audio/en/reading/lookup.json')
      .then(r => r.json())
      .then(setAudioLookup)
      .catch(() => {})
  }, [])
  const readingAudioPath = passage && audioLookup[passage.id]
    ? `${import.meta.env.BASE_URL}audio/en/reading/${audioLookup[passage.id]}`
    : null

  const startReadAloud = useCallback(async () => {
    if (!passage) return
    setIsReadAloud(true)

    /* ═══════════════════════════════════════════════════════════════
       TTS Highlight Tracking — Weighted Timeline v2
       ───────────────────────────────────────────────────────────────
       The old linear char-proportion algorithm assumed time ≈ characters,
       which drifts heavily when text has:
         • many commas/periods (natural speech pauses aren't counted)
         • lots of short function words ("the", "a", "is" have floor time)
         • long multi-syllable words (proportionally more time than chars)

       New approach — build a per-word TIMELINE at playback start:
         1. Each word gets a weight reflecting its speaking duration.
         2. Punctuation between words adds pause weight (., ?, ! ≈ 0.8 word).
         3. Weights sum → total. Each word's start-time = cumulative weight
            ratio × audio duration (minus fixed start/end silence pads).
         4. On timeupdate, binary-search the timeline for the current word.

       This gives near-perfect sync on most TTS files because the weights
       match how ElevenLabs / Web Speech / natural voices actually distribute
       time across a sentence.
       ═══════════════════════════════════════════════════════════════ */

    // If we have a pre-generated audio file, use weighted-timeline tracking
    if (readingAudioPath) {
      try {
        if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current.currentTime = 0 }
        const audio = new Audio(readingAudioPath)
        audio.playbackRate = useTTSSettingsStore.getState().ttsSpeed
        currentAudioRef.current = audio

        // ── Build weighted word timeline ──
        const wordTokens = tokens.filter(t => t.isWord)
        if (wordTokens.length === 0) return

        /** Compute speaking weight for a word — v2 calibration (2026-04-23).
         *  Prior formula had `base = 0.45` which over-allocated time to
         *  short words ("a", "the", "of"), making the cumulative timeline
         *  drift earlier than audio. Real speech: 1-char ≈ 0.12s, 3-char
         *  ≈ 0.22s, 10-char ≈ 0.80s (ratios ~1 : 1.8 : 6.7 — much steeper
         *  than the old 1 : 1.4 : 4). New values match this steeper curve.
         *   - Low base — short words aren't heavy
         *   - Steeper linear — each added char costs more
         *   - Strong bonus for 7+ char words (where multisyllable kicks in)
         */
        const wordWeight = (w: string): number => {
          const len = w.length
          const base = 0.18
          const linear = 0.14 * len
          const longBonus = len > 6 ? 0.09 * (len - 6) : 0
          return base + linear + longBonus
        }

        /** Punctuation pause weights — also re-calibrated for Flash v2.5.
         *  Sentence-end pauses are shorter in Flash than in the older
         *  multilingual model (Flash prioritises throughput). */
        const punctPause = (text: string): number => {
          if (!text) return 0
          let pause = 0
          if (/[.!?][\s'"')\]]*$/.test(text)) pause += 0.55   // sentence end
          else if (/[;:][\s'"')\]]*$/.test(text)) pause += 0.32  // clause break
          else if (/,[\s'"')\]]*$/.test(text)) pause += 0.22     // comma
          else if (/[—–\-]{1,2}[\s'"')\]]*$/.test(text)) pause += 0.22 // em-dash
          else if (/\n/.test(text)) pause += 0.45  // paragraph break
          return pause
        }

        // Walk tokens in order so we can attribute punctuation to the PRECEDING word
        const weights: number[] = new Array(wordTokens.length)
        let wi = 0
        for (let i = 0; i < tokens.length; i++) {
          const tk = tokens[i]
          if (tk.isWord) {
            let w = wordWeight(tk.word)
            // Check if word itself has trailing punctuation (e.g., "end.")
            const trailing = tk.word.match(/[.!?,;:—–\-]+$/)
            if (trailing) w += punctPause(trailing[0])
            weights[wi++] = w
          } else {
            // Non-word token (whitespace/newlines) — add its pause to the PREVIOUS word
            if (wi > 0) weights[wi - 1] += punctPause(tk.word)
          }
        }

        // Cumulative weight at END of each word
        const cumEnd: number[] = new Array(wordTokens.length)
        let sum = 0
        for (let i = 0; i < wordTokens.length; i++) {
          sum += weights[i]
          cumEnd[i] = sum
        }
        const totalWeight = sum

        /** Fixed silence padding observed in Flash v2.5 output.
         *  Re-measured 2026-04-23: ElevenLabs Flash opens with ~0.22s of
         *  voice intake + fade-in, and ends with ~0.35s fade-out. Correct
         *  values here move the entire timeline left, killing drift. */
        const LEADING_SILENCE = 0.22
        const TRAILING_SILENCE = 0.35

        /** Visual lead — the highlight appears this many seconds BEFORE the
         *  audio pronounces the word. Previous 0.30 was too aggressive and
         *  combined with the old weight formula made highlights arrive early.
         *  0.08 keeps the highlight just a tiny bit ahead, matching natural
         *  read-along where eyes lead voice by a token. */
        const HIGHLIGHT_LEAD_S = 0.08

        /** Compute the word index that should be highlighted at audio time `t`.
         *  Uses binary search over the cumulative-weight timeline. */
        const computeWordIdx = (t: number, dur: number): number => {
          if (t <= LEADING_SILENCE) return 0
          if (t >= dur - TRAILING_SILENCE) return wordTokens.length - 1
          const speechDur = dur - LEADING_SILENCE - TRAILING_SILENCE
          const progress = (t - LEADING_SILENCE) / speechDur
          const targetWeight = progress * totalWeight
          // Binary search: first cumEnd[i] >= targetWeight
          let lo = 0, hi = wordTokens.length - 1
          while (lo < hi) {
            const mid = (lo + hi) >>> 1
            if (cumEnd[mid] < targetWeight) lo = mid + 1
            else hi = mid
          }
          return lo
        }

        let lastWordIdx = -1

        // timeupdate fires ~4/sec — smooth enough for word-level tracking
        // and skips frames when tab is hidden (browser optimization).
        const onTimeUpdate = () => {
          const dur = audio.duration
          if (!dur || !Number.isFinite(dur) || dur <= 0) return
          // Lead the audio so the highlight feels slightly "ahead of the voice"
          const leadedTime = Math.max(0, audio.currentTime + HIGHLIGHT_LEAD_S)
          const wordIdx = computeWordIdx(leadedTime, dur)
          if (wordIdx !== lastWordIdx && wordTokens[wordIdx]) {
            lastWordIdx = wordIdx
            setHighlightCharIdx(wordTokens[wordIdx].charStart)
          }
        }

        audio.ontimeupdate = onTimeUpdate
        audio.onended = () => {
          setIsReadAloud(false); setHighlightCharIdx(null)
        }
        audio.onerror = () => {
          setIsReadAloud(false); setHighlightCharIdx(null)
        }

        cancelTTSRef.current = () => {
          audio.ontimeupdate = null
          audio.pause(); audio.currentTime = 0
        }

        await audio.play()
        return
      } catch {
        // Fall through to legacy TTS
      }
    }

    // Fallback: ElevenLabs API or Web Speech
    try {
      const cancel = await speakWithTrackingAsync(
        passage.passage,
        (charIndex) => setHighlightCharIdx(charIndex),
        () => { setIsReadAloud(false); setHighlightCharIdx(null) },
      )
      cancelTTSRef.current = cancel
    } catch {
      setIsReadAloud(false)
      setHighlightCharIdx(null)
    }
  }, [passage, readingAudioPath, tokens])

  const stopReadAloud = useCallback(() => {
    if (cancelTTSRef.current) cancelTTSRef.current()
    cancelTTSRef.current = null
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current.currentTime = 0; currentAudioRef.current = null }
    setIsReadAloud(false)
    setHighlightCharIdx(null)
  }, [])

  if (!passage) {
    return (
      <div className="space-y-5 animate-fadeIn text-center py-12">
        <h2 className="text-xl font-bold" style={{ color: TEXT }}>קטע לא נמצא</h2>
        <button
          className="px-6 py-3 rounded-xl font-bold text-sm"
          style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }}
          onClick={() => navigate('/reading')}
        >
          חזרה לקריאה
        </button>
      </div>
    )
  }

  const questions = passage.questions

  /* ─── RESULTS PHASE ─── */
  if (phase === 'results') {
    const timeSpent = Math.round((Date.now() - startTime) / 1000)
    if (!resultsSaved) {
      addSession(passage.id, score, questions.length, timeSpent)
      addXP(score * 15 + 10)
      checkStreak()
      onSessionComplete({ score, totalQuestions: questions.length, type: 'reading' })
      // Reading mission uses a timer — only complete when accumulated time reaches target.
      // Check if the timer has reached the mission's required minutes.
      const activeMissionId = localStorage.getItem('znk-active-mission')
      if (activeMissionId) {
        try {
          const timerRaw = localStorage.getItem('znk-reading-timer')
          const coachRaw = localStorage.getItem('znk-coach-data')
          if (timerRaw && coachRaw) {
            const timer = JSON.parse(timerRaw)
            const coachData = JSON.parse(coachRaw)
            const mission = coachData?.plan?.missions?.find(
              (m: { id: string }) => m.id === activeMissionId,
            )
            const targetSec = (mission?.estimatedMinutes ?? 0) * 60
            if (timer.elapsedSec >= targetSec && targetSec > 0) {
              // Timer reached target — complete the mission
              localStorage.removeItem('znk-active-mission')
              import('../../stores/coachStore').then(({ useCoachStore }) => {
                useCoachStore.getState().completeMission(activeMissionId)
              })
            }
            // Otherwise, don't complete — let the timer keep running on ReadingHome
          }
        } catch { /* ignore */ }
      }
      setResultsSaved(true)
    }

    // Build wrong-questions list from per-question answers for the result screen
    const wrongQuestions = questions
      .map((q, i) => ({ q, i, chosen: answers[i] }))
      .filter(({ q, chosen }) => chosen !== undefined && chosen !== q.correct)
      .map(({ q, chosen }) => ({
        stem: q.question,
        userAnswer: chosen !== undefined ? q.options[chosen] : '—',
        correctAnswer: q.options[q.correct],
        explanation: typeof q.explanation === 'string'
          ? q.explanation
          : q.explanation.questionTranslation,
      }))

    // Compute 3 suggested next passages with strict quality gates:
    //   1. MUST have an image (checked against reading-images.json)
    //   2. PREFER passages that also have a pre-recorded audio narration
    //   3. Then apply the difficulty spread (harder · same · easier) so the
    //      student sees variety across the 3 cards.
    // A passage with no image looks broken in the card — we never recommend
    // those. Passages with audio are prioritized because they deliver a
    // strictly better practice experience.
    const imagesMap = readingImages as Record<string, { filename: string }>
    const hasImage = (p: ReadingPassage) => Boolean(imagesMap[p.id])
    const hasAudio = (p: ReadingPassage) => Boolean(audioLookup[p.id])
    const allPassages = (textsData as unknown as ReadingPassage[])
      .filter((p) => p.id !== passage.id)
      .filter(hasImage)
    // Sort each pool so audio-available passages come first.
    const sortByAudio = (arr: ReadingPassage[]): ReadingPassage[] => {
      const withAudio = arr.filter(hasAudio)
      const withoutAudio = arr.filter((p) => !hasAudio(p))
      // Shuffle within each tier to keep variety between sessions
      const shuffle = <T,>(list: T[]): T[] => {
        const copy = list.slice()
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[copy[i], copy[j]] = [copy[j], copy[i]]
        }
        return copy
      }
      return [...shuffle(withAudio), ...shuffle(withoutAudio)]
    }
    const harderPool = sortByAudio(allPassages.filter((p) => p.difficulty > passage.difficulty))
    const sameDiffPool = sortByAudio(allPassages.filter((p) => p.difficulty === passage.difficulty))
    const easierPool = sortByAudio(allPassages.filter((p) => p.difficulty < passage.difficulty))
    const picks: ReadingPassage[] = []
    const addPick = (p: ReadingPassage | undefined) => {
      if (!p) return
      if (picks.some((x) => x.id === p.id)) return
      picks.push(p)
    }
    // First pick from each difficulty band (audio-first within each)
    addPick(harderPool[0])
    addPick(sameDiffPool[0])
    addPick(easierPool[0])
    // Fill remainder from ANY pool, audio-first
    const fillPool = sortByAudio(allPassages.filter((p) => !picks.some((x) => x.id === p.id)))
    let fillIdx = 0
    while (picks.length < 3 && fillIdx < fillPool.length) {
      addPick(fillPool[fillIdx++])
    }
    const suggestedPassages = picks.slice(0, 3).map((p) => ({
      id: p.id,
      title: p.title,
      titleHe: p.titleHe,
      descriptionHe: p.descriptionHe,
      topic: p.topic,
      difficulty: p.difficulty,
      wordCount: p.wordCount,
      // Image convention — same path used in the in-reader hero at line ~592.
      imageUrl: asset(`images/reading/${p.id}.webp`),
    }))

    return (
      <ReadingResultScreen
        passageTitle={passage.title}
        difficulty={passage.difficulty}
        topic={passage.topic}
        score={score}
        total={questions.length}
        startTime={startTime}
        xpEarned={score * 15 + 10}
        wordsAdded={sessionAdded.size}
        wrongQuestions={wrongQuestions}
        onBack={() => navigate('/reading')}
        onRetry={() => {
          // Full retry: re-read + re-quiz the same passage.
          setPhase('reading')
          setCurrentQ(0)
          setSelected(null)
          setShowExplanation(false)
          setScore(0)
          setAnswers([])
          setResultsSaved(false)
        }}
        suggestedPassages={suggestedPassages}
        onPickPassage={(pid) => { stopReadAloud(); navigate(`/reading/${pid}`) }}
      />
    )
  }

  /* ─── READING PHASE ─── */
  if (phase === 'reading') {
    const readingMinutes = Math.max(1, Math.round(passage.wordCount / 150))

    return (
      <div className="space-y-4 animate-fadeIn pb-4" ref={readingContainerRef}>
        {instructions.shouldShow && (
          <InstructionsOverlay modeId="reading-passage" onDone={instructions.dismiss} />
        )}
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button className="px-4 py-2 rounded-xl font-bold text-sm"
            style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }}
            onClick={() => { stopReadAloud(); navigate('/reading') }}>← חזרה</button>
          <div className="flex items-center gap-2">
            {/* Speed control */}
            <TTSSpeedBtn size={16} />
            {/* Regular TTS */}
            <SpeakerBtn text={passage.passage} size={18} />
            {/* Read-along TTS */}
            {isReadAloud ? (
              <button
                className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5"
                style={{ background: WRONG, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)' }}
                onClick={stopReadAloud}
              >
                ⏹ עצור
              </button>
            ) : (
              <button
                className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5"
                style={{ background: BG, boxShadow: S.extrudedSm, color: ACCENT, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)' }}
                onClick={startReadAloud}
              >
                📖 הקראה עם מעקב
              </button>
            )}
          </div>
        </div>

        {/* Scroll progress bar */}
        <div className="h-1 rounded-full overflow-hidden" style={{ background: `${MUTED}15` }} dir="ltr">
          <div className="h-full rounded-full transition-[transform,box-shadow,background-color,border-color,opacity] duration-200" style={{ width: `${scrollPct}%`, background: `linear-gradient(90deg, ${ACCENT}, ${SECONDARY})` }} />
        </div>

        {/* Reading card */}
        <div
          style={{ background: READING_BG, boxShadow: S.extruded, borderRadius: 28, padding: '28px 24px' }}
        >
          <div dir="ltr" className="text-left">
            {/* Title + info */}
            <h3 className="font-bold text-xl mb-1" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
              {passage.title}
            </h3>
            <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: `1px solid ${MUTED}18` }}>
              <span className="text-xs" style={{ color: MUTED }}>{passage.wordCount} words</span>
              <span className="text-xs" style={{ color: MUTED }}>~{readingMinutes} min</span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{ color: colorForDifficulty(passage.difficulty), background: `${colorForDifficulty(passage.difficulty)}12` }}
              >
                {labelForDifficulty(passage.difficulty)}
              </span>
            </div>

            {/* Hero image for passage */}
            {(readingImages as Record<string, { filename: string }>)[passage.id] && (
              <div className="mb-6 rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                <img
                  src={asset(`images/reading/${passage.id}.webp`)}
                  alt={passage.title}
                  className="w-full object-cover"
                  style={{ height: 180, background: `linear-gradient(135deg, #EE2B7315, #38B2AC15)` }}
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            )}

            {/* Passage text with interactive words */}
            <div className="text-base leading-[2] relative" style={{ color: TEXT, fontFamily: 'var(--font-body)' }}>
              {tokens.map((token, i) => {
                if (!token.isWord) {
                  // Whitespace or newlines
                  if (token.word.includes('\n\n')) {
                    return <span key={i} className="block mb-5" />
                  }
                  return <span key={i}>{token.word}</span>
                }

                const clean = cleanWord(token.word)
                const inMyWords = clean.length > 1 && hasMyWord(clean)
                const addedThisSession = sessionAdded.has(clean)
                const isHighlighted = highlightCharIdx !== null &&
                  token.charStart <= highlightCharIdx &&
                  highlightCharIdx < token.charStart + token.word.length

                return (
                  <span key={i} className="relative inline">
                    <span
                      className="cursor-pointer transition-colors duration-150"
                      /* Auto-scroll removed intentionally — per user feedback it
                         fought with the user's own scroll gestures and felt
                         jarring, especially combined with iOS momentum scroll.
                         The highlight alone is enough of a visual cue. */
                      style={{
                        /* Unmistakable karaoke-style highlight: solid yellow
                           block with dark text, slight scale pop, soft shadow. */
                        background: isHighlighted
                          ? '#FFE600'
                          : addedThisSession ? `${ACCENT}10` : 'transparent',
                        color: isHighlighted ? '#1a1a2e' : undefined,
                        fontWeight: isHighlighted ? 800 : undefined,
                        borderBottom: inMyWords && !isHighlighted
                          ? `2px dotted ${ACCENT}50`
                          : addedThisSession && !isHighlighted ? `2px solid ${ACCENT}` : 'none',
                        borderRadius: isHighlighted ? 6 : 0,
                        padding: isHighlighted ? '1px 5px' : 0,
                        boxShadow: isHighlighted ? '0 2px 8px rgba(255,230,0,0.55)' : 'none',
                        transition: 'background 0.12s linear, box-shadow 0.2s linear, border-radius 0.15s',
                      }}
                      onClick={() => handleWordTap(i)}
                    >
                      {token.word}
                    </span>

                    {/* Word popup */}
                    {tappedIdx === i && (
                      <div
                        ref={popupRef}
                        className="absolute z-50 animate-fadeIn"
                        style={{
                          bottom: '100%',
                          left: '50%',
                          /* Cap width to viewport (with 32px gutter so the
                             popup never bleeds past the screen edge on
                             small phones) and let translation text wrap. */
                          transform: 'translateX(-50%)',
                          marginBottom: 8,
                          background: BG,
                          boxShadow: `${S.extrudedSm}, 0 4px 20px rgba(0,0,0,0.12)`,
                          borderRadius: 14,
                          padding: '10px 14px',
                          minWidth: 160,
                          maxWidth: 'min(280px, calc(100vw - 32px))',
                          whiteSpace: 'normal',
                        }}
                      >
                        {(() => {
                          const match = vocabMap.get(clean)
                          if (!match) {
                            return (
                              <div className="text-center">
                                {apiLoading ? (
                                  <>
                                    <p className="text-sm font-bold mb-0.5" style={{ color: TEXT }}>{clean}</p>
                                    <p className="text-[10px]" style={{ color: MUTED }}>מתרגם...</p>
                                  </>
                                ) : apiTranslation ? (
                                  <>
                                    <div className="flex items-center justify-center gap-2 mb-0.5">
                                      <p className="text-sm font-bold" style={{ color: TEXT }}>
                                        <span style={{ color: ACCENT }}>{clean}</span> = {apiTranslation}
                                      </p>
                                      <SpeakerBtn text={clean} size={14} />
                                    </div>
                                    {inMyWords || sessionAdded.has(clean) ? (
                                      <p className="text-[10px] mt-1" style={{ color: CORRECT }}>
                                        {sessionAdded.has(clean) ? '✓ נוסף ללמידה' : '✓ כבר ברשימה שלך'}
                                      </p>
                                    ) : (
                                      <button
                                        className="mt-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
                                        style={{
                                          background: `linear-gradient(135deg, ${ACCENT}, #8B5CF6)`,
                                          color: '#fff',
                                          border: 'none',
                                          cursor: 'pointer',
                                          fontFamily: 'var(--font-display)',
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          addMyWord(clean, apiTranslation, 'reading', null)
                                          setSessionAdded((s) => new Set(s).add(clean))
                                          // Keep the popup open for a moment so the student
                                          // sees the "✓ נוסף ללמידה" confirmation before it
                                          // disappears. Closing instantly was the reported bug.
                                          window.setTimeout(() => setTappedIdx(null), 1200)
                                        }}
                                      >
                                        + הוסף ללמידה
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-xs text-center" style={{ color: MUTED }}>
                                    לא נמצא תרגום
                                  </p>
                                )}
                              </div>
                            )
                          }
                          return (
                            <div className="text-center">
                              <p className="text-sm font-bold mb-0.5" style={{ color: TEXT }}>
                                <span style={{ color: ACCENT }}>{clean}</span> = {match.hebrew}
                              </p>
                              {inMyWords || sessionAdded.has(clean) ? (
                                <p className="text-[10px] mt-1" style={{ color: CORRECT }}>
                                  {sessionAdded.has(clean) ? '✓ נוסף ללמידה' : '✓ כבר ברשימה שלך'}
                                </p>
                              ) : (
                                <button
                                  className="mt-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
                                  style={{
                                    background: `linear-gradient(135deg, ${ACCENT}, #8B5CF6)`,
                                    color: '#fff',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-display)',
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleAddWord(token.word)
                                    // Keep the popup open momentarily so the student
                                    // sees the success confirmation before close.
                                    window.setTimeout(() => setTappedIdx(null), 1200)
                                  }}
                                >
                                  + הוסף ללמידה
                                </button>
                              )}
                            </div>
                          )
                        })()}
                        {/* Arrow */}
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
            </div>

            {/* Tap hint */}
            <p className="text-[11px] mt-6 text-center" style={{ color: `${MUTED}80` }}>
              💡 טיפ: לחץ על מילה כדי לראות את התרגום שלה
            </p>
          </div>
        </div>

        {/* Continue button — sticky at bottom.
            The `bottom` value clears the mobile bottom-nav (z-9999, ~72px)
            plus the iOS safe-area inset, so the button is never visually
            hidden by the nav on phones. On desktop the nav is `md:hidden`
            so the slightly larger gap is harmless. */}
        <div
          className="sticky"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 10px) + 80px)' }}
        >
          <button
            className="neu-btn-accent w-full text-sm py-3.5"
            style={{ boxShadow: `${S.extruded}, 0 4px 16px ${ACCENT}30` }}
            onClick={() => { stopReadAloud(); setPhase('quiz') }}
          >
            סיימתי! קדימה לשאלות ←
          </button>
        </div>
      </div>
    )
  }

  /* ─── QUIZ PHASE ─── */
  const q = questions[currentQ]
  if (!q) {
    if ((phase as string) !== 'results') setTimeout(() => setPhase('results'), 0)
    return null
  }

  const getOptionStyle = (i: number) => {
    if (selected === null) return { background: BG, boxShadow: S.extrudedSm, outline: 'none' }
    if (i === q.correct) return { background: '#ECFDF5', boxShadow: S.inset, outline: `3px solid ${CORRECT}` }
    if (i === selected && i !== q.correct) return { background: '#FEF2F2', boxShadow: S.inset, outline: `3px solid ${WRONG}` }
    return { background: BG, boxShadow: S.extrudedSm, outline: 'none', opacity: 0.3 }
  }

  return (
    <div className="space-y-5 animate-fadeIn pb-4">
      <div className="flex items-center justify-between">
        <button className="px-4 py-2 rounded-xl font-bold text-sm"
          style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }}
          onClick={() => setPhase('reading')}>← לקטע</button>
        <h2 className="font-bold text-base" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>שאלות הבנה</h2>
        <span className="text-sm font-bold" style={{ color: MUTED, fontFamily: 'var(--font-display)' }}>{currentQ + 1}/{questions.length}</span>
      </div>

      <div className="h-3 rounded-xl overflow-hidden" style={{ background: BG, boxShadow: S.inset }} dir="ltr">
        <div className="h-full rounded-xl transition-[transform,box-shadow,background-color,border-color,opacity] duration-300"
          style={{ width: `${((currentQ + 1) / questions.length) * 100}%`, background: `linear-gradient(90deg, ${ACCENT}, ${SECONDARY})` }} />
      </div>

      <div dir="ltr" className="text-left space-y-3">
        <div style={{ background: BG, boxShadow: S.inset, borderRadius: 20, padding: '14px 18px' }}>
          <div className="flex items-start gap-3">
            <p className="text-sm font-semibold flex-1" style={{ color: TEXT, fontFamily: 'var(--font-body)' }}>{q.question}</p>
            <SpeakerBtn text={q.question} size={16} />
          </div>
        </div>

        <div className="space-y-3">
          {q.options.map((opt, i) => (
            <div key={i}
              className={`cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 ${selected === null ? 'hover:-translate-y-0.5' : ''}`}
              style={{ ...getOptionStyle(i), borderRadius: 20, padding: '16px 20px' }}
              onClick={() => {
                if (selected !== null) return
                setSelected(i)
                playSound(i === q.correct ? 'correct' : 'wrong')
                if (i === q.correct) setScore((s) => s + 1)
                // Record this answer at the current question's index so the
                // result screen can show a "review wrong questions" list.
                setAnswers((prev) => {
                  const next = prev.slice()
                  next[currentQ] = i
                  return next
                })
                setShowExplanation(true)
              }}>
              <span className="flex items-start gap-3">
                <span className="text-sm mt-0.5" style={{ color: selected !== null && i === q.correct ? CORRECT : selected === i ? WRONG : MUTED }}>({i + 1})</span>
                <span className="text-sm leading-relaxed flex-1" style={{ color: TEXT, fontFamily: 'var(--font-body)' }}>{opt}</span>
                <SpeakerBtn text={opt} size={14} />
              </span>
            </div>
          ))}
        </div>
      </div>

      {showExplanation && (
        <div className="animate-fadeIn" style={{ background: BG, boxShadow: S.inset, borderRadius: 24, padding: 20 }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: selected === q.correct ? CORRECT : WRONG,
                boxShadow: `0 2px 8px ${selected === q.correct ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
              <span className="text-white text-xs font-bold">{selected === q.correct ? '✓' : '✗'}</span>
            </div>
            {/* Context-aware label: previously this ALWAYS read "תשובה (X) נכונה"
                even when the student got it wrong, which placed a green-positive
                statement next to the red ✗ icon — the contradiction students reported
                ("answer 2 marked green, but feedback shows X red"). Now we say
                "תשובה (X) נכונה" only when they actually got it right, and explicitly
                "טעות — התשובה הנכונה היא (X)" when they didn't. */}
            <span className="font-bold" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
              {selected === q.correct
                ? `תשובה (${q.correct + 1}) נכונה`
                : `טעות — התשובה הנכונה היא (${q.correct + 1})`}
            </span>
          </div>
          {typeof q.explanation === 'string' ? (
            <p className="text-sm mb-4" style={{ color: MUTED }}>{q.explanation}</p>
          ) : (
            <div className="mb-4">
              <p className="text-sm mb-3" style={{ color: MUTED }}>{q.explanation.questionTranslation}</p>
              <div className="space-y-2">
                <span className="text-sm font-semibold" style={{ color: TEXT }}>ניתוח תשובות:</span>
                {q.explanation.optionAnalysis.map((analysis, i) => (
                  <div
                    key={i}
                    className="text-sm p-2.5 rounded-xl"
                    style={{
                      background: i === q.correct ? '#ECFDF5' : 'transparent',
                      color: i === q.correct ? CORRECT : MUTED,
                      fontWeight: i === q.correct ? 600 : 400,
                    }}
                  >
                    <span className="font-semibold">({i + 1}) </span>
                    {analysis}
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            ref={quizNextBtnRef}
            className="neu-btn-accent w-full text-sm py-3.5"
            onClick={() => {
              if (currentQ >= questions.length - 1) { playSound('complete'); setPhase('results') }
              else { setCurrentQ((c) => c + 1); setSelected(null); setShowExplanation(false) }
            }}>
            {currentQ < questions.length - 1 ? 'הבא ←' : 'סיום'}
          </button>
        </div>
      )}
    </div>
  )
}
