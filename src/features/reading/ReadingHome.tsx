import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useReadingStore } from '../../stores/readingStore'
import { useStudentProfileStore } from '../../stores/studentProfileStore'
import { useCoachStore } from '../../stores/coachStore'
import { useGamificationStore } from '../../stores/gamificationStore'
import { asset } from '../../utils/assetUrl'
import textsData from '../../data/reading/texts.json'
import readingImages from '../../data/reading/reading-images.json'
import { g } from '../../utils/gender'

/* ═══════════════════════════════════════════════════════════════════
   READING HOME · ZNK × BAUHAUS EDITION
   ----------------------------------------------------------------------
   Editorial, constructivist, unapologetic. Built to make reading English
   feel like picking up an issue of a magazine you actually want to read.
   ═══════════════════════════════════════════════════════════════════ */

// ───── Types ────────────────────────────────────────────────────────
interface Passage {
  id: string
  title: string
  difficulty: number            // 1..5
  topic: string
  wordCount: number
  passage?: string              // full text (used for teaser snippet)
  titleHe?: string
  descriptionHe?: string
  descHe?: string               // alternate key in data
}

type StatusFilter = 'all' | 'unread' | 'read'

// ───── Topic mega-buckets ───────────────────────────────────────────
// The dataset has 120+ distinct topics — most with just 1 article. We fold
// them into 7 meaningful "channels" so students actually finish browsing.

type BucketId = 'science' | 'psychology' | 'history' | 'tech' | 'health' | 'society' | 'biz' | 'life'

const BUCKETS: { id: BucketId; label: string; emoji: string; tagline: string }[] = [
  { id: 'science',    label: 'מדעים',            emoji: '🔬', tagline: 'איך העולם באמת עובד' },
  { id: 'psychology', label: 'פסיכולוגיה',       emoji: '🧠', tagline: 'למה אנחנו עושים את מה שאנחנו עושים' },
  { id: 'history',    label: 'היסטוריה ותרבות',  emoji: '🏛️', tagline: 'איך הגענו עד הלום' },
  { id: 'tech',       label: 'טכנולוגיה',         emoji: '💻', tagline: 'מה בונים עכשיו' },
  { id: 'health',     label: 'בריאות',            emoji: '❤️', tagline: 'הגוף והראש' },
  { id: 'society',    label: 'חברה ופילוסופיה',  emoji: '🌍', tagline: 'רעיונות גדולים, שאלות גדולות' },
  { id: 'biz',        label: 'עסקים וכלכלה',     emoji: '📊', tagline: 'איך העולם מוציא ומכניס כסף' },
  { id: 'life',       label: 'ספורט, טיולים ואוכל', emoji: '🌴', tagline: 'הדברים הכי טובים בחיים' },
]

const BUCKET_LABEL: Record<BucketId, string> = BUCKETS.reduce((m, b) => { m[b.id] = b.label; return m }, {} as Record<BucketId, string>)
const BUCKET_EMOJI: Record<BucketId, string> = BUCKETS.reduce((m, b) => { m[b.id] = b.emoji; return m }, {} as Record<BucketId, string>)

// Map each raw dataset topic → bucket. Anything unmapped falls to 'society'.
const TOPIC_TO_BUCKET: Record<string, BucketId> = {
  // Science / nature / STEM / space
  Science: 'science', Nature: 'science', Environment: 'science', Space: 'science',
  Mathematics: 'science', Astronomy: 'science', 'Climate Science': 'science', Ecology: 'science',
  Biotechnology: 'science', Biochemistry: 'science', Immunology: 'science', Genetics: 'science',
  Neuroscience: 'science', 'Marine Biology': 'science', Nanotechnology: 'science',
  Geology: 'science', Meteorology: 'science', Mineralogy: 'science', Hydrology: 'science',
  'Materials Science': 'science', Pharmacology: 'science', Virology: 'science',
  Thermodynamics: 'science', Optics: 'science', Acoustics: 'science',
  'Quantum Physics': 'science', Paleontology: 'science', Volcanology: 'science',
  'Nuclear Energy': 'science', Seismology: 'science', Oceanography: 'science',
  Aerospace: 'science', Agriculture: 'science', Forestry: 'science',
  Fisheries: 'science', 'Wildlife Conservation': 'science',
  'Civil Engineering': 'science', 'Marine Engineering': 'science',
  'Renewable Energy': 'science', 'Data Science': 'science',

  // Psychology
  Psychology: 'psychology',

  // History, culture, arts
  History: 'history', Culture: 'history', 'Cultural Studies': 'history',
  Heritage: 'history', Archaeology: 'history', Architecture: 'history',
  'Archival Studies': 'history', Art: 'history', Literature: 'history',
  Music: 'history', Dance: 'history', Sculpture: 'history',
  Photography: 'history', Fashion: 'history', 'Museum Studies': 'history',
  'Library Science': 'history', Cartography: 'history', Linguistics: 'history',

  // Technology
  Technology: 'tech', Cybersecurity: 'tech', 'Information Science': 'tech',
  Gaming: 'tech', Animation: 'tech', 'Graphic Design': 'tech',
  Robotics: 'tech', Telecommunications: 'tech', 'Green Technology': 'tech',
  'Smart Cities': 'tech', 'Geographic Information Systems': 'tech',
  Cinema: 'tech', 'Film Studies': 'tech', Broadcasting: 'tech',
  Journalism: 'tech', 'Media Studies': 'tech',

  // Health
  Health: 'health', Nutrition: 'health', Epidemiology: 'health',
  'Public Health': 'health', Telemedicine: 'health', 'Veterinary Science': 'health',

  // Society / philosophy / law
  Society: 'society', Philosophy: 'society', Ethics: 'society',
  Law: 'society', Logic: 'society', Education: 'society',
  Sociology: 'society', Anthropology: 'society', Demography: 'society',
  'Gender Studies': 'society', 'Migration Studies': 'society',
  'Political Science': 'society', 'Public Relations': 'society',
  Criminology: 'society', 'Forensic Science': 'society',

  // Business / economics
  Economics: 'biz', Banking: 'biz', 'International Trade': 'biz',
  Insurance: 'biz', Marketing: 'biz', Advertising: 'biz',
  'Human Resources': 'biz', Entrepreneurship: 'biz',
  'Cooperative Economics': 'biz', 'Circular Economy': 'biz',
  Sustainability: 'biz', 'Real Estate': 'biz', 'Supply Chain': 'biz',
  'Project Management': 'biz', 'Quality Control': 'biz',
  Tourism: 'biz', Transportation: 'biz', 'Urban Planning': 'biz',
  Ergonomics: 'biz',

  // Lifestyle
  Sports: 'life', Travel: 'life', Food: 'life',
  Cooking: 'life', Pets: 'life',
}

function bucketOfTopic(topic: string): BucketId {
  return TOPIC_TO_BUCKET[topic] ?? 'society'
}

// ───── Difficulty buckets (data has 5 levels → 4 user buckets) ──────
// bucket = (כל רמה מופנית לדלי אחד, אבל לדלי 'קל' שייכים גם 1 וגם 2)
const DIFF_BUCKETS = [
  { id: 1 as const, label: 'קל',     levels: [1, 2], color: '#1040C0', shape: 'circle' as const, emoji: '🌱', blurb: 'בחימום. משפטים קצרים, אוצר מילים יומיומי — נחיתה רכה.' },
  { id: 2 as const, label: 'בינוני', levels: [3],    color: '#FFE600', shape: 'square' as const, emoji: '🌿', blurb: 'הקצב הבינוני. מבנה אקדמי, אוצר סולידי — כאן גדלים.' },
  { id: 3 as const, label: 'קשה',    levels: [4],    color: '#EE2B73', shape: 'triangle' as const, emoji: '🔥', blurb: 'האזור המעניין. משפטים מורכבים, אוצר מילים אקדמי רחב.' },
  { id: 4 as const, label: 'מומחה',  levels: [5],    color: '#0B0B0B', shape: 'square45' as const, emoji: '👑', blurb: 'רמת אוניברסיטה. אקדמי, צפוף — מסיימים את זה ומנצחים.' },
]

function bucketOf(level: number): 1 | 2 | 3 | 4 {
  if (level <= 2) return 1
  if (level === 3) return 2
  if (level === 4) return 3
  return 4
}

const BUCKET_OF_LEGACY: Record<number, 1 | 2 | 3 | 4> = {
  1: 1, 2: 1, 3: 2, 4: 3, 5: 4,
}

// ───── Reading Timer — Bauhaus-styled ───────────────────────────────
const TIMER_KEY = 'znk-reading-timer'

function getReadingTimer(): { date: string; elapsedSec: number } {
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      const today = new Date().toISOString().split('T')[0]
      if (data.date === today) return data
    }
  } catch { /* ignore */ }
  return { date: new Date().toISOString().split('T')[0], elapsedSec: 0 }
}
function saveReadingTimer(elapsedSec: number) {
  const today = new Date().toISOString().split('T')[0]
  localStorage.setItem(TIMER_KEY, JSON.stringify({ date: today, elapsedSec }))
}
function getReadingMissionMinutes(): number | null {
  try {
    const raw = localStorage.getItem('znk-coach-data')
    if (!raw) return null
    const data = JSON.parse(raw)
    const mission = data?.plan?.missions?.find(
      (m: { type: string; status: string }) => m.type === 'reading' && m.status !== 'completed',
    )
    return mission?.estimatedMinutes ?? null
  } catch { return null }
}

function ReadingTimer() {
  const targetMin = getReadingMissionMinutes()
  const [elapsed, setElapsed] = useState(() => getReadingTimer().elapsedSec)
  const startRef = useRef(Date.now())
  const baseRef = useRef(elapsed)

  useEffect(() => {
    startRef.current = Date.now()
    baseRef.current = elapsed
    const interval = setInterval(() => {
      const now = Math.floor((Date.now() - startRef.current) / 1000) + baseRef.current
      setElapsed(now)
      saveReadingTimer(now)
    }, 1000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (targetMin === null) return
    if (elapsed >= targetMin * 60) {
      try {
        const raw = localStorage.getItem('znk-coach-data')
        if (!raw) return
        const data = JSON.parse(raw)
        const mission = data?.plan?.missions?.find(
          (m: { type: string; status: string }) => m.type === 'reading' && m.status !== 'completed',
        )
        if (mission) localStorage.setItem('znk-active-mission', mission.id)
      } catch { /* ignore */ }
    }
  }, [elapsed, targetMin])

  if (targetMin === null) return null

  const targetSec = targetMin * 60
  const pct = Math.min(100, Math.round((elapsed / targetSec) * 100))
  const done = elapsed >= targetSec
  const remainMin = Math.max(0, Math.ceil((targetSec - elapsed) / 60))
  const elapsedMin = Math.floor(elapsed / 60)
  const elapsedSecRemainder = elapsed % 60

  return (
    <div
      style={{
        margin: '0 0 24px',
        border: '3px solid var(--znk-ink)',
        background: done ? 'var(--znk-yellow)' : '#fff',
        boxShadow: '6px 6px 0 0 var(--znk-ink)',
      }}
    >
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 42, height: 42, borderRadius: '50%', border: '3px solid var(--znk-ink)',
          background: done ? '#fff' : 'var(--znk-pink)', color: done ? 'var(--znk-ink)' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 18, flexShrink: 0,
        }}>
          {done ? '✓' : '⏱'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--znk-ink)', fontFamily: 'var(--font-display)' }}>
              {done ? '🎉 סיימת את יעד הקריאה היומי' : `משימת היום · נשארו ${remainMin} דק׳`}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--znk-ink)', opacity: 0.65, fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em' }}>
              {String(elapsedMin).padStart(2, '0')}:{String(elapsedSecRemainder).padStart(2, '0')} / {targetMin}:00
            </span>
          </div>
          <div style={{ height: 8, background: 'rgba(0,0,0,0.08)', border: '2px solid var(--znk-ink)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: done ? 'var(--znk-ink)' : 'var(--znk-pink)',
                transition: 'width 1s linear',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ───── Teaser snippet builder ───────────────────────────────────────
function teaser(text: string | undefined, max = 140): string {
  if (!text) return ''
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max).replace(/\s+\S*$/, '') + '…'
}

// ───── Deterministic pick for non-personalized variety ──────────────
function stableShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed >>> 0
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export function ReadingHome() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { getPassageStatus, getPassageSession, getCompletedCount } = useReadingStore()
  const { preferredTopics, readingLevel, studentName } = useStudentProfileStore()

  /* ── Daily reading mission + today's completed reading minutes ── */
  const dailyPlan = useCoachStore((s) => s.dailyPlan)
  const generateDailyMissions = useGamificationStore((s) => s.generateDailyMissions)
  const readingSessions = useReadingStore((s) => s.sessions)
  useEffect(() => { generateDailyMissions() }, [generateDailyMissions])

  const readingMission = useMemo(
    () => dailyPlan?.missions?.find((m) => m.type === 'reading'),
    [dailyPlan],
  )
  const targetMinutes = readingMission?.estimatedMinutes ?? 10

  /* Reading minutes completed TODAY — sum `timeSpent` (seconds) of any session
     whose `completedAt` date matches today (local), then convert to minutes. */
  const minutesReadToday = useMemo(() => {
    const todayKey = new Date().toLocaleDateString('en-CA') // yyyy-mm-dd local
    return Object.values(readingSessions).reduce((sum, s) => {
      const ts = new Date(s.completedAt).toLocaleDateString('en-CA')
      return ts === todayKey ? sum + Math.round(s.timeSpent / 60) : sum
    }, 0)
  }, [readingSessions])
  const remainingMinutes = Math.max(0, targetMinutes - minutesReadToday)
  const progressPct = targetMinutes > 0
    ? Math.min(100, Math.round((minutesReadToday / targetMinutes) * 100))
    : 0

  const completed = getCompletedCount()

  // Default selected level = URL ?level=… if provided, otherwise the student's
  // own classified reading level (so a student who the system rates at "קשה"
  // lands on קשה without having to filter manually).
  const levelFromUrl = searchParams.get('level')
  const initialBucket = (() => {
    const n = levelFromUrl ? Number(levelFromUrl) : NaN
    if (Number.isFinite(n)) return BUCKET_OF_LEGACY[n] ?? null
    // Fallback: the student's classified reading level from the profile store.
    return BUCKET_OF_LEGACY[readingLevel] ?? null
  })()

  const [selectedBucket, setSelectedBucket] = useState<1 | 2 | 3 | 4 | null>(initialBucket)
  const [selectedChannel, setSelectedChannel] = useState<BucketId | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [mounted, setMounted] = useState(false)
  const [audioIds, setAudioIds] = useState<Set<string>>(new Set())
  // Pagination — render in chunks of PAGE_SIZE so the initial DOM stays
  // small (~80 viewports of cards became ~3-4). Reset whenever filters
  // change so a freshly-filtered list always starts from page 1.
  const PAGE_SIZE = 24
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)
  // Manifest of passage IDs that actually have images on disk. Used to
  // filter out passages whose image file is missing (would otherwise render
  // as a broken/blue placeholder). Built from public/images/reading/ listing.
  const [imageIds, setImageIds] = useState<Set<string> | null>(null)

  // Filter passages that actually have images. While the manifest is still
  // loading we show everything (no flicker to empty); once the manifest
  // arrives we drop the ~92 passages whose image file is missing.
  const allPassages = useMemo(() => {
    const all = textsData as Passage[]
    if (!imageIds || imageIds.size === 0) return all
    return all.filter(p => imageIds.has(p.id))
  }, [imageIds])

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    fetch(asset('audio/en/reading/lookup.json'))
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, string>) => setAudioIds(new Set(Object.keys(data))))
      .catch(() => {})
  }, [])
  useEffect(() => {
    fetch(asset('images/reading/manifest.json'))
      .then(r => r.ok ? r.json() : [])
      .then((ids: string[]) => setImageIds(new Set(ids)))
      .catch(() => setImageIds(new Set()))
  }, [])

  // ── Derived: channel counts (topic mega-buckets) ──────────────────
  const channelCounts = useMemo(() => {
    const c: Record<BucketId, number> = {
      science: 0, psychology: 0, history: 0, tech: 0,
      health: 0, society: 0, biz: 0, life: 0,
    }
    for (const p of allPassages) {
      const b = bucketOfTopic(p.topic)
      c[b]++
    }
    return c
  }, [allPassages])
  const totalChannels = BUCKETS.filter(b => channelCounts[b.id] > 0).length

  const bucketStats = useMemo(() => {
    const s: Record<1 | 2 | 3 | 4, { total: number; done: number }> = {
      1: { total: 0, done: 0 }, 2: { total: 0, done: 0 }, 3: { total: 0, done: 0 }, 4: { total: 0, done: 0 },
    }
    for (const p of allPassages) {
      const b = BUCKET_OF_LEGACY[p.difficulty] ?? 1
      s[b].total++
      if (getPassageStatus(p.id) === 'completed') s[b].done++
    }
    return s
  }, [allPassages, getPassageStatus])

  // ── Personalization: picks aligned with the student's prefs ──────
  // Picks are computed AFTER applying the active filters (bucket / channel /
  // status) so the recommendations stay consistent with whatever the
  // student is browsing. Previously personalPicks was unfiltered, which
  // produced the "3 picks shown but the count below says 0 / אין התאמות"
  // contradiction.
  const personalPicks = useMemo<Passage[]>(() => {
    const studentBucket = BUCKET_OF_LEGACY[readingLevel] ?? 2
    // Prefs can be raw topic names OR already a channel — try both.
    const prefChannels = new Set<BucketId>(
      (preferredTopics ?? []).map(t => (BUCKETS.some(b => b.id === t) ? (t as BucketId) : bucketOfTopic(t))),
    )

    // Apply the SAME filters that the grid uses, so picks and counts agree.
    let pool = allPassages.slice()
    if (selectedBucket !== null) pool = pool.filter(p => BUCKET_OF_LEGACY[p.difficulty] === selectedBucket)
    if (selectedChannel !== null) pool = pool.filter(p => bucketOfTopic(p.topic) === selectedChannel)
    if (statusFilter === 'read') pool = pool.filter(p => getPassageStatus(p.id) === 'completed')
    else if (statusFilter === 'unread') pool = pool.filter(p => getPassageStatus(p.id) !== 'completed')

    const unread = pool.filter(p => getPassageStatus(p.id) !== 'completed')

    // 1) Matches preferred channel + close to student's level
    const sweet = unread.filter(p =>
      (prefChannels.size === 0 || prefChannels.has(bucketOfTopic(p.topic))) &&
      Math.abs(BUCKET_OF_LEGACY[p.difficulty] - studentBucket) <= 1,
    )
    // 2) Fallback: just near-level if preference has no overlap
    const near = unread.filter(p => Math.abs(BUCKET_OF_LEGACY[p.difficulty] - studentBucket) <= 1)
    const final = sweet.length >= 3 ? sweet : (near.length >= 3 ? near : unread.length > 0 ? unread : pool)
    const seed = (new Date().getDate() * 31 + completed) // stable within a day
    const shuffled = stableShuffle(final, seed)

    // Prefer passages with audio + Hebrew metadata
    const scored = shuffled
      .map(p => ({
        p,
        score: (audioIds.has(p.id) ? 2 : 0) + (p.titleHe ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .map(x => x.p)

    return scored.slice(0, 3)
  }, [allPassages, preferredTopics, readingLevel, getPassageStatus, audioIds, completed, selectedBucket, selectedChannel, statusFilter])

  // ── Grid: apply filters ───────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...allPassages]
    if (selectedBucket !== null) list = list.filter(p => BUCKET_OF_LEGACY[p.difficulty] === selectedBucket)
    if (selectedChannel !== null) list = list.filter(p => bucketOfTopic(p.topic) === selectedChannel)
    if (statusFilter === 'read') list = list.filter(p => getPassageStatus(p.id) === 'completed')
    else if (statusFilter === 'unread') list = list.filter(p => getPassageStatus(p.id) !== 'completed')
    list.sort((a, b) => {
      const ar = getPassageStatus(a.id) === 'completed' ? 1 : 0
      const br = getPassageStatus(b.id) === 'completed' ? 1 : 0
      if (ar !== br) return ar - br
      const aAudio = audioIds.has(a.id) ? 0 : 1
      const bAudio = audioIds.has(b.id) ? 0 : 1
      if (aAudio !== bAudio) return aAudio - bAudio
      return a.difficulty - b.difficulty
    })
    return list
  }, [allPassages, selectedBucket, selectedChannel, statusFilter, getPassageStatus, audioIds])

  // ── Featured (top of grid) ────────────────────────────────────────
  // Prefer an uncompleted passage that has BOTH image AND pre-recorded audio.
  // Reason: the featured card is the "shop window" — if it has no image or
  // falls back to robotic TTS, it looks low-quality. Fall back gracefully.
  const featured = useMemo<Passage | null>(() => {
    const imagesMap = readingImages as Record<string, unknown>
    const uncompleted = filtered.filter(p => getPassageStatus(p.id) !== 'completed')
    const hasBoth = (p: Passage) => (p.id in imagesMap) && audioIds.has(p.id)
    const hasEither = (p: Passage) => (p.id in imagesMap) || audioIds.has(p.id)

    // Priority 1: uncompleted + image + audio
    const tier1 = uncompleted.filter(hasBoth)
    if (tier1.length > 0) return tier1[0]

    // Priority 2: uncompleted + image OR audio
    const tier2 = uncompleted.filter(hasEither)
    if (tier2.length > 0) return tier2[0]

    // Fallback: any uncompleted / any with media / first
    return uncompleted[0] ?? filtered.find(hasEither) ?? filtered[0] ?? null
  }, [filtered, getPassageStatus, audioIds])
  const grid = useMemo(() => filtered.filter(p => p.id !== featured?.id), [filtered, featured])
  // Reset pagination whenever the filtered set changes (filter swap,
  // bucket flip, channel pick, status toggle) — otherwise the user could
  // be stuck on page-N of an old filter.
  useEffect(() => { setDisplayCount(PAGE_SIZE) }, [selectedBucket, selectedChannel, statusFilter])
  const visibleGrid = useMemo(() => grid.slice(0, displayCount), [grid, displayCount])
  const hasMore = grid.length > displayCount

  const unread = allPassages.length - completed
  const pct = allPassages.length > 0 ? Math.round((completed / allPassages.length) * 100) : 0

  const pickRandom = () => {
    const pool = allPassages.filter(p => getPassageStatus(p.id) !== 'completed')
    if (pool.length === 0) return
    const pick = pool[Math.floor(Math.random() * pool.length)]
    navigate(`/reading/${pick.id}`)
  }

  const clearAll = () => { setSelectedBucket(null); setSelectedChannel(null); setStatusFilter('all') }
  const anyFilter = selectedBucket !== null || selectedChannel !== null || statusFilter !== 'all'

  // ═══════════════════════════════════════════════════════════════

  return (
    <div className={`rh ${mounted ? 'rh-on' : ''}`} style={{ paddingBottom: 48 }}>
      <style>{cssBlock}</style>

      {/* ═══ HERO ═══ */}
      <section className="rh-hero rh-up">
        <div className="rh-hero-grid">
          <div className="rh-hero-left">
            {/* Single page-intro chip — small tag identifying the zone.
                The big motivational headline comes right after, and ONE
                concise lede paragraph explains the "why". Removed both
                the duplicate `.rh-kicker` and the verbose old lede that
                were causing a double-yellow-tag hierarchy issue. */}
            <span className="rh-section-crown">
              <span className="rh-section-crown-ico" aria-hidden="true">📖</span>
              <span className="rh-section-crown-text">
                <small>אמירנט · אזור תרגול</small>
                <b>תרגול קטעי קריאה</b>
              </span>
            </span>
            <h1 className="rh-hero-title">
              כל קטע =<br />
              <span className="rh-under">עוד נקודה</span><br />
              <span className="rh-hero-pink">לפטור.</span>
            </h1>
            <p className="rh-hero-lede">
              {allPassages.length.toLocaleString()} קטעים אקדמיים בארבע רמות — מדעים, פסיכולוגיה, היסטוריה, טכנולוגיה ועוד. הקריאה היא הכלי הכי חזק להעלאת ציון ההבנה בבחינה. כמה לקרוא ביום? הבוט של זינוק יגיד {g('לך', 'לך')} בדיוק.
            </p>

            {/* Daily reading timer + Start CTA — orients student to today's goal
                and jumps straight into the featured passage matched to level. */}
            <div className="rh-daily-timer" role="region" aria-label="משימת הקריאה היומית">
              <div className="rh-timer-gauge">
                <svg viewBox="0 0 60 60" className="rh-timer-svg" aria-hidden="true">
                  <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(10,20,35,0.08)" strokeWidth="6" />
                  <circle
                    cx="30" cy="30" r="24" fill="none"
                    stroke="var(--znk-pink)" strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(progressPct / 100) * 150.8} 150.8`}
                    transform="rotate(-90 30 30)"
                    style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1)' }}
                  />
                </svg>
                <div className="rh-timer-inner">
                  {remainingMinutes > 0 ? (
                    <>
                      <b>{remainingMinutes}</b>
                      <small>דק׳</small>
                    </>
                  ) : (
                    <span style={{ fontSize: 20 }}>🎉</span>
                  )}
                </div>
              </div>
              <div className="rh-timer-text">
                <small>משימת הקריאה היומית</small>
                <b>
                  {remainingMinutes > 0
                    ? <>נותרו <span className="rh-timer-highlight">{remainingMinutes} דק׳</span> {minutesReadToday > 0 ? `(${minutesReadToday}/${targetMinutes})` : `מתוך ${targetMinutes}`}</>
                    : g('סיימת את משימת הקריאה היומית — כל הכבוד!', 'סיימת את משימת הקריאה היומית — כל הכבוד!')}
                </b>
              </div>
              <button
                className="rh-timer-cta znk-cta-primary"
                onClick={() => {
                  if (readingMission) {
                    try { localStorage.setItem('znk-active-mission', readingMission.id) } catch { /* ok */ }
                  }
                  // Prefer the curated featured passage; otherwise jump into
                  // any unread passage so the CTA is never "dead" while the
                  // library still has unread material. Final fallback: any
                  // passage at all (still preferable to a no-op click).
                  const target = featured
                    ?? allPassages.find(p => getPassageStatus(p.id) !== 'completed')
                    ?? allPassages[0]
                  if (target) navigate(`/reading/${target.id}`)
                  else navigate('/reading')
                }}
                disabled={allPassages.length === 0}
                aria-label={g('התחל לקרוא', 'התחילי לקרוא')}
              >
                <span>{g('התחל לקרוא', 'התחילי לקרוא')}</span>
                {/* Arrow LEFT — forward direction in RTL (unified across gateways) */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
              </button>
            </div>

            <div className="rh-hero-meta">
              <div><span className="big">{allPassages.length.toLocaleString()}</span><span className="lbl">קטעים</span></div>
              <div><span className="big">{totalChannels}</span><span className="lbl">ערוצים</span></div>
              <div><span className="big">4</span><span className="lbl">רמות</span></div>
              <div><span className="big">{pct}%</span><span className="lbl">{g('קראת', 'קראת')}</span></div>
            </div>
          </div>

          {/* Geometric composition — navy panel */}
          <div className="rh-hero-right">
            <div className="rh-shape rh-circle" />
            <div className="rh-shape rh-square" />
            <div className="rh-tri" />
            <div className="rh-shape rh-dot" />
            <img
              className="rh-hero-char"
              src={asset('char-books.png')}
              alt=""
              aria-hidden="true"
            />
            <div className="rh-credit">FORM · FUNCTION · FLUENCY</div>
          </div>
        </div>
      </section>

      {/* ═══ TICKER ═══ */}
      <div className="rh-ticker" aria-hidden="true">
        <div className="rh-ticker-track">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} style={{ display: 'inline-flex', gap: 36 }}>
              <span><i className="round" /> הקריאה היא שריר</span>
              <span><i className="pink" /> 10 דקות ביום · 100% הבדל</span>
              <span><i className="round pink" /> קריאה = הלב של אמירנט</span>
              <span><i /> READ HARD · SCORE HIGH</span>
              <span><i className="pink" /> 980 קטעים אקדמיים</span>
              <span><i className="round" /> 4 רמות · 8 ערוצים</span>
              <span><i /> ZNK READING CLUB</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reading timer intentionally does NOT run on the library page — it only
          ticks while the student is inside a passage (see InAppReader). */}

      {/* ═══ PERSONAL PICKS ═══ */}
      {personalPicks.length > 0 && (
        <section className="rh-wrap rh-up d2">
          <div className="rh-shead">
            <div>
              <span className="rh-eyebrow">★ המלצות אישיות</span>
              <h2>
                {studentName ? `${studentName}, הנה שלושה קטעי קריאה במיוחד ${g('בשבילך', 'בשבילך')}:` : `הנה שלושה קטעי קריאה במיוחד ${g('בשבילך', 'בשבילך')}:`}
              </h2>
              <p className="rh-shead-lede">
                {preferredTopics && preferredTopics.length > 0
                  ? `בחרנו ${g('אותם', 'אותם')} מהערוצים ${g('שסימנת', 'שסימנת')} שמעניינים ${g('אותך', 'אותך')}, וברמה שמתאימה ${g('לך', 'לך')} בדיוק עכשיו. ${g('תתחיל', 'תתחילי')} מאחד — ו${g('תראה', 'תראי')} איך הקריאה זורמת.`
                  : `שלושה קטעים ברמה ${g('שלך', 'שלך')} — ${g('תתחיל', 'תתחילי')} מאחד, ו${g('תראה', 'תראי')} איך הקריאה זורמת.`}
              </p>
            </div>
            <button className="rh-pill-btn" onClick={pickRandom}>קטע אקראי <span aria-hidden="true">→</span></button>
          </div>

          <div className="rh-picks">
            {personalPicks.map((p, i) => (
              <PickCard key={p.id} passage={p} idx={i} audioIds={audioIds} navigate={navigate} />
            ))}
          </div>
        </section>
      )}

      {/* ═══ DIFFICULTY CHAPTERS ═══ */}
      <section className="rh-wrap rh-up d3">
        <div className="rh-shead">
          <div>
            <span className="rh-eyebrow">📘 רמת קריאה</span>
            <h2>{g('בחר את הרמה שלך.', 'בחרי את הרמה שלך.')} {g('ומכאן — מטפסים.', 'ומכאן — מטפסות.')}</h2>
          </div>
          {selectedBucket !== null && (
            <button className="rh-pill-btn ghost" onClick={() => setSelectedBucket(null)}>הצג הכל ✕</button>
          )}
        </div>

        <div className="rh-chapters">
          {DIFF_BUCKETS.map(b => {
            const stats = bucketStats[b.id]
            const bpct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
            const isActive = selectedBucket === b.id
            return (
              <button
                key={b.id}
                className={`rh-chapter ${isActive ? 'on' : ''}`}
                onClick={() => setSelectedBucket(isActive ? null : b.id)}
                style={{ ['--accent' as any]: b.color }}
              >
                <div className="rh-chap-top">
                  <div className={`rh-chap-shape s-${b.shape}`} />
                  <div className="rh-chap-dots">
                    {[1, 2, 3, 4].map(n => (
                      <i key={n} className={b.id >= n ? 'f' : ''} />
                    ))}
                  </div>
                </div>
                <div className="rh-chap-label">{b.label}</div>
                <div className="rh-chap-blurb">{b.blurb}</div>
                <div className="rh-chap-progress">
                  <div className="bar"><div style={{ width: `${bpct}%` }} /></div>
                  <span>{stats.done}/{stats.total}</span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ═══ CHANNELS (consolidated topic buckets) ═══ */}
      <section className="rh-wrap rh-up d4">
        <div className="rh-shead compact">
          <div>
            <span className="rh-eyebrow">🏷️ ערוצים</span>
            <h3 className="rh-h3">{g('על מה בא לך', 'על מה בא לך')} לקרוא היום?</h3>
          </div>
          {selectedChannel && (
            <button className="rh-pill-btn ghost" onClick={() => setSelectedChannel(null)}>הצג הכל ✕</button>
          )}
        </div>
        <div className="rh-chips">
          {BUCKETS.filter(b => channelCounts[b.id] > 0).map((b, i) => {
            const isActive = selectedChannel === b.id
            return (
              <button
                key={b.id}
                className={`rh-chip ${isActive ? 'on' : ''}`}
                onClick={() => setSelectedChannel(isActive ? null : b.id)}
                title={b.tagline}
              >
                <span className={`rh-chip-dot d-${i % 3}`} />
                <span className="rh-chip-emoji">{b.emoji}</span>
                <span className="rh-chip-name">{b.label}</span>
                <span className="rh-chip-count">{channelCounts[b.id]}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ═══ STATUS TABS ═══ */}
      <section className="rh-wrap rh-up d5">
        <div className="rh-tabs">
          <button data-on={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
            הכל <span>{allPassages.length}</span>
          </button>
          <button data-on={statusFilter === 'unread'} onClick={() => setStatusFilter('unread')}>
            להשלמה <span>{unread}</span>
          </button>
          <button data-on={statusFilter === 'read'} onClick={() => setStatusFilter('read')}>
            הושלמו <span>{completed}</span>
          </button>
        </div>
      </section>

      {/* ═══ RESULTS COUNT ═══ */}
      <section className="rh-wrap rh-up d5">
        <div className="rh-count">
          <span><b>{filtered.length}</b> קטעים</span>
          {anyFilter && <button onClick={clearAll}>נקה הכל</button>}
        </div>
      </section>

      {/* ═══ FEATURED ═══ */}
      {featured && (
        <section className="rh-wrap rh-up d6" style={{ marginTop: 8 }}>
          <FeaturedCard passage={featured} audioIds={audioIds} navigate={navigate} />
        </section>
      )}

      {/* ═══ GRID ═══ */}
      <section className="rh-wrap rh-up d7">
        <div className="rh-grid">
          {visibleGrid.map((p, idx) => (
            <PassageCard
              key={p.id}
              passage={p}
              audioIds={audioIds}
              navigate={navigate}
              session={getPassageSession(p.id)}
              done={getPassageStatus(p.id) === 'completed'}
              idx={idx}
            />
          ))}
        </div>

        {hasMore && (
          <div className="rh-loadmore-wrap">
            <button
              type="button"
              className="rh-loadmore"
              onClick={() => setDisplayCount(c => c + PAGE_SIZE)}
            >
              טען עוד {Math.min(PAGE_SIZE, grid.length - displayCount)} קטעים
              <span className="rh-loadmore-meta">· {displayCount} מתוך {grid.length}</span>
            </button>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="rh-empty">
            <div className="rh-empty-shape" />
            <h3>אין התאמות. עדיין.</h3>
            <p>{g('נסה', 'נסי')} להחליף רמה או ערוץ — או פשוט {g('צא', 'צאי')} לקטע אקראי.</p>
            <button className="rh-pill-btn" onClick={clearAll}>נקה סינון</button>
          </div>
        )}
      </section>

      {/* ═══ STATS STRIP ═══ */}
      <section className="rh-stats rh-up d8">
        <div className="rh-stats-inner">
          <div className="rh-stat"><div className="sh"></div><b>{allPassages.length.toLocaleString()}</b><span>קטעים בספרייה</span></div>
          <div className="rh-stat"><div className="sh"></div><b>{totalChannels}</b><span>ערוצי תוכן</span></div>
          <div className="rh-stat"><div className="sh"></div><b>4</b><span>רמות קריאה</span></div>
          <div className="rh-stat"><div className="sh"></div><b>24 / 7</b><span>זמינים לקריאה</span></div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="rh-cta rh-up d9">
        <div className="deco c" />
        <div className="deco s" />
        <h3>הקריאה היא<br /><span>שריר.</span> תאמן אותו.</h3>
        <p>טקסטים אקדמיים אמיתיים, ברמה {g('שלך', 'שלך')}, על נושאים שבאמת {g('מעניינים אותך', 'מעניינים אותך')}. הבוט של זינוק יגיד {g('לך', 'לך')} כמה לקרוא היום — {g('אתה', 'את')} רק {g('צריך', 'צריכה')} להתחיל.</p>
        <button className="rh-bigbtn" onClick={pickRandom}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          {g('בוא נתחיל', 'בואי נתחיל')} · קטע אקראי
        </button>
      </section>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   SUB COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

function FeaturedCard({
  passage: p, audioIds, navigate,
}: {
  passage: Passage
  audioIds: Set<string>
  navigate: (to: string) => void
}) {
  const mins = Math.max(1, Math.round(p.wordCount / 150))
  const bucket = BUCKET_OF_LEGACY[p.difficulty] ?? 1
  const info = DIFF_BUCKETS.find(b => b.id === bucket)!
  const hasImg = p.id in (readingImages as any)
  const snippet = teaser(p.descriptionHe || (p as any).descHe || p.passage, 160)
  return (
    <article className="rh-featured" onClick={() => navigate(`/reading/${p.id}`)}>
      <div className="rh-feat-img">
        {hasImg ? (
          <img src={asset(`images/reading/${p.id}.webp`)} alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0' }} />
        ) : <div className="rh-feat-pattern" />}
        <span className="rh-feat-badge">{info.emoji} {info.label}</span>
        <span className="rh-feat-stamp">
          <span className="num">{p.wordCount}</span>
          <span className="lbl">WORDS</span>
        </span>
      </div>
      <div className="rh-feat-body">
        <div className="rh-feat-tag">
          {BUCKET_EMOJI[bucketOfTopic(p.topic)]} · {BUCKET_LABEL[bucketOfTopic(p.topic)]} · FEATURE
        </div>
        <h2 className="rh-feat-title" dir="ltr">{p.title}</h2>
        {p.titleHe && <p className="rh-feat-title-he">{p.titleHe}</p>}
        {snippet && <p className="rh-feat-lede">{snippet}</p>}
        <div className="rh-feat-meta">
          <span>~{mins} דק׳</span>
          <span>·</span>
          <span>{p.wordCount} מילים</span>
          <span>·</span>
          <span>רמה {info.label}</span>
          {audioIds.has(p.id) && <><span>·</span><span>🔊 הקראה</span></>}
        </div>
        <div className="rh-feat-cta">
          <span>לקרוא עכשיו</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
        </div>
      </div>
    </article>
  )
}

function PickCard({
  passage: p, idx, audioIds, navigate,
}: {
  passage: Passage
  idx: number
  audioIds: Set<string>
  navigate: (to: string) => void
}) {
  const mins = Math.max(1, Math.round(p.wordCount / 150))
  const bucket = BUCKET_OF_LEGACY[p.difficulty] ?? 1
  const info = DIFF_BUCKETS.find(b => b.id === bucket)!
  const hasImg = p.id in (readingImages as any)
  const snippet = teaser(p.descriptionHe || (p as any).descHe || p.passage, 120)
  const colors = ['var(--znk-yellow)', 'var(--znk-pink)', 'var(--znk-navy)']
  const accent = colors[idx % colors.length]
  const isDark = idx % 3 === 2
  return (
    <article
      className="rh-pick"
      style={{ ['--accent' as any]: accent, color: isDark ? '#F7F4EE' : '#0B0B0B' }}
      onClick={() => navigate(`/reading/${p.id}`)}
    >
      <div className="rh-pick-top">
        <span className="rh-pick-num">{String(idx + 1).padStart(2, '0')}</span>
        <span className="rh-pick-topic">{BUCKET_EMOJI[bucketOfTopic(p.topic)]} {BUCKET_LABEL[bucketOfTopic(p.topic)]}</span>
      </div>
      {hasImg && (
        <div className="rh-pick-img">
          <img src={asset(`images/reading/${p.id}.webp`)} alt="" loading="lazy" />
        </div>
      )}
      <h3 dir="ltr">{p.title}</h3>
      {p.titleHe && <p className="rh-pick-he">{p.titleHe}</p>}
      {snippet && <p className="rh-pick-lede">{snippet}</p>}
      <div className="rh-pick-meta">
        <span>~{mins} דק׳ · {p.wordCount} מילים</span>
        <span className="rh-pick-level">{info.emoji} {info.label}</span>
      </div>
      <div className="rh-pick-cta">
        {audioIds.has(p.id) && <span className="rh-audio">🔊</span>}
        <span>לקרוא</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
      </div>
    </article>
  )
}

function PassageCard({
  passage: p, audioIds, navigate, session, done, idx,
}: {
  passage: Passage
  audioIds: Set<string>
  navigate: (to: string) => void
  session?: { score: number; totalQuestions: number } | null | undefined
  done: boolean
  idx: number
}) {
  const mins = Math.max(1, Math.round(p.wordCount / 150))
  const bucket = BUCKET_OF_LEGACY[p.difficulty] ?? 1
  const info = DIFF_BUCKETS.find(b => b.id === bucket)!
  const hasImg = p.id in (readingImages as any)
  const snippet = teaser(p.descriptionHe || (p as any).descHe || p.passage, 130)
  return (
    <article
      className={`rh-card ${done ? 'is-done' : ''}`}
      onClick={() => navigate(`/reading/${p.id}`)}
    >
      <div className={`rh-card-badge bg-${idx % 3}`} />
      <div className="rh-card-media">
        {hasImg ? (
          <img src={asset(`images/reading/${p.id}.webp`)} alt="" loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0' }} />
        ) : <div className="rh-card-pattern" />}
        <span className="rh-card-topic">{BUCKET_EMOJI[bucketOfTopic(p.topic)]} {BUCKET_LABEL[bucketOfTopic(p.topic)]}</span>
        {audioIds.has(p.id) && <span className="rh-card-audio" title="הקראה זמינה">🔊</span>}
        {done && (
          <div className="rh-card-done">
            <span>✓</span>
            {session && <em>{session.score}/{session.totalQuestions}</em>}
          </div>
        )}
      </div>
      <div className="rh-card-body">
        <h3 dir="ltr">{p.title}</h3>
        {p.titleHe && <p className="rh-card-he">{p.titleHe}</p>}
        {snippet && <p className="rh-card-lede">{snippet}</p>}
        <div className="rh-card-meta">
          <span className="rh-card-level" style={{ background: info.color, color: bucket === 2 ? '#0B0B0B' : '#F7F4EE' }}>
            {info.emoji} {info.label}
          </span>
          <span className="rh-card-mins">~{mins} דק׳ · {p.wordCount} מ׳</span>
          <span className="rh-card-arrow">→</span>
        </div>
      </div>
    </article>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   CSS BLOCK — scoped to .rh
   ═══════════════════════════════════════════════════════════════════ */

const cssBlock = `
@import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700;900&display=swap');

.rh {
  --znk-ink: #0B0B0B;
  --znk-paper: #F7F4EE;
  --znk-paper-2: #ECE6DA;
  --znk-yellow: #FFE600;
  --znk-yellow-soft: #FFF3A0;
  --znk-pink: #EE2B73;
  --znk-pink-ink: #C91D60;
  --znk-navy: #0d294b;
  --znk-muted: #6B7280;

  --serif: 'Frank Ruhl Libre', 'Heebo', serif;
  --sh-sm: 4px 4px 0 0 var(--znk-ink);
  --sh-md: 6px 6px 0 0 var(--znk-ink);
  --sh-lg: 10px 10px 0 0 var(--znk-ink);

  background: var(--znk-paper);
  color: var(--znk-ink);
  margin: -16px; padding: 0;  /* break out of shell padding to bleed edges */
}

/* ── Entrance ── */
.rh-up { opacity: 0; transform: translateY(18px); transition: opacity .55s cubic-bezier(.22,1,.36,1), transform .55s cubic-bezier(.22,1,.36,1); }
.rh-on .rh-up { opacity: 1; transform: none; }
.rh-on .rh-up.d2 { transition-delay: .06s; }
.rh-on .rh-up.d3 { transition-delay: .12s; }
.rh-on .rh-up.d4 { transition-delay: .18s; }
.rh-on .rh-up.d5 { transition-delay: .24s; }
.rh-on .rh-up.d6 { transition-delay: .30s; }
.rh-on .rh-up.d7 { transition-delay: .36s; }
.rh-on .rh-up.d8 { transition-delay: .42s; }
.rh-on .rh-up.d9 { transition-delay: .48s; }

.rh-wrap { max-width: 1280px; margin: 0 auto; padding: 28px 20px; }

/* ═══ HERO ═══ */
.rh-hero { border-bottom: 3px solid var(--znk-ink); background: var(--znk-paper); position: relative; overflow: hidden; }
.rh-hero-grid { max-width: 1280px; margin: 0 auto; display: grid; grid-template-columns: 1.18fr .82fr; min-height: 480px; }
@media (max-width: 880px) { .rh-hero-grid { grid-template-columns: 1fr; } }

.rh-hero-left { padding: 44px 30px 40px; display: flex; flex-direction: column; justify-content: space-between; gap: 18px; }

/* Page intro — prominent "what is this page" header so first-time
   readers immediately understand this is the reading practice zone. */
.rh-page-intro { margin-bottom: 6px; }
.rh-section-crown {
  display: inline-flex; align-items: center; gap: 14px;
  padding: 14px 22px 14px 18px;
  background: linear-gradient(135deg, var(--znk-yellow, #FFE600) 0%, #FFC72C 100%);
  color: var(--znk-ink, #0A0E1F);
  border: 3px solid var(--znk-ink, #0A0E1F);
  box-shadow: 5px 5px 0 0 var(--znk-ink, #0A0E1F);
  border-radius: 999px;
}
.rh-section-crown-ico {
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--znk-ink, #0A0E1F);
  font-size: 24px;
  flex-shrink: 0;
}
.rh-section-crown-text { display: flex; flex-direction: column; gap: 2px; line-height: 1; text-align: right; }
.rh-section-crown-text small {
  font-family: var(--font-display);
  font-size: 11px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase;
  color: rgba(10,14,31,0.7);
}
.rh-section-crown-text b {
  font-family: var(--font-display);
  font-size: 26px; font-weight: 900; letter-spacing: -.015em;
  color: var(--znk-ink, #0A0E1F); line-height: 1.05;
}
.rh-page-subtitle {
  margin: 14px 4px 0;
  font-family: var(--font-display);
  font-size: 17px; font-weight: 700; line-height: 1.45;
  color: #1C1C1C; max-width: 56ch; letter-spacing: -.005em;
}
@media (max-width: 720px){
  .rh-section-crown { padding: 10px 16px 10px 12px; gap: 10px; margin-bottom: 4px; }
  .rh-section-crown-ico { width: 32px; height: 32px; font-size: 18px; }
  .rh-section-crown-text small { font-size: 9.5px; letter-spacing: .16em; }
  .rh-section-crown-text b { font-size: 17px; }
  .rh-page-subtitle { font-size: 14.5px; margin-top: 10px; max-width: none; }

  /* MOBILE FOLD FIX (2026-04-26 v3) — title bigger + lede HIDDEN above
     the fold. The crown chip + the headline give enough context; the
     paragraph was eating 50-60px and pushing the CTA below the line. */
  .rh-hero { padding: 14px 14px 14px; }
  .rh-hero-title {
    /* Even bigger — fully editorial. Range 50-72px sits in iPhone SE
       through full-width tablets without breaking. */
    font-size: clamp(50px, 13vw, 72px) !important;
    line-height: 0.9 !important;
    letter-spacing: -0.04em;
  }
  /* Lede HIDDEN on mobile — secondary content, the headline + crown
     deliver the page's intent without it. Restored on desktop. */
  .rh-hero-lede {
    display: none !important;
  }
  /* Compact timer card with a MUCH bigger CTA — yellow glow + lift */
  .rh-daily-timer {
    margin-top: 14px !important;
    padding: 12px !important;
    gap: 10px;
    grid-template-columns: 1fr !important;
  }
  .rh-timer-gauge { width: 44px !important; height: 44px !important; }
  .rh-timer-inner b { font-size: 15px; }
  .rh-timer-inner small { font-size: 8px; }
  .rh-timer-text small { font-size: 9.5px; letter-spacing: .14em; }
  .rh-timer-text b { font-size: 13.5px; line-height: 1.2; }
  /* CTA on its own row, bigger, more prominent */
  .rh-timer-cta {
    grid-column: 1 / -1 !important;
    width: 100% !important;
    justify-content: center !important;
    padding: 14px 22px !important;
    font-size: 15px !important;
    background: linear-gradient(135deg, #FFE600, #FFC72C) !important;
    color: var(--znk-ink) !important;
    border: 2.5px solid var(--znk-ink) !important;
    box-shadow: 5px 5px 0 0 var(--znk-ink), 0 0 32px rgba(255,230,0,0.45) !important;
    text-shadow: 0 1px 0 rgba(255,255,255,0.5);
    font-weight: 900 !important;
    margin-top: 4px;
  }
  /* Meta-stats row HIDDEN above the fold — secondary content. The data
     (passages/levels/etc.) is repeated lower on the page. */
  .rh-hero-meta { display: none !important; }
}

@media (max-width: 420px){
  .rh-hero-title { font-size: 52px !important; }
}

.rh-kicker {
  display: inline-flex; align-items: center; gap: 10px; align-self: flex-start;
  font-size: 11px; font-weight: 800; letter-spacing: .24em; text-transform: uppercase;
  padding: 7px 12px; background: var(--znk-yellow); border: 2px solid var(--znk-ink);
  box-shadow: var(--sh-sm);
}
.rh-kicker::before { content: ""; width: 10px; height: 10px; border-radius: 50%; background: var(--znk-pink); border: 2px solid var(--znk-ink); }
.rh-kicker b { font-weight: 900; }

.rh-hero-title {
  font-family: var(--font-display);
  font-weight: 900; font-size: clamp(52px, 8.5vw, 128px);
  line-height: .88; letter-spacing: -.04em; color: var(--znk-ink);
}
.rh-hero-pink { color: var(--znk-pink); }
.rh-under { position: relative; display: inline-block; padding: 0 .08em; }
.rh-under::before {
  content: ""; position: absolute; inset: 68% -.03em 6% -.03em;
  background: var(--znk-yellow); z-index: -1; transform: rotate(-.8deg);
}

.rh-hero-lede {
  /* Restored to the editorial serif (Frank Ruhl Libre) — the
     display-sans + serif pairing was the page's signature voice;
     unifying everything to Heebo killed the literary mood. */
  font-family: var(--serif);
  font-size: clamp(16px, 1.35vw, 20px); line-height: 1.55;
  color: #1C1C1C; max-width: 560px;
}

/* ── Daily reading timer + Start CTA ── */
.rh-daily-timer {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  margin-top: 14px; padding: 14px 16px;
  background: #fff;
  border: 2.5px solid var(--znk-ink);
  border-radius: 16px;
  box-shadow: 5px 5px 0 0 var(--znk-ink);
  max-width: 560px;
}
@media (max-width: 520px) {
  /* Mobile: stack vertically and let the text + remaining-time line span
     the full card width. Donut gauge floats top-right (absolute) so it
     doesn't squeeze the text into a narrow left column.
     User feedback 2026-04-28. */
  .rh-daily-timer {
    grid-template-columns: 1fr;
    padding: 14px 16px;
    position: relative;
  }
  .rh-timer-gauge {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 44px !important;
    height: 44px !important;
  }
  .rh-timer-text {
    /* Reserve space at the start (= physical right in RTL) so the text
       doesn't run under the absolute-positioned gauge. */
    padding-inline-start: 56px;
  }
  .rh-timer-cta {
    grid-column: 1 / -1;
    justify-content: center;
  }
}
.rh-timer-gauge {
  position: relative;
  width: 54px; height: 54px;
  flex-shrink: 0;
}
.rh-timer-svg { width: 100%; height: 100%; }
.rh-timer-inner {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-family: var(--sans);
  color: var(--znk-ink);
  line-height: 1;
}
.rh-timer-inner b { font-size: 18px; font-weight: 900; letter-spacing: -.02em; }
.rh-timer-inner small { font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--znk-muted); margin-top: 2px; }
.rh-timer-text {
  display: flex; flex-direction: column; gap: 2px;
  min-width: 0;
}
.rh-timer-text small {
  font-family: var(--sans);
  font-size: 10px; font-weight: 800; letter-spacing: .14em;
  text-transform: uppercase; color: var(--znk-muted);
}
.rh-timer-text b {
  /* Restored to serif — matches the rest of the editorial hero. */
  font-family: var(--serif);
  font-size: 15px; font-weight: 700; line-height: 1.25;
  color: var(--znk-ink);
}
.rh-timer-highlight { color: var(--znk-pink); font-weight: 800; }
.rh-timer-cta {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 16px; border-radius: 999px;
  background: var(--znk-pink); color: #fff;
  border: 2px solid var(--znk-ink);
  box-shadow: 3px 3px 0 0 var(--znk-ink);
  font-family: var(--sans); font-weight: 800; font-size: 13px;
  cursor: pointer;
  transition: transform 0.18s, box-shadow 0.18s;
  white-space: nowrap;
}
.rh-timer-cta:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 5px 5px 0 0 var(--znk-ink); }
.rh-timer-cta:active:not(:disabled) { transform: translate(1px, 1px); box-shadow: 1px 1px 0 0 var(--znk-ink); }
.rh-timer-cta:disabled { opacity: 0.5; cursor: not-allowed; }

.rh-hero-meta {
  display: grid; grid-template-columns: repeat(4, auto); gap: 22px;
  margin-top: 8px; border-top: 2px solid var(--znk-ink); padding-top: 16px;
  font-weight: 700;
}
@media (max-width: 560px) { .rh-hero-meta { grid-template-columns: repeat(2, 1fr); gap: 16px; } }
.rh-hero-meta > div { display: flex; flex-direction: column; gap: 2px; }
.rh-hero-meta .big { font-size: 24px; font-weight: 900; letter-spacing: -.02em; line-height: 1; }
.rh-hero-meta .lbl { text-transform: uppercase; letter-spacing: .16em; color: var(--znk-muted); font-size: 10px; margin-top: 4px; }

.rh-hero-right {
  background: var(--znk-navy); position: relative; overflow: hidden;
  border-inline-start: 3px solid var(--znk-ink);
}
@media (max-width: 880px) { .rh-hero-right { min-height: 320px; border-inline-start: 0; border-top: 3px solid var(--znk-ink); } }
.rh-hero-right::before {
  content: ""; position: absolute; inset: 0;
  background-image: radial-gradient(rgba(255,255,255,.22) 1.3px, transparent 1.4px);
  background-size: 22px 22px;
}
.rh-shape { position: absolute; border: 3px solid var(--znk-ink); }
.rh-circle { width: 56%; aspect-ratio: 1; border-radius: 50%; background: var(--znk-pink); top: -8%; right: -12%; box-shadow: var(--sh-lg); }
.rh-square { width: 46%; aspect-ratio: 1; background: var(--znk-yellow); bottom: -10%; left: -8%; transform: rotate(12deg); box-shadow: var(--sh-lg); }
.rh-dot { width: 48px; height: 48px; border-radius: 50%; background: var(--znk-paper); top: 30%; left: 34%; box-shadow: var(--sh-sm); }
.rh-hero-char {
  position: absolute; bottom: 0; left: 0; z-index: 3;
  width: clamp(480px, 95%, 760px); height: auto; pointer-events: none;
  display: block;
  filter: drop-shadow(8px 8px 0 rgba(0,0,0,.35));
}
.rh-tri { position: absolute; width: 0; height: 0; top: 36%; right: 26%;
  border-left: 54px solid transparent; border-right: 54px solid transparent;
  border-bottom: 92px solid var(--znk-yellow); transform: rotate(24deg);
  filter: drop-shadow(5px 5px 0 var(--znk-ink)); }
.rh-credit {
  position: absolute; left: 20px; bottom: 16px; color: var(--znk-paper);
  font-family: var(--serif); font-size: 11px; letter-spacing: .22em;
  text-transform: uppercase; opacity: .85;
}

/* ═══ TICKER ═══ */
.rh-ticker {
  background: var(--znk-ink); color: var(--znk-paper);
  overflow: hidden; white-space: nowrap; border-bottom: 3px solid var(--znk-ink);
  direction: ltr;
}
.rh-ticker-track {
  display: inline-flex; gap: 36px; padding: 10px 0;
  animation: rh-scroll 36s linear infinite;
  font-weight: 800; font-size: 12px; letter-spacing: .2em; text-transform: uppercase;
}
.rh-ticker-track span { display: inline-flex; align-items: center; gap: 12px; }
.rh-ticker-track i { display: inline-block; width: 10px; height: 10px; background: var(--znk-yellow); }
.rh-ticker-track i.pink { background: var(--znk-pink); }
.rh-ticker-track i.round { border-radius: 50%; }
@keyframes rh-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* ═══ SECTION HEADS ═══ */
.rh-shead {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
  padding-bottom: 18px; border-bottom: 3px solid var(--znk-ink); margin-bottom: 22px;
}
.rh-shead.compact { padding-bottom: 12px; }
.rh-shead h2 { font-weight: 900; font-size: clamp(28px, 3.8vw, 46px); letter-spacing: -.03em; line-height: .98; }
.rh-shead h3.rh-h3 { font-weight: 900; font-size: clamp(20px, 2.4vw, 28px); letter-spacing: -.02em; }
.rh-eyebrow { display: inline-block; font-size: 11px; font-weight: 900; letter-spacing: .26em; text-transform: uppercase; color: var(--znk-pink); margin-bottom: 8px; }
.rh-shead-lede { font-family: var(--serif); font-size: 15px; color: #2A2A2A; margin-top: 8px; max-width: 680px; line-height: 1.55; }

.rh-pill-btn {
  background: var(--znk-ink); color: var(--znk-paper);
  border: 2px solid var(--znk-ink); padding: 10px 18px; font-weight: 900; font-size: 12px;
  letter-spacing: .2em; text-transform: uppercase; box-shadow: var(--sh-sm);
  cursor: pointer; white-space: nowrap;
  transition: transform .15s var(--ease-out), box-shadow .15s var(--ease-out);
  display: inline-flex; align-items: center; gap: 8px; font-family: inherit;
}
.rh-pill-btn:hover { transform: translate(-1px,-1px); box-shadow: 5px 5px 0 0 var(--znk-ink); }
.rh-pill-btn:active { transform: translate(2px,2px); box-shadow: none; }
.rh-pill-btn.ghost { background: transparent; color: var(--znk-ink); box-shadow: none; border-color: var(--znk-ink); padding: 8px 14px; }
.rh-pill-btn.ghost:hover { background: var(--znk-ink); color: var(--znk-paper); }

/* ═══ PERSONAL PICKS ═══ */
.rh-picks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
@media (max-width: 960px) { .rh-picks { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .rh-picks { grid-template-columns: 1fr; } }
.rh-pick {
  background: var(--accent); border: 3px solid var(--znk-ink);
  box-shadow: var(--sh-md); padding: 22px 22px 20px; min-height: 340px;
  display: flex; flex-direction: column; gap: 10px;
  transition: transform .2s var(--ease-out), box-shadow .2s var(--ease-out); cursor: pointer;
  position: relative; overflow: hidden;
}
.rh-pick:hover { transform: translate(-3px,-3px); box-shadow: 10px 10px 0 0 var(--znk-ink); }
.rh-pick-top { display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; }
.rh-pick-num { background: var(--znk-ink); color: var(--znk-paper); padding: 4px 9px; font-weight: 900; }
.rh-pick-topic { background: rgba(247,244,238,.6); padding: 4px 9px; border: 2px solid currentColor; }
.rh-pick h3 { font-family: var(--font-display); font-size: 22px; font-weight: 900; letter-spacing: -.02em; line-height: 1.12; margin-top: 6px; }
.rh-pick-he { font-family: var(--font-display); font-size: 16px; font-weight: 800; opacity: .9; line-height: 1.35; }
.rh-pick-lede { font-family: var(--serif); font-size: 15px; line-height: 1.55; opacity: .94; flex: 1; }
.rh-pick-meta { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; padding-top: 10px; border-top: 2px solid currentColor; }
.rh-pick-level { border: 2px solid currentColor; padding: 3px 9px; font-size: 11.5px; }
.rh-pick-cta {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 10px; margin-top: 10px;
  padding: 14px 20px; border-radius: 999px;
  background: var(--znk-ink); color: var(--znk-paper);
  border: 3px solid var(--znk-ink);
  font-weight: 900; letter-spacing: .18em; text-transform: uppercase; font-size: 14px;
  box-shadow: 5px 5px 0 0 rgba(0,0,0,.45);
  transition: transform .15s var(--ease-out), box-shadow .15s var(--ease-out);
  width: 100%;
}
.rh-pick:hover .rh-pick-cta { transform: translate(-2px,-2px); box-shadow: 7px 7px 0 0 rgba(0,0,0,.55); }
.rh-pick-cta svg { stroke: currentColor; width: 18px; height: 18px; }
.rh-pick-cta .rh-audio { font-size: 16px; }
.rh-pick-img { margin: 2px -22px 4px; height: 120px; overflow: hidden; border-block: 3px solid var(--znk-ink); transition: filter .3s; filter: contrast(1.03) saturate(1.05); }
.rh-pick:hover .rh-pick-img { filter: contrast(1.05) saturate(1.12); }
.rh-pick-img img { width: 100%; height: 100%; object-fit: cover; }
.rh-audio { font-size: 13px; }

/* ═══ CHAPTERS (difficulty) ═══ */
.rh-chapters { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
@media (max-width: 960px) { .rh-chapters { grid-template-columns: repeat(2, 1fr); } }
.rh-chapter {
  background: var(--znk-paper); border: 3px solid var(--znk-ink); box-shadow: var(--sh-md);
  padding: 20px 18px 18px; text-align: start; cursor: pointer; font: inherit; color: inherit;
  display: flex; flex-direction: column; gap: 10px; min-height: 200px;
  transition: transform .2s var(--ease-out), box-shadow .2s var(--ease-out), background .2s;
  position: relative;
}
.rh-chapter:hover { transform: translate(-2px,-2px); box-shadow: 8px 8px 0 0 var(--znk-ink); }
.rh-chapter.on { background: var(--accent); color: var(--accent) === '#0B0B0B' ? var(--znk-paper) : var(--znk-ink); }
.rh-chapter.on { --btn-ink: var(--znk-ink); }
.rh-chapter.on[style*="--accent: #0B0B0B"] { color: var(--znk-paper); }
.rh-chap-top { display: flex; justify-content: space-between; align-items: center; }
.rh-chap-shape { width: 36px; height: 36px; border: 3px solid var(--znk-ink); transition: background .25s var(--ease,ease), border-color .25s var(--ease,ease); }
.rh-chap-shape.s-circle { border-radius: 50%; background: #1040C0; }
.rh-chap-shape.s-square { background: var(--znk-yellow); }
.rh-chap-shape.s-triangle { width: 0; height: 0; border: 0; border-left: 18px solid transparent; border-right: 18px solid transparent; border-bottom: 32px solid var(--znk-pink); filter: drop-shadow(3px 3px 0 var(--znk-ink)); transition: border-bottom-color .25s ease, filter .25s ease; }
.rh-chap-shape.s-square45 { background: var(--znk-ink); transform: rotate(45deg); }
.rh-chap-dots { display: inline-flex; gap: 3px; }
.rh-chap-dots i { width: 10px; height: 10px; border: 2px solid var(--znk-ink); border-radius: 50%; background: transparent; transition: border-color .25s ease, background .25s ease; }
.rh-chap-dots i.f { background: var(--znk-ink); }
.rh-chap-label { font-weight: 900; font-size: 26px; letter-spacing: -.02em; }
.rh-chap-blurb { font-family: var(--serif); font-size: 13px; line-height: 1.45; opacity: .82; }
.rh-chap-progress { display: flex; align-items: center; gap: 10px; margin-top: auto; padding-top: 10px; border-top: 2px solid var(--znk-ink); font-size: 11px; font-weight: 700; transition: border-color .25s ease; }
.rh-chap-progress .bar { flex: 1; height: 6px; background: rgba(0,0,0,.08); border: 2px solid var(--znk-ink); overflow: hidden; transition: border-color .25s ease, background .25s ease; }
.rh-chap-progress .bar > div { height: 100%; background: var(--znk-pink); transition: background .25s ease; }

/* ── Selected (.on) state — invert decorative shapes for visibility ── */
.rh-chapter.on .rh-chap-shape.s-circle   { background: var(--znk-paper); border-color: var(--znk-paper); }
.rh-chapter.on .rh-chap-shape.s-square   { background: var(--znk-ink);   border-color: var(--znk-ink); }
.rh-chapter.on .rh-chap-shape.s-triangle { border-bottom-color: var(--znk-paper); filter: drop-shadow(3px 3px 0 rgba(0,0,0,.55)); }
.rh-chapter.on .rh-chap-shape.s-square45 { background: var(--znk-paper); border-color: var(--znk-paper); }

/* Dots / progress bar contrast on selected backgrounds */
.rh-chapter.on .rh-chap-dots i           { border-color: currentColor; }
.rh-chapter.on .rh-chap-dots i.f         { background: currentColor; }
.rh-chapter.on .rh-chap-progress         { border-top-color: currentColor; }
.rh-chapter.on .rh-chap-progress .bar    { border-color: currentColor; background: rgba(0,0,0,.12); }
.rh-chapter.on .rh-chap-progress .bar > div { background: currentColor; }

/* מומחה (ink bg) → body text was ink → flip to paper */
.rh-chapter.on.is-expert { color: var(--znk-paper); }
.rh-chapter.on.is-expert .rh-chap-progress .bar { background: rgba(255,255,255,.15); }

/* ═══ TOPIC CHIPS ═══ */
.rh-chips { display: flex; flex-wrap: wrap; gap: 10px; }
.rh-chip {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 14px; font-weight: 700; font-size: 13px; border: 2px solid var(--znk-ink);
  background: var(--znk-paper); box-shadow: var(--sh-sm); cursor: pointer; font-family: inherit;
  transition: transform .15s var(--ease-out), box-shadow .15s var(--ease-out), background .15s;
}
.rh-chip:hover { transform: translate(-1px,-1px); box-shadow: 5px 5px 0 0 var(--znk-ink); }
.rh-chip.on { background: var(--znk-pink); color: var(--znk-paper); }
.rh-chip-dot { width: 10px; height: 10px; border: 2px solid var(--znk-ink); border-radius: 50%; flex-shrink: 0; }
.rh-chip-dot.d-0 { background: var(--znk-yellow); }
.rh-chip-dot.d-1 { background: var(--znk-pink); }
.rh-chip-dot.d-2 { background: var(--znk-navy); }
.rh-chip.on .rh-chip-dot { background: var(--znk-paper); border-color: var(--znk-paper); }
.rh-chip-emoji { font-size: 16px; }
.rh-chip-count { font-size: 10px; opacity: .7; background: rgba(0,0,0,.08); padding: 2px 7px; border-radius: 8px; font-weight: 800; }
.rh-chip.on .rh-chip-count { background: rgba(247,244,238,.25); opacity: 1; }

/* ═══ STATUS TABS ═══ */
.rh-tabs { display: inline-flex; border: 3px solid var(--znk-ink); background: var(--znk-paper); box-shadow: var(--sh-md); }
.rh-tabs button {
  padding: 10px 18px; font-weight: 800; font-size: 13px; border: 0; background: transparent;
  cursor: pointer; font-family: inherit; color: var(--znk-ink);
  border-inline-end: 2px solid var(--znk-ink); display: inline-flex; align-items: center; gap: 8px;
  transition: background .15s;
}
.rh-tabs button:last-child { border-inline-end: 0; }
.rh-tabs button[data-on="true"] { background: var(--znk-ink); color: var(--znk-paper); }
.rh-tabs button span { font-weight: 900; font-size: 11px; background: rgba(0,0,0,.08); padding: 2px 7px; }
.rh-tabs button[data-on="true"] span { background: var(--znk-yellow); color: var(--znk-ink); }

/* ═══ COUNT ═══ */
.rh-count { display: flex; justify-content: space-between; align-items: center; font-family: var(--serif); font-size: 14px; }
.rh-count b { font-weight: 900; margin-inline-start: 4px; font-family: var(--font-display); }
.rh-count button { background: transparent; border: 2px solid var(--znk-ink); padding: 5px 12px; font-weight: 800; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; cursor: pointer; font-family: inherit; }
.rh-count button:hover { background: var(--znk-ink); color: var(--znk-paper); }

/* ═══ FEATURED ═══ */
.rh-featured {
  display: grid; grid-template-columns: 1.05fr .95fr;
  border: 3px solid var(--znk-ink); background: var(--znk-paper);
  box-shadow: var(--sh-lg); cursor: pointer;
  transition: transform .2s var(--ease-out), box-shadow .2s var(--ease-out);
  /* No overflow:hidden here — the pink "המלצת העורך" badge peeks above
     the top edge (top: -14px) and needs to be visible. The image side
     (.rh-feat-img) already has its own overflow:hidden to clip images. */
  margin-top: 16px; /* room for the badge overhang */
  position: relative;
}
.rh-featured:hover { transform: translate(-3px,-3px); box-shadow: 14px 14px 0 0 var(--znk-ink); }
@media (max-width: 820px) { .rh-featured { grid-template-columns: 1fr; } }

.rh-feat-img { position: relative; background: var(--znk-navy); min-height: 380px; overflow: hidden; }
.rh-feat-img img { width: 100%; height: 100%; object-fit: cover; transition: filter .3s; filter: contrast(1.05) saturate(1.08); }
.rh-featured:hover .rh-feat-img img { filter: contrast(1.08) saturate(1.15); }
.rh-feat-pattern { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,230,0,.25) 1.5px, transparent 1.6px); background-size: 22px 22px; }
.rh-feat-img::after { content: ""; position: absolute; inset: 0; background: linear-gradient(130deg, rgba(255,230,0,.15), rgba(238,43,115,.18)); mix-blend-mode: multiply; pointer-events: none; }
.rh-feat-badge {
  position: absolute; top: 18px; right: 18px; z-index: 3;
  background: var(--znk-yellow); border: 2px solid var(--znk-ink);
  padding: 6px 10px; font-size: 11px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase;
  box-shadow: var(--sh-sm);
}
.rh-feat-stamp {
  position: absolute; bottom: 18px; left: 18px; z-index: 3;
  width: 88px; height: 88px; border-radius: 50%; border: 3px solid var(--znk-ink);
  background: var(--znk-pink); color: var(--znk-paper);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-weight: 900; transform: rotate(-8deg); box-shadow: var(--sh-md);
}
.rh-feat-stamp .num { font-size: 26px; line-height: 1; }
.rh-feat-stamp .lbl { font-size: 9px; letter-spacing: .22em; margin-top: 3px; }
.rh-feat-body {
  padding: 38px 32px; display: flex; flex-direction: column; justify-content: space-between;
  border-inline-start: 3px solid var(--znk-ink); position: relative;
}
@media (max-width: 820px) { .rh-feat-body { border-inline-start: 0; border-top: 3px solid var(--znk-ink); padding: 28px 20px; } }
.rh-feat-body::before {
  content: "המלצת העורך";
  position: absolute; top: -14px; right: 24px;
  background: var(--znk-pink); color: var(--znk-paper);
  padding: 6px 12px; font-size: 10px; font-weight: 900; letter-spacing: .3em;
  border: 2px solid var(--znk-ink); box-shadow: var(--sh-sm);
}
.rh-feat-tag { font-size: 11px; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; color: var(--znk-pink); margin-top: 4px; }
.rh-feat-title { font-family: var(--font-display); font-weight: 900; font-size: clamp(28px, 3.6vw, 48px); letter-spacing: -.03em; line-height: .98; margin-top: 12px; }
.rh-feat-title-he { font-family: var(--font-display); font-weight: 800; font-size: 18px; color: var(--znk-ink); opacity: .75; margin-top: 6px; }
.rh-feat-lede { font-family: var(--serif); font-size: 16px; line-height: 1.6; color: #1C1C1C; margin-top: 14px; }
.rh-feat-meta { display: flex; gap: 10px; flex-wrap: wrap; border-top: 2px solid var(--znk-ink); padding-top: 14px; margin-top: 20px; font-size: 12px; font-weight: 700; }
.rh-feat-cta { align-self: flex-start; margin-top: 20px; display: inline-flex; align-items: center; gap: 10px;
  background: var(--znk-pink); color: var(--znk-paper); border: 2px solid var(--znk-ink);
  padding: 13px 20px; font-weight: 900; font-size: 13px; letter-spacing: .16em; text-transform: uppercase;
  box-shadow: var(--sh-md); transition: transform .15s, box-shadow .15s; }
.rh-featured:hover .rh-feat-cta { transform: translate(-2px,-2px); box-shadow: 8px 8px 0 0 var(--znk-ink); }

/* ═══ GRID ═══ */
.rh-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
@media (max-width: 1080px) { .rh-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 620px) { .rh-grid { grid-template-columns: 1fr; } }

.rh-loadmore-wrap {
  display: flex; justify-content: center; margin-top: 28px;
}
.rh-loadmore {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 14px 28px;
  background: var(--znk-paper); color: var(--znk-ink);
  border: 3px solid var(--znk-ink); border-radius: 999px;
  box-shadow: 4px 4px 0 0 var(--znk-ink);
  font-family: var(--ff-d); font-weight: 800; font-size: 15px;
  letter-spacing: -0.005em; cursor: pointer;
  transition: transform .15s var(--ease-out), box-shadow .15s var(--ease-out);
}
.rh-loadmore:hover { transform: translate(-1px,-1px); box-shadow: 5px 5px 0 0 var(--znk-ink); background: var(--znk-yellow); }
.rh-loadmore:active { transform: translate(2px,2px); box-shadow: 1px 1px 0 0 var(--znk-ink); }
.rh-loadmore-meta { font-size: 12px; font-weight: 600; opacity: 0.6; }
@media (max-width: 620px) {
  .rh-loadmore { width: 100%; justify-content: center; padding: 14px 18px; }
  .rh-loadmore-meta { display: none; }
}

.rh-card {
  position: relative; background: var(--znk-paper); border: 3px solid var(--znk-ink);
  box-shadow: var(--sh-md); overflow: hidden; cursor: pointer;
  display: flex; flex-direction: column; min-height: 460px;
  transition: transform .2s var(--ease-out), box-shadow .2s var(--ease-out);
}
.rh-card:hover { transform: translate(-3px,-3px); box-shadow: 10px 10px 0 0 var(--znk-ink); }
.rh-card.is-done { opacity: .62; }
.rh-card.is-done:hover { opacity: .95; }
.rh-card-badge {
  position: absolute; top: -3px; right: -3px; width: 32px; height: 32px; z-index: 3;
  border: 3px solid var(--znk-ink);
}
.rh-card-badge.bg-0 { background: var(--znk-yellow); }
.rh-card-badge.bg-1 { background: var(--znk-pink); border-radius: 50%; }
.rh-card-badge.bg-2 { background: var(--znk-navy); transform: rotate(45deg); top: 10px; right: 10px; width: 22px; height: 22px; }
.rh-card-media { height: 180px; background: var(--znk-navy); position: relative; border-bottom: 3px solid var(--znk-ink); overflow: hidden; }
.rh-card-media img { width: 100%; height: 100%; object-fit: cover; transition: filter .3s; filter: contrast(1.03) saturate(1.05); }
.rh-card:hover .rh-card-media img { filter: contrast(1.05) saturate(1.12); }
.rh-card-pattern { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,230,0,.22) 1.2px, transparent 1.3px); background-size: 20px 20px; }
.rh-card-topic {
  position: absolute; top: 12px; inset-inline-start: 12px; z-index: 2;
  background: var(--znk-paper); color: var(--znk-ink); border: 2px solid var(--znk-ink);
  padding: 4px 8px; font-size: 10px; font-weight: 900; letter-spacing: .18em; text-transform: uppercase;
  box-shadow: var(--sh-sm);
}
.rh-card-audio {
  position: absolute; bottom: 10px; inset-inline-start: 10px; z-index: 2;
  background: var(--znk-ink); color: var(--znk-paper); padding: 4px 8px;
  font-size: 12px; border: 2px solid var(--znk-ink);
}
.rh-card-done {
  position: absolute; top: 10px; inset-inline-end: 42px; z-index: 2;
  display: flex; align-items: center; gap: 6px;
  background: var(--znk-yellow); color: var(--znk-ink); border: 2px solid var(--znk-ink);
  padding: 4px 10px; font-weight: 900; font-size: 12px; box-shadow: var(--sh-sm);
}
.rh-card-done span { font-size: 14px; }
.rh-card-done em { font-style: normal; font-size: 11px; }
.rh-card-body { padding: 18px 18px 20px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.rh-card h3 { font-family: var(--font-display); font-weight: 900; font-size: 20px; letter-spacing: -.02em; line-height: 1.15;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.rh-card-he { font-family: var(--font-display); font-size: 15px; font-weight: 800; color: var(--znk-ink); opacity: .82; margin-top: 2px; line-height: 1.3; }
.rh-card-lede { font-family: var(--serif); font-size: 14px; line-height: 1.55; color: #2A2A2A;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.rh-card-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 12px; border-top: 2px solid var(--znk-ink); }
.rh-card-level { font-size: 10.5px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; padding: 4px 10px; border: 2px solid var(--znk-ink); }
.rh-card-mins { font-size: 11.5px; font-weight: 700; color: var(--znk-ink); opacity: .7; font-family: var(--serif); }
.rh-card-cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  margin-top: 14px; padding: 12px 16px; border-radius: 999px;
  background: var(--znk-pink); color: var(--znk-paper);
  border: 2.5px solid var(--znk-ink);
  font-weight: 900; font-size: 13px; letter-spacing: .16em; text-transform: uppercase;
  box-shadow: 4px 4px 0 0 var(--znk-ink);
  transition: transform .15s var(--ease-out), box-shadow .15s var(--ease-out);
  width: 100%;
}
.rh-card:hover .rh-card-cta { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 0 var(--znk-ink); }
.rh-card-cta svg { stroke: currentColor; width: 16px; height: 16px; }

/* ═══ EMPTY ═══ */
.rh-empty {
  background: var(--znk-paper); border: 3px dashed var(--znk-ink);
  padding: 48px 24px; text-align: center; margin-top: 24px;
  display: flex; flex-direction: column; align-items: center; gap: 14px;
}
.rh-empty-shape { width: 60px; height: 60px; background: var(--znk-yellow); border: 3px solid var(--znk-ink); transform: rotate(45deg); box-shadow: var(--sh-md); }
.rh-empty h3 { font-size: 24px; font-weight: 900; letter-spacing: -.02em; }
.rh-empty p { font-family: var(--serif); font-size: 15px; color: #2A2A2A; max-width: 400px; }

/* ═══ STATS ═══ */
.rh-stats { background: var(--znk-yellow); border-block: 3px solid var(--znk-ink); position: relative; overflow: hidden; margin-top: 40px; }
.rh-stats-inner {
  max-width: 1280px; margin: 0 auto; padding: 48px 20px;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; position: relative; z-index: 2;
}
.rh-stats-inner::before, .rh-stats-inner::after {
  content: ""; position: absolute; border: 3px solid var(--znk-ink); opacity: .28; z-index: -1;
}
.rh-stats-inner::before { width: 220px; height: 220px; border-radius: 50%; background: var(--znk-pink); top: -90px; right: -60px; }
.rh-stats-inner::after { width: 180px; height: 180px; background: var(--znk-navy); bottom: -70px; left: -40px; transform: rotate(14deg); }
@media (max-width: 780px) { .rh-stats-inner { grid-template-columns: repeat(2, 1fr); } }
.rh-stat { border-inline-start: 3px solid var(--znk-ink); padding: 0 24px; display: flex; flex-direction: column; gap: 6px; }
.rh-stat:first-child { border-inline-start: 0; padding-inline-start: 0; }
@media (max-width: 780px) {
  .rh-stat:nth-child(odd) { border-inline-start: 0; padding-inline-start: 0; }
  .rh-stat { padding: 18px; border-bottom: 3px solid var(--znk-ink); }
  .rh-stat:nth-last-child(-n+2) { border-bottom: 0; }
}
.rh-stat b { font-size: clamp(36px, 5vw, 60px); font-weight: 900; letter-spacing: -.03em; line-height: 1; }
.rh-stat span { font-size: 11px; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; margin-top: 6px; }
.rh-stat .sh { position: relative; width: 22px; height: 22px; border: 2px solid var(--znk-ink); margin-top: 10px; }
.rh-stat:nth-child(1) .sh { border-radius: 50%; background: var(--znk-pink); }
.rh-stat:nth-child(2) .sh { background: var(--znk-navy); transform: rotate(45deg); }
.rh-stat:nth-child(3) .sh { background: var(--znk-paper); border-radius: 50%; }
.rh-stat:nth-child(4) .sh { background: var(--znk-ink); }

/* ═══ FINAL CTA ═══ */
.rh-cta {
  background: var(--znk-ink); color: var(--znk-paper);
  padding: 72px 20px 80px; text-align: center; position: relative; overflow: hidden;
}
.rh-cta h3 { font-size: clamp(36px, 5.5vw, 82px); font-weight: 900; letter-spacing: -.04em; line-height: .92; }
.rh-cta h3 span { color: var(--znk-yellow); }
.rh-cta p { font-family: var(--serif); margin-top: 16px; font-size: 16px; color: #D8D3C8; max-width: 600px; margin-inline: auto; line-height: 1.5; }
.rh-cta .deco { position: absolute; border: 3px solid var(--znk-paper); opacity: .22; }
.rh-cta .deco.c { width: 340px; height: 340px; border-radius: 50%; top: -130px; left: -110px; background: var(--znk-pink); }
.rh-cta .deco.s { width: 240px; height: 240px; bottom: -80px; right: -60px; background: var(--znk-navy); transform: rotate(18deg); opacity: .55; }
.rh-bigbtn {
  margin-top: 30px; background: var(--znk-yellow); color: var(--znk-ink);
  border: 3px solid var(--znk-paper); padding: 18px 34px;
  font-size: 15px; letter-spacing: .22em; text-transform: uppercase; font-weight: 900;
  box-shadow: 10px 10px 0 var(--znk-pink); cursor: pointer;
  transition: transform .2s, box-shadow .2s; display: inline-flex; align-items: center; gap: 12px;
  font-family: inherit;
}
.rh-bigbtn:hover { transform: translate(-3px,-3px); box-shadow: 14px 14px 0 var(--znk-pink); }
.rh-bigbtn:active { transform: translate(3px,3px); box-shadow: none; }
`
