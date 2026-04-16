import type { Word } from '../../../data/vocabulary/types'

export type GameId =
  | 'matchSprint'
  | 'recallRush'
  | 'contextDetective'
  | 'speedReview'
  | 'rescueMode'
  // Practice modes
  | 'learnMode'
  | 'testMode'
  | 'matchPairs'
  | 'gravity'
  | 'flashcards'
  // Adaptive orchestrator
  | 'adaptivePractice'
  // Association game
  | 'wordHack'

export type GameCategory = 'game' | 'practice'

export interface GameProps {
  words: Word[]
  onBack: () => void
  onComplete: (result: GameResult) => void
  /** Word count override from coach mission (via ?count= query param) */
  missionWordCount?: number
}

export interface GameResult {
  score: number
  total: number
  accuracy: number
  bestCombo: number
  xpEarned: number
  durationSec: number
  wordsStrengthened: number
  wrongWords: { word: Word; selectedAnswer?: string }[]
}

export interface GameConfig {
  id: GameId
  title: string
  subtitle: string
  tooltip: string
  icon: string // path to ZNK icon PNG
  accentColor: string
  category: GameCategory
}
