#!/usr/bin/env node
/**
 * Import associations into the Cloudflare D1 database via the Worker API.
 *
 * Sources:
 *   1. words.json — original associations (727 words with `association` field)
 *   2. generated-associations.json — AI-generated associations from Claude API
 *
 * Usage:
 *   node scripts/import-associations.mjs \
 *     --admin-token=<TOKEN> \
 *     --worker-url=https://znk-associations.<account>.workers.dev
 *
 * Options:
 *   --admin-token   Required. The ADMIN_TOKEN secret set on the Worker.
 *   --worker-url    Required. The Worker URL.
 *   --dry-run       Preview what would be imported without sending.
 *   --batch-size    Records per API call (default: 100).
 */

import { readFileSync, existsSync } from 'fs'

// ── Parse CLI args ──────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [key, ...rest] = a.replace(/^--/, '').split('=')
      return [key, rest.join('=') || 'true']
    })
)

const ADMIN_TOKEN = args['admin-token']
const WORKER_URL = args['worker-url']?.replace(/\/$/, '')
const DRY_RUN = args['dry-run'] === 'true'
const BATCH_SIZE = parseInt(args['batch-size'] || '100', 10)

if (!ADMIN_TOKEN || !WORKER_URL) {
  console.error('Usage: node scripts/import-associations.mjs --admin-token=<TOKEN> --worker-url=<URL>')
  console.error('  --admin-token   Required. The ADMIN_TOKEN secret on the Worker.')
  console.error('  --worker-url    Required. The Worker URL (e.g. https://znk-associations.xxx.workers.dev)')
  console.error('  --dry-run       Preview without sending.')
  console.error('  --batch-size    Records per batch (default: 100)')
  process.exit(1)
}

// ── Load data ───────────────────────────────────────────────────
const WORDS_PATH = 'src/data/vocabulary/words.json'
const GENERATED_PATH = 'scripts/generated-associations.json'

const words = JSON.parse(readFileSync(WORDS_PATH, 'utf-8'))
console.log(`Loaded ${words.length} words from ${WORDS_PATH}`)

// Source 1: Original associations from words.json
const originals = words
  .filter(w => w.association && w.association.trim())
  .map(w => ({
    wordId: w.id,
    english: w.english,
    text: w.association.trim(),
    source: 'original',
  }))
console.log(`Original associations: ${originals.length}`)

// Source 2: AI-generated associations
let aiGenerated = []
if (existsSync(GENERATED_PATH)) {
  const raw = JSON.parse(readFileSync(GENERATED_PATH, 'utf-8'))
  aiGenerated = Object.values(raw)
    .filter(item => item.association && item.association.trim())
    .map(item => ({
      wordId: item.id,
      english: item.english,
      text: item.association.trim(),
      source: 'ai',
    }))
  console.log(`AI-generated associations: ${aiGenerated.length}`)
} else {
  console.log(`No generated associations file found at ${GENERATED_PATH} — skipping AI import`)
}

const allAssociations = [...originals, ...aiGenerated]
console.log(`Total to import: ${allAssociations.length}`)

if (DRY_RUN) {
  console.log('\n[DRY RUN] Would import:')
  console.log(`  Original: ${originals.length}`)
  console.log(`  AI: ${aiGenerated.length}`)
  console.log('\nSample (first 5):')
  allAssociations.slice(0, 5).forEach(a => {
    console.log(`  [${a.source}] ${a.english} (id:${a.wordId}): ${a.text.slice(0, 60)}...`)
  })
  process.exit(0)
}

// ── Import in batches ───────────────────────────────────────────
const batches = []
for (let i = 0; i < allAssociations.length; i += BATCH_SIZE) {
  batches.push(allAssociations.slice(i, i + BATCH_SIZE))
}

console.log(`\nImporting in ${batches.length} batches of ${BATCH_SIZE}...`)

let totalImported = 0
let totalSkipped = 0
let totalErrors = 0

for (let i = 0; i < batches.length; i++) {
  const batch = batches[i]
  const batchNum = i + 1

  try {
    const res = await fetch(`${WORKER_URL}/admin/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify({ associations: batch }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`  [${batchNum}/${batches.length}] HTTP ${res.status}: ${text.slice(0, 200)}`)
      totalErrors += batch.length
      continue
    }

    const result = await res.json()
    const imported = result.data?.imported || 0
    const skipped = result.data?.skipped || 0
    const errors = result.data?.errors || 0

    totalImported += imported
    totalSkipped += skipped
    totalErrors += errors

    console.log(`  [${batchNum}/${batches.length}] imported: ${imported}, skipped: ${skipped}, errors: ${errors}`)
  } catch (error) {
    console.error(`  [${batchNum}/${batches.length}] Network error: ${error.message}`)
    totalErrors += batch.length
  }

  // Small delay between batches
  if (i < batches.length - 1) {
    await new Promise(r => setTimeout(r, 200))
  }
}

console.log(`\n=== Import Complete ===`)
console.log(`Imported: ${totalImported}`)
console.log(`Skipped (duplicates): ${totalSkipped}`)
console.log(`Errors: ${totalErrors}`)
console.log(`Total: ${allAssociations.length}`)
