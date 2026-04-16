import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVocabStore } from '../../stores/vocabStore'
import { useGameStatsStore } from '../../stores/gameStatsStore'
import { useGamificationStore } from '../../stores/gamificationStore'
import { GAME_CONFIGS, ALL_GAME_IDS, ALL_PRACTICE_IDS, S, BG, ACCENT, SECONDARY, TEXT, MUTED, WARNING, CORRECT } from './games/constants'
import { asset } from '../../utils/assetUrl'
import type { GameId } from './games/types'

export function GamesHub() {
  const navigate = useNavigate()
  const { getWeakWords, getReviewQueue } = useVocabStore()
  const gameStats = useGameStatsStore()
  const { currentStreak } = useGamificationStore()

  const weakWords = getWeakWords()
  const reviewQueue = getReviewQueue()
  const weakCount = weakWords.length
  const reviewCount = reviewQueue.length

  const recommended = gameStats.getRecommendedGame(weakCount, reviewCount)
  const { played, target } = gameStats.getDailyProgress()
  const dailyPct = Math.min(100, Math.round((played / target) * 100))

  const recommendReason = useMemo(() => {
    if (recommended === 'rescueMode' && weakCount > 0)
      return `${weakCount} מילים חלשות מחכות להצלה`
    if (recommended === 'speedReview' && reviewCount > 0)
      return `${reviewCount} מילים מחכות לחזרה`
    if (recommended === 'recallRush')
      return 'שלוף מילים מהזיכרון'
    return 'קדימה, עוד סיבוב!'
  }, [recommended, weakCount, reviewCount])

  const handleGameClick = (gameId: GameId) => {
    navigate(`/vocabulary/games/${gameId}`)
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-4" dir="rtl">
      {/* Featured recommended game */}
      <div
        className="relative overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
        style={{
          background: BG,
          boxShadow: S.extruded,
          borderRadius: 32,
          padding: '28px 24px',
        }}
        onClick={() => handleGameClick(recommended)}
      >
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ background: `linear-gradient(90deg, ${GAME_CONFIGS[recommended].accentColor}, ${ACCENT})` }}
        />
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${GAME_CONFIGS[recommended].accentColor}, ${ACCENT})`,
              boxShadow: `0 4px 12px ${GAME_CONFIGS[recommended].accentColor}40`,
            }}
          >
            <img
              src={GAME_CONFIGS[recommended].icon}
              alt=""
              style={{ width: 32, height: 32, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-bold mb-0.5"
              style={{ color: GAME_CONFIGS[recommended].accentColor, fontFamily: 'var(--font-display)' }}
            >
              מומלץ במיוחד בשבילך ✨
            </p>
            <h2
              className="text-xl font-extrabold"
              style={{ color: TEXT, fontFamily: 'var(--font-display)' }}
            >
              {GAME_CONFIGS[recommended].title}
            </h2>
            <p
              className="text-sm mt-0.5"
              style={{ color: MUTED, fontFamily: 'var(--font-body)' }}
            >
              {recommendReason}
            </p>
          </div>
          <button
            className="neu-btn-accent text-sm px-5 py-2.5 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              handleGameClick(recommended)
            }}
          >
            יאללה!
          </button>
        </div>
      </div>

      {/* WORD HACK — Featured association game */}
      <div
        className="relative overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
        style={{
          background: BG,
          boxShadow: S.extruded,
          borderRadius: 28,
          padding: '24px 20px',
        }}
        onClick={() => handleGameClick('wordHack' as GameId)}
      >
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ background: `linear-gradient(90deg, #6366F1, #A855F7, #EC4899)` }}
        />
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #6366F1, #A855F7)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
            }}
          >
            <span className="text-2xl">🧠</span>
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-bold mb-0.5"
              style={{ color: '#A855F7', fontFamily: 'var(--font-display)' }}
            >
              חדש! 🔥
            </p>
            <h2
              className="text-xl font-extrabold"
              style={{ color: TEXT, fontFamily: 'var(--font-display)' }}
            >
              WORD HACK
            </h2>
            <p
              className="text-sm mt-0.5"
              style={{ color: MUTED, fontFamily: 'var(--font-body)' }}
            >
              האקים לזיכרון — טריקים למילים
            </p>
          </div>
          <button
            className="text-sm px-5 py-2.5 rounded-xl font-bold text-white flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #6366F1, #A855F7)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
            }}
            onClick={(e) => {
              e.stopPropagation()
              handleGameClick('wordHack' as GameId)
            }}
          >
            שחק!
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div
          className="text-center py-3 px-2"
          style={{ background: BG, boxShadow: S.extrudedSm, borderRadius: 20 }}
        >
          <p
            className="text-lg font-extrabold"
            style={{ color: currentStreak > 0 ? WARNING : MUTED, fontFamily: 'var(--font-display)' }}
          >
            {currentStreak}
          </p>
          <p className="text-xs" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
            ימים רצופים
          </p>
        </div>
        <div
          className="text-center py-3 px-2"
          style={{ background: BG, boxShadow: S.extrudedSm, borderRadius: 20 }}
        >
          <p
            className="text-lg font-extrabold"
            style={{ color: weakCount > 0 ? WARNING : CORRECT, fontFamily: 'var(--font-display)' }}
          >
            {weakCount}
          </p>
          <p className="text-xs" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
            מילים חלשות
          </p>
        </div>
        <div
          className="text-center py-3 px-2"
          style={{ background: BG, boxShadow: S.extrudedSm, borderRadius: 20 }}
        >
          <p
            className="text-lg font-extrabold"
            style={{ color: reviewCount > 0 ? ACCENT : CORRECT, fontFamily: 'var(--font-display)' }}
          >
            {reviewCount}
          </p>
          <p className="text-xs" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
            לחזרה
          </p>
        </div>
      </div>

      {/* 6 Games Grid */}
      <div>
        <h3
          className="text-base font-bold mb-4 flex items-center gap-2"
          style={{ color: TEXT, fontFamily: 'var(--font-display)' }}
        >
          <img src={asset('znk-icon-09.png')} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          כל המשחקים 🎮
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ALL_GAME_IDS.map((gameId) => {
            const config = GAME_CONFIGS[gameId]
            const stats = gameStats.getStats(gameId)
            const neverPlayed = stats.gamesPlayed === 0

            return (
              <div
                key={gameId}
                className="flex items-center gap-4 cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
                style={{ background: BG, boxShadow: S.extrudedSm, borderRadius: 20, padding: 16 }}
                title={config.tooltip}
                onClick={() => handleGameClick(gameId)}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: BG, boxShadow: S.inset }}
                >
                  <img
                    src={config.icon}
                    alt=""
                    style={{ width: 28, height: 28, objectFit: 'contain' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className="font-bold text-sm"
                      style={{ color: TEXT, fontFamily: 'var(--font-display)' }}
                    >
                      {config.title}
                    </p>
                    {neverPlayed && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: `${config.accentColor}18`,
                          color: config.accentColor,
                        }}
                      >
                        NEW
                      </span>
                    )}
                  </div>
                  <p
                    className="text-xs"
                    style={{ color: MUTED, fontFamily: 'var(--font-body)' }}
                  >
                    {config.subtitle}
                  </p>
                  {stats.personalBestScore > 0 && (
                    <p
                      className="text-[10px] font-bold mt-0.5"
                      style={{ color: ACCENT, fontFamily: 'var(--font-display)' }}
                    >
                      שיא: {stats.personalBestScore}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Practice Modes Grid — inset style with colored border */}
      <div
        className="relative"
        style={{
          background: BG,
          boxShadow: S.extruded,
          borderRadius: 28,
          padding: '20px 16px',
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-1.5 rounded-t-[28px]"
          style={{ background: `linear-gradient(90deg, #6366F1, #8B5CF6, #EE2B73)` }}
        />
        <h3
          className="text-base font-bold mb-4 flex items-center gap-2 pt-1"
          style={{ color: TEXT, fontFamily: 'var(--font-display)' }}
        >
          <img src={asset('znk-icon-08.png')} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          מצבי תרגול 📝
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ALL_PRACTICE_IDS.map((gameId) => {
            const config = GAME_CONFIGS[gameId]
            const stats = gameStats.getStats(gameId)
            const neverPlayed = stats.gamesPlayed === 0

            return (
              <div
                key={gameId}
                className="cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  background: BG,
                  boxShadow: S.inset,
                  borderRadius: 18,
                  padding: '14px 12px',
                  borderRight: `4px solid ${config.accentColor}`,
                }}
                title={config.tooltip}
                onClick={() => handleGameClick(gameId)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `${config.accentColor}15`,
                      border: `2px solid ${config.accentColor}40`,
                    }}
                  >
                    <img
                      src={config.icon}
                      alt=""
                      style={{ width: 20, height: 20, objectFit: 'contain' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className="font-bold text-sm"
                        style={{ color: TEXT, fontFamily: 'var(--font-display)' }}
                      >
                        {config.title}
                      </p>
                      {neverPlayed && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: `${config.accentColor}18`,
                            color: config.accentColor,
                          }}
                        >
                          NEW
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs"
                      style={{ color: MUTED, fontFamily: 'var(--font-body)' }}
                    >
                      {config.subtitle}
                    </p>
                    {stats.personalBestScore > 0 && (
                      <p
                        className="text-[10px] font-bold mt-0.5"
                        style={{ color: config.accentColor, fontFamily: 'var(--font-display)' }}
                      >
                        שיא: {stats.personalBestScore}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Back button */}
      <div className="flex justify-center pt-2">
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
          onClick={() => navigate('/vocabulary')}
        >
          ← חזרה למילון
        </button>
      </div>
    </div>
  )
}
