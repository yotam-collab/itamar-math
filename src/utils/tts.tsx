import { useCallback, useEffect, useId, useState, useSyncExternalStore } from 'react'
import { asset } from './assetUrl'
import { useTTSSettingsStore, TTS_SPEEDS, type TTSSpeed } from '../stores/ttsSettingsStore'
import { isAudioUnlocked, onAudioUnlocked } from './audioUnlock'

const S_SM = '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)'
const BG = '#E0E5EC'
const ACCENT = '#6C63FF'

/** Get the current TTS speed from the store (non-reactive, for imperative use) */
function getTTSSpeed(): number {
  return useTTSSettingsStore.getState().ttsSpeed
}

// TTS proxy URL (Cloudflare Worker — API key stays server-side)
const TTS_PROXY_URL = import.meta.env.VITE_TTS_PROXY_URL as string | undefined
const DEFAULT_TTS_URL = 'https://znk-tts-proxy.yotamxtz.workers.dev'

// ── Pre-generated audio lookup ─────────────────────────
// Maps word ID → { word, meaning, example, exampleHe, association } file paths
let pregenLookup: Record<string, { word?: string; meaning?: string; example?: string; exampleHe?: string; association?: string }> | null = null
let pregenLoading = false

/** Load the pre-generated audio lookup file (once) */
let pregenLoadPromise: Promise<Record<string, { word?: string; meaning?: string; example?: string; exampleHe?: string; association?: string }> | null> | null = null

async function loadPregenLookup() {
  if (pregenLookup) return pregenLookup
  if (pregenLoadPromise) return pregenLoadPromise // wait for in-flight load

  pregenLoadPromise = (async () => {
    try {
      const res = await fetch(asset('audio/lookup.json'))
      if (res.ok) {
        pregenLookup = await res.json()
      }
    } catch {
      // No pre-generated audio available
    }
    return pregenLookup
  })()

  return pregenLoadPromise
}

// Eagerly start loading the lookup
loadPregenLookup()

/** Find pre-generated audio path for a word by its ID */
export function getPregenAudioPath(wordId: number, type: 'word' | 'meaning' | 'example' | 'exampleHe' | 'association'): string | null {
  if (!pregenLookup) return null
  const entry = pregenLookup[wordId]
  if (!entry || !entry[type]) return null
  // Prefix with base URL (strip leading slash from stored path)
  return asset(entry[type].replace(/^\//, ''))
}

// Audio pool for pregen files — reuse objects to avoid iOS Safari autoplay blocks
const pregenPool = new Map<string, HTMLAudioElement>()

/** Play a pre-generated audio file by path. Returns true if successful.
 *  If autoplay is blocked (no user gesture yet), schedules retry on first gesture. */
async function playPregenAudio(path: string): Promise<boolean> {
  try {
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0 }

    // Reuse or create audio element
    let audio = pregenPool.get(path)
    if (audio) {
      audio.currentTime = 0
    } else {
      audio = new Audio(path)
      pregenPool.set(path, audio)
    }
    audio.playbackRate = getTTSSpeed()
    currentAudio = audio
    try {
      await audio.play()
      return true
    } catch {
      // Autoplay blocked — retry after first user gesture
      if (!isAudioUnlocked()) {
        const audioRef = audio
        onAudioUnlocked(() => {
          if (currentAudio === audioRef) {
            audioRef.play().catch(() => { /* ok */ })
          }
        })
      }
      return false
    }
  } catch {
    return false
  }
}

/** Play a pre-generated audio file and wait for it to finish. Returns true if successful. */
async function playPregenAudioAndWait(path: string): Promise<boolean> {
  try {
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0 }
    const audio = new Audio(path)
    audio.playbackRate = getTTSSpeed()
    currentAudio = audio
    return new Promise<boolean>((resolve) => {
      audio.onended = () => resolve(true)
      audio.onerror = () => resolve(false)
      audio.play().catch(() => resolve(false))
    })
  } catch {
    return false
  }
}

// Global cancellation token for sequences
let sequenceCancelId = 0

/** Cancel any running speakPregenSequence */
export function cancelPregenSequence() {
  sequenceCancelId++
}

/** Play a sequence of pre-generated audio files one after another. */
export async function speakPregenSequence(wordId: number, types: Array<'word' | 'meaning' | 'example' | 'exampleHe' | 'association'>, delayMs = 300) {
  const myId = ++sequenceCancelId
  await loadPregenLookup()
  for (let i = 0; i < types.length; i++) {
    if (sequenceCancelId !== myId) return // cancelled
    const path = getPregenAudioPath(wordId, types[i])
    if (path) {
      const ok = await playPregenAudioAndWait(path)
      if (sequenceCancelId !== myId) return // cancelled during playback
      if (!ok) continue
      // Small delay between clips
      if (i < types.length - 1 && delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs))
        if (sequenceCancelId !== myId) return // cancelled during delay
      }
    }
  }
}

/** Play a single pre-generated audio type for a word. */
export async function speakPregenSingle(wordId: number, type: 'word' | 'meaning' | 'example' | 'exampleHe' | 'association') {
  await loadPregenLookup()
  const path = getPregenAudioPath(wordId, type)
  if (path) {
    await playPregenAudio(path)
  }
}

/** Speak a word using pre-generated audio (by word ID). Falls back to ElevenLabs API / Web Speech. */
export async function speakPregen(wordId: number, type: 'word' | 'meaning' | 'example' | 'exampleHe' | 'association', fallbackText?: string) {
  await loadPregenLookup()
  const path = getPregenAudioPath(wordId, type)
  if (path) {
    const ok = await playPregenAudio(path)
    if (ok) return
  }
  // Fallback to existing TTS
  if (fallbackText) {
    await speakEnglish(fallbackText)
  }
}

// Cache audio blobs to avoid re-fetching the same text
const audioCache = new Map<string, string>()

// Cache timestamps for read-along mode
interface TimestampData {
  audioUrl: string
  characters: string[]
  charStartTimes: number[]
  charEndTimes: number[]
}
const timestampCache = new Map<string, TimestampData>()

// Track current audio for cancellation
let currentAudio: HTMLAudioElement | null = null

/* ─── Global "who's playing" coordination ─────────────────────────
   Every <SpeakerBtn> identifies itself with a unique id (React's useId).
   Only ONE button can show its "stop" state at a time — when a new
   playback starts, every other instance must flip back to its idle
   speaker icon. We expose this via a tiny external store consumed with
   useSyncExternalStore so SpeakerBtn instances re-render automatically.
   This replaces the per-component `playing` state that was getting
   stranded when another button preempted playback (the original bug:
   multiple "stop" icons visible at once). */
let _currentTTSId: string | null = null
const _ttsListeners = new Set<() => void>()

export function getCurrentTTSId(): string | null {
  return _currentTTSId
}

export function subscribeTTS(listener: () => void): () => void {
  _ttsListeners.add(listener)
  return () => { _ttsListeners.delete(listener) }
}

function setCurrentTTSId(id: string | null) {
  if (_currentTTSId === id) return
  _currentTTSId = id
  _ttsListeners.forEach((l) => l())
}

// Subscribe to speed changes → update currently playing audio in real-time
let _lastSpeed = useTTSSettingsStore.getState().ttsSpeed
useTTSSettingsStore.subscribe((state) => {
  if (state.ttsSpeed !== _lastSpeed) {
    _lastSpeed = state.ttsSpeed
    if (currentAudio && !currentAudio.paused) {
      currentAudio.playbackRate = state.ttsSpeed
    }
  }
})

/** Check if text is already cached (instant playback) */
export function isTTSCached(text: string): boolean {
  return audioCache.has(text)
}

/** Check if text has cached timestamps for tracking mode */
export function isTTSTrackingCached(text: string): boolean {
  return timestampCache.has(text)
}

function hasElevenLabs(): boolean {
  return !!(TTS_PROXY_URL || DEFAULT_TTS_URL)
}

async function speakWithElevenLabs(text: string): Promise<boolean> {
  if (!hasElevenLabs()) return false

  try {
    // Check cache first
    const cached = audioCache.get(text)
    if (cached) {
      if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0 }
      const audio = new Audio(cached)
      audio.playbackRate = getTTSSpeed()
      currentAudio = audio
      audio.play()
      return true
    }

    const proxyUrl = TTS_PROXY_URL || DEFAULT_TTS_URL
    if (!proxyUrl) return false

    const response = await fetch(`${proxyUrl}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) return false

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)

    // Cache for future use
    audioCache.set(text, url)

    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0 }
    const audio = new Audio(url)
    audio.playbackRate = getTTSSpeed()
    currentAudio = audio
    audio.play()
    return true
  } catch {
    return false
  }
}

/** Speak English text using ElevenLabs proxy and wait for playback to finish. */
async function speakWithElevenLabsAndWait(text: string): Promise<boolean> {
  if (!hasElevenLabs()) return false
  try {
    const cached = audioCache.get(text)
    if (cached) {
      if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0 }
      const audio = new Audio(cached)
      audio.playbackRate = getTTSSpeed()
      currentAudio = audio
      return new Promise<boolean>((resolve) => {
        audio.onended = () => resolve(true)
        audio.onerror = () => resolve(false)
        audio.play().catch(() => resolve(false))
      })
    }

    const proxyUrl = TTS_PROXY_URL || DEFAULT_TTS_URL
    if (!proxyUrl) return false

    const response = await fetch(`${proxyUrl}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) return false

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    audioCache.set(text, url)

    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0 }
    const audio = new Audio(url)
    audio.playbackRate = getTTSSpeed()
    currentAudio = audio
    return new Promise<boolean>((resolve) => {
      audio.onended = () => resolve(true)
      audio.onerror = () => resolve(false)
      audio.play().catch(() => resolve(false))
    })
  } catch {
    return false
  }
}

/**
 * Fetch ElevenLabs TTS with character-level timestamps.
 * Uses the /with-timestamps endpoint for word-level sync.
 */
async function fetchElevenLabsWithTimestamps(text: string): Promise<TimestampData | null> {
  if (!hasElevenLabs()) return null

  // Check cache
  const cached = timestampCache.get(text)
  if (cached) return cached

  try {
    const proxyUrl2 = TTS_PROXY_URL || DEFAULT_TTS_URL
    if (!proxyUrl2) return null

    const response = await fetch(`${proxyUrl2}/tts-timestamps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) return null

    const data = await response.json()

    // Convert base64 audio to blob URL
    const audioBytes = atob(data.audio_base64)
    const audioArray = new Uint8Array(audioBytes.length)
    for (let i = 0; i < audioBytes.length; i++) {
      audioArray[i] = audioBytes.charCodeAt(i)
    }
    const blob = new Blob([audioArray], { type: 'audio/mpeg' })
    const audioUrl = URL.createObjectURL(blob)

    // Use alignment (normalized_alignment provides better mapping to original text)
    const alignment = data.alignment || data.normalized_alignment
    if (!alignment) return null

    const result: TimestampData = {
      audioUrl,
      characters: alignment.characters,
      charStartTimes: alignment.character_start_times_seconds,
      charEndTimes: alignment.character_end_times_seconds,
    }

    // Cache both the timestamp data and the audio URL
    timestampCache.set(text, result)
    audioCache.set(text, audioUrl)

    return result
  } catch {
    return null
  }
}

/**
 * Given character-level timestamps, derive word-level start times.
 * Returns array of { charIndex, startTime } for each word start in the text.
 */
function deriveWordTimings(
  text: string,
  tsData: TimestampData,
): { charIndex: number; startTime: number }[] {
  const wordTimings: { charIndex: number; startTime: number }[] = []

  // Find word boundaries in the original text
  const wordRegex = /\S+/g
  let match: RegExpExecArray | null
  while ((match = wordRegex.exec(text)) !== null) {
    const wordCharIndex = match.index

    // Find the corresponding timestamp from the alignment data
    // The alignment characters array maps 1:1 to original text positions
    // We need to find the start time of this character position
    let startTime = 0

    // Characters in alignment may not map 1:1 to the original text
    // Reconstruct position mapping
    let alignedPos = 0
    for (let i = 0; i < tsData.characters.length; i++) {
      if (alignedPos >= wordCharIndex) {
        startTime = tsData.charStartTimes[i] || 0
        break
      }
      alignedPos += tsData.characters[i].length
    }

    wordTimings.push({ charIndex: wordCharIndex, startTime })
  }

  return wordTimings
}

function speakWithWebSpeech(text: string) {
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'en-US'
  utter.rate = 0.9 * getTTSSpeed()
  const voices = window.speechSynthesis.getVoices()
  const enVoice = voices.find((v) => v.lang.startsWith('en') && v.name.includes('Samantha'))
    || voices.find((v) => v.lang.startsWith('en-US'))
    || voices.find((v) => v.lang.startsWith('en'))
  if (enVoice) utter.voice = enVoice
  window.speechSynthesis.speak(utter)
}

/** Speak English text using Web Speech API and wait for completion. */
function speakWithWebSpeechAndWait(text: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'en-US'
    utter.rate = 0.9 * getTTSSpeed()
    const voices = window.speechSynthesis.getVoices()
    const enVoice = voices.find((v) => v.lang.startsWith('en') && v.name.includes('Samantha'))
      || voices.find((v) => v.lang.startsWith('en-US'))
      || voices.find((v) => v.lang.startsWith('en'))
    if (enVoice) utter.voice = enVoice
    utter.onend = () => resolve(true)
    utter.onerror = () => resolve(false)
    window.speechSynthesis.speak(utter)
  })
}

/**
 * Speak Hebrew text — uses Web Speech API directly (the ElevenLabs proxy
 * uses an English-only voice that can't properly pronounce Hebrew).
 */
export async function speakHebrew(text: string) {
  // Stop any current playback
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0 }
  window.speechSynthesis.cancel()

  // Use Web Speech API for Hebrew (ElevenLabs proxy has English voice only)
  speakHebrewWithWebSpeech(text)
}

/** Low-quality fallback: browser's built-in Hebrew voice */
function speakHebrewWithWebSpeech(text: string) {
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'he-IL'
  utter.rate = 0.9
  const voices = window.speechSynthesis.getVoices()
  const heVoice = voices.find((v) => v.lang.startsWith('he'))
  if (heVoice) utter.voice = heVoice
  window.speechSynthesis.speak(utter)
}

/** Speak Hebrew text and wait for playback to finish. Returns true if played successfully.
 *  Uses Web Speech API directly (ElevenLabs proxy has English voice only). */
export async function speakHebrewAndWait(text: string): Promise<boolean> {
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0 }
  window.speechSynthesis.cancel()
  return speakHebrewWithWebSpeechAndWait(text)
}

/** Web Speech Hebrew fallback that waits for finish */
function speakHebrewWithWebSpeechAndWait(text: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'he-IL'
    utter.rate = 0.9
    const voices = window.speechSynthesis.getVoices()
    const heVoice = voices.find((v) => v.lang.startsWith('he'))
    if (heVoice) utter.voice = heVoice
    utter.onend = () => resolve(true)
    utter.onerror = () => resolve(false)
    window.speechSynthesis.speak(utter)
  })
}

/**
 * Caller-supplied predicate: return `true` if the playback is still relevant,
 * `false` to abort silently (no fallback cascade). Used by the `*AndWait`
 * functions to prevent duplicate audio when a newer playback chain starts
 * (e.g. React StrictMode's double-effect, or rapid word swipes).
 */
type ActiveCheck = () => boolean
const alwaysActive: ActiveCheck = () => true

/** Play a pre-generated meaning audio and wait for it to finish.
 *  Falls back to Web Speech API (NOT ElevenLabs proxy — the proxy uses an English voice
 *  that can't properly read Hebrew text). Accepts an abort-check to bail cleanly. */
export async function speakMeaningAndWait(wordId: number, hebrewText: string, isActive: ActiveCheck = alwaysActive): Promise<boolean> {
  await loadPregenLookup()
  if (!isActive()) return false
  const path = getPregenAudioPath(wordId, 'meaning')
  if (path) {
    const ok = await playPregenAudioAndWait(path)
    if (!isActive()) return false    // don't fall back if caller aborted
    if (ok) return true
  }
  if (!isActive()) return false
  return speakHebrewWithWebSpeechAndWait(hebrewText)
}

/** Play a pre-generated association audio and wait for it to finish.
 *  Falls back to Web Speech API only if not aborted. */
export async function speakAssociationAndWait(wordId: number, associationText: string, isActive: ActiveCheck = alwaysActive): Promise<boolean> {
  await loadPregenLookup()
  if (!isActive()) return false
  const path = getPregenAudioPath(wordId, 'association')
  if (path) {
    const ok = await playPregenAudioAndWait(path)
    if (!isActive()) return false
    if (ok) return true
  }
  if (!isActive()) return false
  return speakHebrewWithWebSpeechAndWait(associationText)
}

/** Play English word audio: pregen → ElevenLabs proxy → Web Speech. Waits for completion.
 *  Aborts silently (no fallback cascade) when `isActive()` returns false. */
export async function speakWordAndWait(wordId: number, englishText: string, isActive: ActiveCheck = alwaysActive): Promise<boolean> {
  await loadPregenLookup()
  if (!isActive()) return false
  const path = getPregenAudioPath(wordId, 'word')
  if (path) {
    const ok = await playPregenAudioAndWait(path)
    if (!isActive()) return false     // critical: don't cascade to fallbacks after an external stopAllTTS
    if (ok) return true
  }
  if (!isActive()) return false
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0 }
  window.speechSynthesis.cancel()
  const success = await speakWithElevenLabsAndWait(englishText)
  if (!isActive()) return false
  if (success) return true
  if (!isActive()) return false
  return speakWithWebSpeechAndWait(englishText)
}

/** Play English example sentence audio: pregen → ElevenLabs → Web Speech. Waits for completion. */
export async function speakExampleAndWait(wordId: number, englishText: string, isActive: ActiveCheck = alwaysActive): Promise<boolean> {
  await loadPregenLookup()
  if (!isActive()) return false
  const path = getPregenAudioPath(wordId, 'example')
  if (path) {
    const ok = await playPregenAudioAndWait(path)
    if (!isActive()) return false
    if (ok) return true
  }
  if (!isActive()) return false
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0 }
  window.speechSynthesis.cancel()
  const success = await speakWithElevenLabsAndWait(englishText)
  if (!isActive()) return false
  if (success) return true
  if (!isActive()) return false
  return speakWithWebSpeechAndWait(englishText)
}

/** Play Hebrew example translation: pregen → Web Speech Hebrew. Waits for completion. */
export async function speakExampleHeAndWait(wordId: number, hebrewText: string, isActive: ActiveCheck = alwaysActive): Promise<boolean> {
  await loadPregenLookup()
  if (!isActive()) return false
  const path = getPregenAudioPath(wordId, 'exampleHe')
  if (path) {
    const ok = await playPregenAudioAndWait(path)
    if (!isActive()) return false
    if (ok) return true
  }
  if (!isActive()) return false
  return speakHebrewWithWebSpeechAndWait(hebrewText)
}

/** Speak English word + Hebrew meaning with a pause between. */
export async function speakWordAndMeaning(english: string, hebrew: string) {
  await speakEnglish(english)
  setTimeout(() => speakHebrew(hebrew), 800)
}

export async function speakEnglish(text: string) {
  // Stop any current playback
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0 }
  window.speechSynthesis.cancel()

  // Try ElevenLabs proxy (only if no pre-recorded files available for this text)
  // Pre-recorded files are handled by speakPregen/speakPregenSingle — this function
  // is only called for ad-hoc text that doesn't have pre-recorded audio.
  const success = await speakWithElevenLabs(text)
  if (!success) {
    speakWithWebSpeech(text)
  }
}

/** Stop all current TTS playback */
export function stopAllTTS() {
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0 }
  window.speechSynthesis.cancel()
  // Also clear the "currently speaking" marker so every <SpeakerBtn>
  // resets its UI back to the idle speaker icon. Without this, the button
  // that initiated the playback would stay in "stop" state until its
  // 3-second auto-reset fires — and any OTHER speaker-button stays in
  // "stop" state for that whole window even after the audio actually ended.
  setCurrentTTSId(null)
}

/**
 * Speak text with word-level tracking using ElevenLabs timestamps.
 * Falls back to Web Speech API onboundary if ElevenLabs is unavailable.
 *
 * Calls `onWord(charIndex)` every time a new word starts being spoken.
 * Calls `onEnd()` when speech finishes or is cancelled.
 * Returns a Promise that resolves to a cancel function.
 */
export async function speakWithTrackingAsync(
  text: string,
  onWord: (charIndex: number) => void,
  onEnd: () => void,
): Promise<() => void> {
  stopAllTTS()

  // Try ElevenLabs with timestamps
  const tsData = await fetchElevenLabsWithTimestamps(text)

  if (tsData) {
    // ElevenLabs path: play audio + schedule word highlights via timestamps
    const wordTimings = deriveWordTimings(text, tsData)

    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0 }
    const audio = new Audio(tsData.audioUrl)
    audio.playbackRate = getTTSSpeed()
    currentAudio = audio

    let animFrameId: number | null = null
    let lastWordIdx = -1

    const trackPlayback = () => {
      if (!audio || audio.paused || audio.ended) return

      const currentTime = audio.currentTime
      // Find the current word based on playback time
      let wordIdx = -1
      for (let i = wordTimings.length - 1; i >= 0; i--) {
        if (currentTime >= wordTimings[i].startTime) {
          wordIdx = i
          break
        }
      }

      if (wordIdx !== lastWordIdx && wordIdx >= 0) {
        lastWordIdx = wordIdx
        onWord(wordTimings[wordIdx].charIndex)
      }

      animFrameId = requestAnimationFrame(trackPlayback)
    }

    audio.onplay = () => {
      animFrameId = requestAnimationFrame(trackPlayback)
    }

    audio.onended = () => {
      if (animFrameId !== null) cancelAnimationFrame(animFrameId)
      onEnd()
    }

    audio.onerror = () => {
      if (animFrameId !== null) cancelAnimationFrame(animFrameId)
      onEnd()
    }

    audio.play().catch(() => {
      // If play fails, fall back to Web Speech
      return speakWithTrackingWebSpeech(text, onWord, onEnd)
    })

    return () => {
      if (animFrameId !== null) cancelAnimationFrame(animFrameId)
      audio.pause()
      audio.currentTime = 0
    }
  }

  // Fallback: Web Speech API
  return speakWithTrackingWebSpeech(text, onWord, onEnd)
}

/**
 * Web Speech API fallback for word tracking.
 */
function speakWithTrackingWebSpeech(
  text: string,
  onWord: (charIndex: number) => void,
  onEnd: () => void,
): () => void {
  window.speechSynthesis.cancel()

  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'en-US'
  utter.rate = 0.85 * getTTSSpeed()

  const voices = window.speechSynthesis.getVoices()
  const enVoice = voices.find((v) => v.lang.startsWith('en') && v.name.includes('Samantha'))
    || voices.find((v) => v.lang.startsWith('en-US'))
    || voices.find((v) => v.lang.startsWith('en'))
  if (enVoice) utter.voice = enVoice

  utter.onboundary = (e) => {
    if (e.name === 'word') {
      onWord(e.charIndex)
    }
  }
  utter.onend = onEnd
  utter.onerror = onEnd

  window.speechSynthesis.speak(utter)

  return () => {
    window.speechSynthesis.cancel()
  }
}

/**
 * Synchronous wrapper that starts tracking and returns cancel fn immediately.
 * Uses Web Speech API only (legacy — prefer speakWithTrackingAsync).
 */
export function speakWithTracking(
  text: string,
  onWord: (charIndex: number) => void,
  onEnd: () => void,
): () => void {
  stopAllTTS()
  return speakWithTrackingWebSpeech(text, onWord, onEnd)
}

/** Compact speed toggle button — cycles through 0.5x → 0.75x → 1x → 1.25x → 1.5x → 2x */
export function TTSSpeedBtn({ size = 16 }: { size?: number }) {
  const ttsSpeed = useTTSSettingsStore((s) => s.ttsSpeed)
  const cycleTTSSpeed = useTTSSettingsStore((s) => s.cycleTTSSpeed)

  const label = ttsSpeed === 1 ? '1x' : `${ttsSpeed}x`
  const outerH = size + 14

  return (
    <button
      onClick={(e) => { e.stopPropagation(); cycleTTSSpeed() }}
      className="rounded-full flex items-center justify-center flex-shrink-0 transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 hover:scale-110 active:scale-95"
      style={{
        background: BG,
        boxShadow: S_SM,
        height: outerH,
        paddingInline: 10,
        border: 'none',
        cursor: 'pointer',
        fontSize: size * 0.7,
        fontWeight: 800,
        color: ttsSpeed === 1 ? '#6B7280' : ACCENT,
        fontFamily: 'var(--font-display)',
        whiteSpace: 'nowrap',
      }}
      aria-label="מהירות הקראה"
      title={`מהירות: ${label}`}
    >
      {label}
    </button>
  )
}

export function SpeakerBtn({ text, size = 18 }: { text: string; size?: number }) {
  const [loading, setLoading] = useState(false)
  /* Each instance gets a stable React-tree-unique id. We compare that id
     against the global "currently playing" marker so only the button that
     actually started playback shows its "stop" state. Previously every
     button kept its own `playing` boolean and they would all get stuck
     in "stop" if the user tapped multiple in quick succession. */
  const myId = useId()
  const currentId = useSyncExternalStore(subscribeTTS, getCurrentTTSId, getCurrentTTSId)
  const playing = currentId === myId

  // Auto-reset this instance's "playing" claim after the estimated duration.
  // We schedule the reset whenever WE become the playing instance, and
  // cancel the timer if some other instance preempts us.
  useEffect(() => {
    if (!playing) return
    const t = window.setTimeout(() => {
      if (getCurrentTTSId() === myId) setCurrentTTSId(null)
    }, 3000)
    return () => window.clearTimeout(t)
  }, [playing, myId])

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()

    // If currently playing — stop
    if (playing) {
      stopAllTTS()
      return
    }

    // Claim the global playback slot BEFORE starting audio so any other
    // SpeakerBtn instances flip back to their idle icon immediately.
    setCurrentTTSId(myId)

    // If cached, play instantly
    if (isTTSCached(text)) {
      speakEnglish(text)
      return
    }
    setLoading(true)
    try {
      await speakEnglish(text)
    } finally {
      setLoading(false)
    }
  }, [text, playing, myId])

  const outerSize = size + 16

  return (
    <button
      onClick={handleClick}
      className="rounded-full flex items-center justify-center flex-shrink-0 transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 hover:scale-110 active:scale-95"
      style={{
        background: playing ? ACCENT : BG,
        boxShadow: playing ? 'none' : S_SM,
        width: outerSize,
        height: outerSize,
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
      }}
      aria-label={playing ? 'עצור הקראה' : 'הקראה'}
      disabled={loading}
    >
      {loading && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `2.5px solid transparent`,
            borderTopColor: ACCENT,
            borderRightColor: ACCENT,
            animation: 'tts-spin 0.7s linear infinite',
          }}
        />
      )}
      {playing ? (
        /* Stop icon (square) */
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="white">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      ) : (
        /* Speaker icon */
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={ACCENT}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: loading ? 0.4 : 1, transition: 'opacity 0.2s' }}
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
      <style>{`@keyframes tts-spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  )
}
