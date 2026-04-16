const API_BASE = import.meta.env.VITE_ASSOCIATIONS_API || 'https://znk-associations.amirnet.workers.dev'

const BATCH_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours
const PROMOTED_CACHE_TTL = 12 * 60 * 60 * 1000 // 12 hours

export interface Association {
  id: number
  word_id: number
  english: string
  text: string
  source: 'original' | 'ai' | 'student'
  author_id: string | null
  author_name: string | null
  status: string
  avg_rating: number
  rating_count: number
}

export interface WordAssociations {
  associations: Association[]
  originalId: number | null
}

// ─── Cache helpers ───────────────────────────────────────────

interface CacheEntry<T> {
  data: T
  timestamp: number
}

function readCache<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.timestamp < ttlMs) return entry.data
    localStorage.removeItem(key)
  } catch {
    // Corrupted cache entry — ignore
  }
  return null
}

function writeCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Storage full or unavailable — ignore
  }
}

// ─── User ID ─────────────────────────────────────────────────

/** Get or create a stable anonymous user ID */
export function getUserId(): string {
  let id = localStorage.getItem('znk-user-id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('znk-user-id', id)
  }
  return id
}

// ─── Batch fetch ─────────────────────────────────────────────

/** Batch fetch associations for multiple words. Uses 24h localStorage cache. */
export async function fetchAssociationsBatch(
  wordIds: number[],
): Promise<Record<number, WordAssociations>> {
  const sorted = [...wordIds].sort((a, b) => a - b)
  const cacheKey = `znk-assoc-batch:${sorted.join(',')}`

  const cached = readCache<Record<number, WordAssociations>>(cacheKey, BATCH_CACHE_TTL)
  if (cached) return cached

  try {
    const res = await fetch(`${API_BASE}/associations/batch?ids=${sorted.join(',')}`)
    if (!res.ok) return {}
    const data: Record<number, WordAssociations> = await res.json()
    writeCache(cacheKey, data)
    return data
  } catch {
    // Network error — fallback to words.json handled by caller
    return {}
  }
}

// ─── Ratings ─────────────────────────────────────────────────

/** Rate an association. Fire-and-forget (no await needed). */
export function rateAssociation(associationId: number, userId: string, rating: number): void {
  fetch(`${API_BASE}/ratings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ association_id: associationId, user_id: userId, rating }),
  }).catch(() => {
    // Silent fail — rating is non-critical
  })
}

// ─── Submit association ──────────────────────────────────────

/** Submit a student-created association */
export async function submitAssociation(
  wordId: number,
  english: string,
  text: string,
  authorId: string,
  authorName: string,
): Promise<{ association: Association; moderation: 'approved' | 'flagged' } | null> {
  try {
    const res = await fetch(`${API_BASE}/associations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word_id: wordId,
        english,
        text,
        author_id: authorId,
        author_name: authorName,
      }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ─── Promoted ────────────────────────────────────────────────

/** Get promoted associations (12h cache). Returns map of wordId to association text */
export async function fetchPromoted(): Promise<Record<number, string>> {
  const cacheKey = 'znk-assoc-promoted'

  const cached = readCache<Record<number, string>>(cacheKey, PROMOTED_CACHE_TTL)
  if (cached) return cached

  try {
    const res = await fetch(`${API_BASE}/promoted`)
    if (!res.ok) return {}
    const data: Record<number, string> = await res.json()
    writeCache(cacheKey, data)
    return data
  } catch {
    return {}
  }
}

// ─── Client-side offensive content filter ────────────────────

const BANNED_WORDS = new Set([
  // Hebrew profanity
  'זונה', 'שרמוטה', 'מניאק', 'בן זונה', 'כוס', 'כוסאמק',
  'זין', 'תחת', 'חרא', 'מזדיין', 'מזדיינת', 'לך להזדיין',
  'אחושרמוטה', 'יא מניאק', 'בתחת', 'חארה', 'כלבה',
  'מטומטם', 'מטומטמת', 'אידיוט', 'טמבל', 'דביל',
  // Hebrew racism / hate speech
  'כושי', 'ערס', 'נאצי', 'היטלר', 'שואה',
  // Hebrew sexual content
  'סקס', 'פורנו', 'זיון', 'אונס',
  // Hebrew violence
  'לרצוח', 'לדקור', 'להרוג את', 'פיגוע', 'טרור',
  // English profanity
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'cock', 'pussy',
  'cunt', 'whore', 'slut', 'bastard', 'damn', 'motherfucker',
  // English racism / hate speech
  'nigger', 'nigga', 'faggot', 'retard', 'nazi',
  // English sexual content
  'porn', 'rape', 'blowjob', 'handjob',
  // English violence
  'murder', 'kill yourself', 'kys',
])

/** Client-side offensive content filter. Returns true if text contains banned content. */
export function isOffensive(text: string): boolean {
  const normalized = text.toLowerCase().trim()
  for (const word of BANNED_WORDS) {
    if (normalized.includes(word)) return true
  }
  return false
}
