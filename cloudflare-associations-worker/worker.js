/**
 * ZNK Associations API -- Cloudflare Worker with D1
 * Manages word-association data: CRUD, ratings, moderation, promotion.
 *
 * Environment secrets (set via `wrangler secret put`):
 *   ADMIN_TOKEN -- bearer token for admin endpoints
 *
 * Environment vars (in wrangler.toml):
 *   ALLOWED_ORIGIN -- CORS origin for POST requests
 *
 * D1 Binding (in wrangler.toml):
 *   DB -- D1 database
 *
 * Endpoints:
 *   GET  /associations/:wordId        -- single word's associations
 *   GET  /associations/batch?ids=1,2,3 -- batch fetch (up to 50)
 *   POST /associations                 -- create student association
 *   POST /ratings                      -- rate an association (upsert)
 *   GET  /promoted                     -- all promoted associations
 *   POST /admin/import                 -- bulk import (auth required)
 */

// ── Content moderation ──

const BANNED_WORDS_HE = [
  'זונה', 'שרמוטה', 'מניאק', 'חרא', 'זין', 'כוס', 'תחת', 'חארה',
  'בן זונה', 'בת זונה', 'יא חמור', 'מזדיין', 'מזדיינת', 'זיון',
  'כוסית', 'כוסאח', 'אחושרמוטה', 'יא מניאק', 'טמבל', 'מפגר',
  'ערס', 'פרחה', 'כושי', 'ערבוש', 'אשכנזי מסריח', 'חינזיר',
]

const BANNED_WORDS_EN = [
  'fuck', 'shit', 'bitch', 'ass', 'dick', 'cock', 'pussy', 'whore',
  'slut', 'bastard', 'cunt', 'nigger', 'nigga', 'faggot', 'retard',
  'rape', 'kill', 'murder', 'nazi', 'hitler', 'porn', 'sex',
  'damn', 'crap', 'piss',
]

const LEET_MAP = {
  '@': 'a', '4': 'a',
  '3': 'e',
  '1': 'i', '!': 'i',
  '0': 'o',
  '5': 's', '$': 's',
  '7': 't',
  '8': 'b',
}

function decodeLeet(text) {
  let decoded = text.toLowerCase()
  for (const [leet, char] of Object.entries(LEET_MAP)) {
    decoded = decoded.replaceAll(leet, char)
  }
  return decoded
}

/**
 * Check text against banned words.
 * Returns { flagged, rejected, reason, matchedPattern } or null if clean.
 */
function moderateContent(text) {
  const lower = text.toLowerCase()
  const decoded = decodeLeet(text)

  // Check Hebrew banned words
  for (const word of BANNED_WORDS_HE) {
    if (lower.includes(word)) {
      return { rejected: true, reason: 'offensive_hebrew', matchedPattern: word }
    }
  }

  // Check English banned words (word boundary aware)
  for (const word of BANNED_WORDS_EN) {
    const regex = new RegExp(`\\b${word}\\b`, 'i')
    if (regex.test(lower) || regex.test(decoded)) {
      return { rejected: true, reason: 'offensive_english', matchedPattern: word }
    }
  }

  // Check leet-speak decoded text against English banned words (no word boundary)
  if (decoded !== lower) {
    for (const word of BANNED_WORDS_EN) {
      if (decoded.includes(word)) {
        return { flagged: true, reason: 'possible_leet_speak', matchedPattern: word }
      }
    }
  }

  return null
}

// ── CORS ──

function corsHeaders(origin, allowedOrigin, method) {
  const isGet = method === 'GET'
  const allowed = isGet ||
    origin === allowedOrigin ||
    origin === 'https://staging-ms.znk.co.il' ||
    (origin?.startsWith('http://localhost:') && origin.match(/^http:\/\/localhost:\d{4,5}$/))
  return {
    'Access-Control-Allow-Origin': allowed ? (origin || '*') : allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

// ── Response helpers ──

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

function success(data, headers) {
  return jsonResponse({ success: true, data }, 200, headers)
}

function error(message, status, headers) {
  return jsonResponse({ success: false, error: message }, status, headers)
}

// ── Route matching ──

function matchRoute(path, pattern) {
  const patternParts = pattern.split('/')
  const pathParts = path.split('/')
  if (patternParts.length !== pathParts.length) return null
  const params = {}
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i]
    } else if (patternParts[i] !== pathParts[i]) {
      return null
    }
  }
  return params
}

// ── Handlers ──

async function handleGetAssociations(db, wordId, headers) {
  const id = parseInt(wordId, 10)
  if (isNaN(id) || id < 1) {
    return error('Invalid word ID', 400, headers)
  }

  const { results } = await db.prepare(`
    SELECT id, word_id, english, text, source, author_id, author_name,
           status, avg_rating, rating_count, created_at
    FROM associations
    WHERE word_id = ? AND status IN ('active', 'promoted')
    ORDER BY
      CASE source WHEN 'original' THEN 0 ELSE 1 END,
      avg_rating DESC,
      rating_count DESC
  `).bind(id).all()

  return success(results, headers)
}

async function handleBatchAssociations(db, idsParam, headers) {
  if (!idsParam) {
    return error('Missing ids parameter', 400, headers)
  }

  const ids = idsParam.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
  if (ids.length === 0) {
    return error('No valid IDs provided', 400, headers)
  }
  if (ids.length > 50) {
    return error('Maximum 50 IDs per batch', 400, headers)
  }

  const placeholders = ids.map(() => '?').join(',')
  const { results } = await db.prepare(`
    SELECT id, word_id, english, text, source, author_id, author_name,
           status, avg_rating, rating_count, created_at
    FROM associations
    WHERE word_id IN (${placeholders}) AND status IN ('active', 'promoted')
    ORDER BY
      word_id,
      CASE source WHEN 'original' THEN 0 ELSE 1 END,
      avg_rating DESC,
      rating_count DESC
  `).bind(...ids).all()

  // Group by word_id
  const grouped = {}
  for (const row of results) {
    if (!grouped[row.word_id]) grouped[row.word_id] = []
    grouped[row.word_id].push(row)
  }

  return success(grouped, headers)
}

async function handleCreateAssociation(db, body, headers) {
  const { wordId, english, text, authorId, authorName } = body || {}

  if (!wordId || !english || !text) {
    return error('Missing required fields: wordId, english, text', 400, headers)
  }
  if (typeof text !== 'string' || text.length > 500) {
    return error('Text must be a string under 500 characters', 400, headers)
  }

  // Content moderation
  const modResult = moderateContent(text)
  let status = 'active'
  const source = 'student'

  if (modResult) {
    if (modResult.rejected) {
      status = 'rejected'
    } else if (modResult.flagged) {
      status = 'pending_review'
    }
  }

  try {
    const result = await db.prepare(`
      INSERT INTO associations (word_id, english, text, source, author_id, author_name, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      wordId, english, text.trim(), source,
      authorId || null, authorName || null, status
    ).run()

    const associationId = result.meta.last_row_id

    // Log moderation action if flagged or rejected
    if (modResult) {
      await db.prepare(`
        INSERT INTO moderation_log (association_id, action, reason, matched_pattern)
        VALUES (?, ?, ?, ?)
      `).bind(
        associationId,
        modResult.rejected ? 'auto_rejected' : 'auto_flagged',
        modResult.reason,
        modResult.matchedPattern
      ).run()
    }

    if (status === 'rejected') {
      return error('Content not allowed', 422, headers)
    }

    return success({
      id: associationId,
      status,
      moderated: status === 'pending_review',
    }, headers)
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return error('This association already exists for this word', 409, headers)
    }
    throw err
  }
}

async function handleRating(db, body, headers) {
  const { associationId, userId, rating } = body || {}

  if (!associationId || !userId || rating == null) {
    return error('Missing required fields: associationId, userId, rating', 400, headers)
  }
  if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return error('Rating must be an integer between 1 and 5', 400, headers)
  }

  // Check association exists
  const assoc = await db.prepare('SELECT id, status FROM associations WHERE id = ?')
    .bind(associationId).first()
  if (!assoc) {
    return error('Association not found', 404, headers)
  }

  // Upsert rating
  await db.prepare(`
    INSERT INTO ratings (association_id, user_id, rating)
    VALUES (?, ?, ?)
    ON CONFLICT(association_id, user_id)
    DO UPDATE SET rating = excluded.rating, created_at = datetime('now')
  `).bind(associationId, userId, rating).run()

  // Recalculate average
  await db.prepare(`
    UPDATE associations SET
      avg_rating = (SELECT AVG(rating) FROM ratings WHERE association_id = ?),
      rating_count = (SELECT COUNT(*) FROM ratings WHERE association_id = ?)
    WHERE id = ?
  `).bind(associationId, associationId, associationId).run()

  // Check promotion
  await db.prepare(`
    UPDATE associations SET status = 'promoted'
    WHERE id = ? AND status = 'active' AND source != 'original'
    AND rating_count >= 10 AND avg_rating >= 3.5
  `).bind(associationId).run()

  // Return updated association
  const updated = await db.prepare(`
    SELECT id, word_id, english, text, source, status, avg_rating, rating_count
    FROM associations WHERE id = ?
  `).bind(associationId).first()

  return success(updated, headers)
}

async function handlePromoted(db, headers) {
  const { results } = await db.prepare(`
    SELECT id, word_id, english, text, source, author_id, author_name,
           status, avg_rating, rating_count, created_at
    FROM associations
    WHERE status = 'promoted'
    ORDER BY avg_rating DESC, rating_count DESC
  `).all()

  return success(results, headers)
}

async function handleAdminImport(db, body, adminToken, authHeader, headers) {
  // Auth check
  if (!adminToken) {
    return error('Admin endpoint not configured', 503, headers)
  }
  if (authHeader !== `Bearer ${adminToken}`) {
    return error('Unauthorized', 401, headers)
  }

  const { associations } = body || {}
  if (!Array.isArray(associations) || associations.length === 0) {
    return error('Body must contain a non-empty associations array', 400, headers)
  }

  let imported = 0
  let skipped = 0
  const errors = []

  for (const item of associations) {
    const { wordId, english, text, source } = item
    if (!wordId || !english || !text || !source) {
      errors.push({ item, reason: 'missing required fields' })
      skipped++
      continue
    }
    try {
      await db.prepare(`
        INSERT INTO associations (word_id, english, text, source, status)
        VALUES (?, ?, ?, ?, 'active')
      `).bind(wordId, english, text.trim(), source).run()
      imported++
    } catch (err) {
      if (err.message?.includes('UNIQUE constraint')) {
        skipped++
      } else {
        errors.push({ item, reason: err.message })
        skipped++
      }
    }
  }

  return success({ imported, skipped, errors: errors.length > 0 ? errors : undefined }, headers)
}

// ── Main handler ──

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN || '*', request.method)

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers })
    }

    const url = new URL(request.url)
    const path = url.pathname

    try {
      // ── GET /associations/batch?ids=1,2,3 ──
      if (path === '/associations/batch' && request.method === 'GET') {
        return await handleBatchAssociations(env.DB, url.searchParams.get('ids'), headers)
      }

      // ── GET /associations/:wordId ──
      const assocParams = matchRoute(path, '/associations/:wordId')
      if (assocParams && request.method === 'GET') {
        return await handleGetAssociations(env.DB, assocParams.wordId, headers)
      }

      // ── POST /associations ──
      if (path === '/associations' && request.method === 'POST') {
        const body = await request.json()
        return await handleCreateAssociation(env.DB, body, headers)
      }

      // ── POST /ratings ──
      if (path === '/ratings' && request.method === 'POST') {
        const body = await request.json()
        return await handleRating(env.DB, body, headers)
      }

      // ── GET /promoted ──
      if (path === '/promoted' && request.method === 'GET') {
        return await handlePromoted(env.DB, headers)
      }

      // ── POST /admin/import ──
      if (path === '/admin/import' && request.method === 'POST') {
        const body = await request.json()
        const authHeader = request.headers.get('Authorization') || ''
        return await handleAdminImport(env.DB, body, env.ADMIN_TOKEN, authHeader, headers)
      }

      return error('Not found', 404, headers)

    } catch (err) {
      return error('Internal error', 500, headers)
    }
  },
}
