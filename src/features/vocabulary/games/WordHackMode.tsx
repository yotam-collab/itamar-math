import { useState, useEffect, useCallback, useRef } from 'react'
import type { GameProps, GameResult } from './types'
import { GameShell } from './components/GameShell'
import { GameResultScreen } from './components/GameResultScreen'
import { useGameSession } from './hooks/useGameSession'
import { useWordSelector } from './hooks/useWordSelector'
import { useGameStatsStore } from '../../../stores/gameStatsStore'
import { fetchAssociationsBatch, getUserId, type WordAssociations } from '../../../services/associationApi'
import { ACCENT, TEXT, MUTED } from './constants'
import { WordHackPhase1 } from './components/WordHackPhase1'
import { WordHackPhase2 } from './components/WordHackPhase2'
import { WordHackPhase3 } from './components/WordHackPhase3'

type GamePhase = 'loading' | 'phase1' | 'phase2' | 'phase3' | 'results'

const WORD_COUNT = 10

function WordHackMode({ words, onBack, onComplete, missionWordCount }: GameProps) {
  const count = missionWordCount || WORD_COUNT
  const selectedWords = useWordSelector(words, { count, mode: 'mixed' })
  const gameSession = useGameSession('wordHack')
  const gameStats = useGameStatsStore()

  const [phase, setPhase] = useState<GamePhase>('loading')
  const [associations, setAssociations] = useState<Record<number, WordAssociations>>({})
  const [userId] = useState(() => getUserId())

  // Store result in a ref so endSession is only called once
  const resultRef = useRef<GameResult | null>(null)

  // Stats for result screen
  const [ratingsGiven, setRatingsGiven] = useState(0)
  const [associationsCreated, setAssociationsCreated] = useState(0)

  // On mount: fetch associations for selected words
  useEffect(() => {
    if (selectedWords.length === 0) return
    const wordIds = selectedWords.map(w => w.id)
    fetchAssociationsBatch(wordIds).then(data => {
      setAssociations(data)
      setPhase('phase1')
    }).catch(() => {
      // Even on error, proceed -- phases handle missing data gracefully
      setPhase('phase1')
    })
  }, [selectedWords])

  // Phase transitions
  const handlePhase1Complete = useCallback(() => setPhase('phase2'), [])
  const handlePhase2Complete = useCallback(() => setPhase('phase3'), [])

  const handlePhase3Complete = useCallback(() => {
    resultRef.current = gameSession.endSession()
    onComplete(resultRef.current)
    setPhase('results')
  }, [gameSession, onComplete])

  const handleRetry = useCallback(() => {
    window.location.reload()
  }, [])

  // Loading screen
  if (phase === 'loading') {
    return (
      <GameShell gameId="wordHack" onBack={onBack}>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div
            className="w-10 h-10 rounded-full border-3 animate-spin mb-4"
            style={{ borderColor: `${TEXT}22`, borderTopColor: ACCENT, borderWidth: 3 }}
          />
          <p
            className="text-sm font-bold"
            style={{ color: MUTED, fontFamily: 'var(--font-display)' }}
          >
            טוען אסוציאציות...
          </p>
        </div>
      </GameShell>
    )
  }

  // Results screen
  if (phase === 'results') {
    const result = resultRef.current!
    const endMessages = gameSession.getEndMessages()
    if (ratingsGiven > 0) endMessages.push(`\u2B50 \u05D3\u05D9\u05E8\u05D2\u05EA ${ratingsGiven} \u05D0\u05E1\u05D5\u05E6\u05D9\u05D0\u05E6\u05D9\u05D5\u05EA`)
    if (associationsCreated > 0) endMessages.push(`\u270D\uFE0F \u05D9\u05E6\u05E8\u05EA ${associationsCreated} \u05D0\u05E1\u05D5\u05E6\u05D9\u05D0\u05E6\u05D9\u05D5\u05EA`)

    return (
      <GameShell gameId="wordHack" onBack={onBack}>
        <GameResultScreen
          gameId="wordHack"
          score={result.score}
          total={result.total}
          bestCombo={result.bestCombo}
          totalXP={result.xpEarned}
          startTime={gameSession.startTime}
          wrongWords={result.wrongWords}
          wordsStrengthened={result.wordsStrengthened}
          endMessages={endMessages}
          isPersonalBest={gameStats.isPersonalBest('wordHack', result.score)}
          onBack={onBack}
          onRetry={handleRetry}
        />
      </GameShell>
    )
  }

  // Phase indicator (3 dots showing progress)
  const phaseIndex = phase === 'phase1' ? 0 : phase === 'phase2' ? 1 : 2
  const phaseLabels = ['\u05D4\u05E6\u05E6\u05D4', '\u05D3\u05E8\u05D2 + \u05E6\u05D5\u05E8', '\u05D1\u05D5\u05D7\u05DF']

  return (
    <GameShell gameId="wordHack" onBack={onBack}>
      {/* Phase tabs */}
      <div className="flex justify-center gap-1 mb-4">
        {phaseLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className="w-6 h-0.5 rounded-full"
                style={{ background: i <= phaseIndex ? ACCENT : 'rgba(255,255,255,0.1)' }}
              />
            )}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{
                background: i === phaseIndex ? `${ACCENT}20` : 'transparent',
                color: i <= phaseIndex ? ACCENT : MUTED,
                border: i === phaseIndex ? `1px solid ${ACCENT}30` : '1px solid transparent',
                fontFamily: 'var(--font-display)',
              }}
            >
              <span>{i < phaseIndex ? '\u2713' : i + 1}</span>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Render active phase */}
      {phase === 'phase1' && (
        <WordHackPhase1
          words={selectedWords}
          associations={associations}
          onComplete={handlePhase1Complete}
          gameSession={gameSession}
        />
      )}
      {phase === 'phase2' && (
        <WordHackPhase2
          words={selectedWords}
          associations={associations}
          userId={userId}
          onComplete={handlePhase2Complete}
          onRatingGiven={() => setRatingsGiven(r => r + 1)}
          onAssociationCreated={() => setAssociationsCreated(c => c + 1)}
          gameSession={gameSession}
        />
      )}
      {phase === 'phase3' && (
        <WordHackPhase3
          words={selectedWords}
          allWords={words}
          associations={associations}
          onComplete={handlePhase3Complete}
          gameSession={gameSession}
        />
      )}
    </GameShell>
  )
}

export default WordHackMode
