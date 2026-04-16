import { Component, useMemo, useCallback, lazy, Suspense, type ReactNode } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useVocabStore } from '../../stores/vocabStore'
import type { GameId, GameResult } from './games/types'
import { ALL_GAME_IDS, ALL_PRACTICE_IDS, BG, S, TEXT, MUTED } from './games/constants'

// ErrorBoundary prevents blank page on game crash
class GameErrorBoundary extends Component<
  { children: ReactNode; onBack: () => void },
  { hasError: boolean }
> {
  state = { hasError: false, errorMsg: '' }
  static getDerivedStateFromError(error: Error) { return { hasError: true, errorMsg: error?.message + '\n' + error?.stack } }
  componentDidCatch(error: Error) {
    console.error('[GameRouter] Game crashed:', error)
    try { localStorage.setItem('__debug_crash', error.message + '\n' + error.stack) } catch {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-16 animate-fadeIn" style={{ background: BG }} dir="rtl">
          <p className="text-4xl mb-4">😵</p>
          <p className="text-lg font-bold mb-2" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
            אופס, משהו השתבש
          </p>
          <p className="text-sm mb-6" style={{ color: MUTED }}>
            התוצאות שלך נשמרו. נסה שוב או חזור לתפריט.
          </p>
          {import.meta.env.DEV && this.state.errorMsg && (
            <pre className="text-[10px] text-left mx-4 mb-4 p-3 rounded-lg overflow-auto max-h-40" style={{ background: '#1a1a2e', color: '#ff6b6b', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {this.state.errorMsg}
            </pre>
          )}
          <div className="flex gap-3 justify-center">
            <button
              className="px-6 py-3 rounded-xl font-bold text-sm"
              style={{ background: BG, boxShadow: S.extrudedSm, color: MUTED, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }}
              onClick={this.props.onBack}
            >
              ← חזרה
            </button>
            <button
              className="px-6 py-3 rounded-xl font-bold text-sm text-white"
              style={{ background: 'linear-gradient(135deg, #818CF8, #A855F7)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)' }}
              onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
            >
              נסה שוב 🔄
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Lazy-load game components for code splitting
const SpeedReview = lazy(() => import('./games/SpeedReview'))
const MatchSprint = lazy(() => import('./games/MatchSprint').then(m => ({ default: m.MatchSprint })))
const RescueMode = lazy(() => import('./games/RescueMode').then(m => ({ default: m.RescueMode })))
const RecallRush = lazy(() => import('./games/RecallRush'))
const ContextDetective = lazy(() => import('./games/ContextDetective'))

// New practice mode lazy imports
const LearnMode = lazy(() => import('./games/LearnMode'))
const TestMode = lazy(() => import('./games/TestMode'))
const MatchPairs = lazy(() => import('./games/MatchPairs'))
const GravityMode = lazy(() => import('./games/GravityMode'))
const FlashcardsMode = lazy(() => import('./games/FlashcardsMode'))
const AdaptivePractice = lazy(() => import('./games/AdaptivePractice'))
const WordHackMode = lazy(() => import('./games/WordHackMode'))

const VALID_GAME_IDS = new Set<string>([
  ...ALL_GAME_IDS,
  ...ALL_PRACTICE_IDS,
  'adaptivePractice',
])

function LoadingFallback() {
  return (
    <div
      className="flex items-center justify-center min-h-[60vh]"
      style={{ background: BG }}
    >
      <div
        className="text-center py-8 px-10 rounded-3xl"
        style={{ background: BG, boxShadow: S.extruded }}
      >
        <div
          className="w-8 h-8 rounded-full border-3 mx-auto mb-3 animate-spin"
          style={{ borderColor: `${TEXT}22`, borderTopColor: TEXT, borderWidth: 3 }}
        />
        <p
          className="text-sm font-bold"
          style={{ color: MUTED, fontFamily: 'var(--font-display)' }}
        >
          טוען משחק...
        </p>
      </div>
    </div>
  )
}

export function GameRouter() {
  const { gameId } = useParams<{ gameId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { words } = useVocabStore()

  // Optional unit filter via query param: ?unit=5
  const unitFilter = searchParams.get('unit')
    ? Number(searchParams.get('unit'))
    : null

  // Optional word count override from coach mission: ?count=25
  const missionWordCount = searchParams.get('count')
    ? Number(searchParams.get('count'))
    : undefined

  // Memoize words with optional unit filtering
  const gameWords = useMemo(() => {
    let pool = words
    if (unitFilter !== null && !isNaN(unitFilter)) {
      pool = words.filter((w) => w.unit === unitFilter)
    }
    return pool
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words.length, unitFilter])

  const handleBack = useCallback(() => {
    // If user came from a coach mission (has query params), go to home page
    // Otherwise go to the vocabulary games menu
    const hasMissionParams = searchParams.has('unit') || searchParams.has('count')
    navigate(hasMissionParams ? '/' : '/vocabulary')
  }, [navigate, searchParams])

  const handleComplete = useCallback((_result: GameResult) => {
    // Result is already recorded by useGameSession hook
  }, [])

  if (!gameId || !VALID_GAME_IDS.has(gameId)) {
    return (
      <div
        className="text-center py-16 animate-fadeIn"
        style={{ background: BG }}
        dir="rtl"
      >
        <p
          className="text-lg font-bold mb-4"
          style={{ color: TEXT, fontFamily: 'var(--font-display)' }}
        >
          משחק לא נמצא
        </p>
        <button
          className="px-6 py-3 rounded-xl font-bold text-sm"
          style={{
            background: BG,
            boxShadow: S.extrudedSm,
            color: MUTED,
            fontFamily: 'var(--font-display)',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={handleBack}
        >
          חזרה למשחקים
        </button>
      </div>
    )
  }

  const typedGameId = gameId as GameId

  const gameComponent = (() => {
    switch (typedGameId) {
      // Existing competitive games (use their own props, no missionWordCount)
      case 'speedReview':
        return <SpeedReview words={gameWords} onBack={handleBack} onComplete={handleComplete} />
      case 'matchSprint':
        return <MatchSprint words={gameWords} onBack={handleBack} onComplete={handleComplete} />
      case 'rescueMode':
        return <RescueMode words={gameWords} onBack={handleBack} onComplete={handleComplete} />
      case 'recallRush':
        return <RecallRush words={gameWords} onBack={handleBack} onComplete={handleComplete} />
      case 'contextDetective':
        return <ContextDetective words={gameWords} onBack={handleBack} onComplete={handleComplete} />
      // New practice modes
      case 'learnMode':
        return <LearnMode words={gameWords} onBack={handleBack} onComplete={handleComplete} missionWordCount={missionWordCount} />
      case 'testMode':
        return <TestMode words={gameWords} onBack={handleBack} onComplete={handleComplete} missionWordCount={missionWordCount} />
      case 'matchPairs':
        return <MatchPairs words={gameWords} onBack={handleBack} onComplete={handleComplete} missionWordCount={missionWordCount} />
      case 'gravity':
        return <GravityMode words={gameWords} onBack={handleBack} onComplete={handleComplete} missionWordCount={missionWordCount} />
      case 'flashcards':
        return <FlashcardsMode words={gameWords} onBack={handleBack} onComplete={handleComplete} missionWordCount={missionWordCount} />
      case 'adaptivePractice':
        return <AdaptivePractice words={gameWords} onBack={handleBack} onComplete={handleComplete} missionWordCount={missionWordCount} />
      case 'wordHack':
        return <WordHackMode words={gameWords} onBack={handleBack} onComplete={handleComplete} missionWordCount={missionWordCount} />
    }
  })()

  return (
    <GameErrorBoundary onBack={handleBack}>
      <Suspense fallback={<LoadingFallback />}>
        {gameComponent}
      </Suspense>
    </GameErrorBoundary>
  )
}
