#!/usr/bin/env node
/**
 * Generate Hebrew sound-based associations for vocabulary words using Claude API.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/generate-associations.mjs
 *
 * Output: scripts/generated-associations.json
 * Progress: resumes from last checkpoint automatically
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const BATCH_SIZE = 20
const MODEL = 'claude-sonnet-4-20250514'
const OUTPUT_FILE = 'scripts/generated-associations.json'

// Load words
const words = JSON.parse(readFileSync('src/data/vocabulary/words.json', 'utf-8'))
const withAssoc = words.filter(w => w.association && w.association.trim())
const noAssoc = words.filter(w => !w.association || !w.association.trim())

console.log(`Total words: ${words.length}`)
console.log(`With association: ${withAssoc.length}`)
console.log(`Need generation: ${noAssoc.length}`)

// Resume from checkpoint
let results = {}
if (existsSync(OUTPUT_FILE)) {
  results = JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8'))
  console.log(`Resuming: ${Object.keys(results).length} already generated`)
}

const remaining = noAssoc.filter(w => !results[w.id])
console.log(`Remaining: ${remaining.length}`)

if (remaining.length === 0) {
  console.log('All done!')
  process.exit(0)
}

// Few-shot examples from existing associations
const examples = [
  { en: 'abandon', he: 'לנטוש', assoc: 'פעם כולם שמו בנדנה (אה-בנדנה - a-bandon), ועכשיו נטשו את הפריט הטיפשי הזה.' },
  { en: 'durable', he: 'מתמשך, בר-קיימא', assoc: 'השפן של דורסל יכול להמשיך שעות על שעות. הוא דוראבל! הוא עמיד!' },
  { en: 'heredity', he: 'תורשה', assoc: 'למה הוא ג\'ינג\'י ואיטי? הוא ירש את זה מאבא שלו! שגם הוא- ג\'ינג\'י איטי- he-red-ity- הוא-אדום-ואיטי.' },
  { en: 'reluctant', he: 'מסוייג', assoc: 'כשאני מקבל צו מילואים- לא בא לי לראות שוב אוהל! (Re-look-tant) רה-לוק טנט? שוב לראות אוהל? איזה באסה!' },
  { en: 'irrigation', he: 'השקייה', assoc: 'דמיינו אירי שיכור רץ בשדות ומשקה אותם (אירי- irri).' },
  { en: 'cancel', he: 'לבטל', assoc: 'זה כן סל (can-cel) או לא סל? בסוף השופט ביטל את הסל!' },
  { en: 'expand', he: 'להתרחב', assoc: 'צריך להוציא כסף (spend) על התרחבות. דוכן פלאפל רוצה להתרחב? צריך עוד כסף (ספנד- אקספנד).' },
  { en: 'shortage', he: 'מחסור', assoc: 'מהמילה short, אני "קצר" במזומנים... אני במחסור.' },
  { en: 'yield', he: 'להיכנע', assoc: 'yield נשמע כמו ילד! ילד קטן תמיד נכנע ומוותר — "אוקיי אמא, את צודקת!"' },
  { en: 'hostile', he: 'עוין', assoc: 'hostile נשמע כמו הוסטל! ישנתם בהוסטל עם 20 זרים נוחרים? עכשיו אתם מבינים מה זה עוין!' },
]

const SYSTEM_PROMPT = `אתה מומחה ביצירת אסוציאציות צליליות בעברית לזכירת מילים באנגלית, בסגנון של אפליקציית "זינוק" להכנה לפסיכומטרי.

הכללים:
1. האסוציאציה חייבת להיות בעברית
2. מבוססת על צליל: המילה באנגלית נשמעת כמו מילה/ביטוי בעברית
3. הומוריסטית: סיטואציה מצחיקה, אבסורדית, או קלילה שקל לזכור
4. קצרה: 1-2 משפטים מקסימום
5. הקשר ברור: הדגש את החלק שנשמע דומה
6. מתאימה לתלמידי תיכון ישראלים (גילאי 16-18)
7. ללא תוכן פוגעני, גזעני, או מיני

טיפים:
- חפש הברות שנשמעות כמו מילים בעברית
- השתמש בשמות ישראליים נפוצים (דן, בר, נועם, אייל...)
- אפשר לפרק את המילה לחלקים (pre-fix, suf-fix)
- שלב הומור שמתאים לבני נוער ישראלים`

const fewShotText = examples.map(e =>
  `${e.en} (${e.he}) → ${e.assoc}`
).join('\n')

const client = new Anthropic()

async function generateBatch(batch) {
  const wordList = batch.map(w => `- ${w.english} (${w.hebrew})`).join('\n')

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `הנה דוגמאות לאסוציאציות קיימות בסגנון זינוק:\n\n${fewShotText}\n\nעכשיו צור אסוציאציות באותו סגנון עבור המילים הבאות. החזר JSON array בפורמט:\n[{"english": "word", "association": "האסוציאציה"}]\n\nמילים:\n${wordList}`
      }
    ]
  })

  const text = response.content[0].text
  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    console.error('Failed to parse response for batch:', batch.map(w => w.english).join(', '))
    console.error('Response:', text.slice(0, 200))
    return []
  }

  try {
    return JSON.parse(jsonMatch[0])
  } catch (e) {
    console.error('JSON parse error:', e.message)
    console.error('Text:', jsonMatch[0].slice(0, 200))
    return []
  }
}

// Process in batches
const batches = []
for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
  batches.push(remaining.slice(i, i + BATCH_SIZE))
}

console.log(`\nProcessing ${batches.length} batches of ${BATCH_SIZE}...`)
console.log('---')

let successCount = Object.keys(results).length
const startTime = Date.now()

for (let i = 0; i < batches.length; i++) {
  const batch = batches[i]
  const batchNum = i + 1

  try {
    console.log(`[${batchNum}/${batches.length}] Generating ${batch.length} associations...`)
    const generated = await generateBatch(batch)

    // Match generated associations back to word IDs
    for (const item of generated) {
      const word = batch.find(w => w.english.toLowerCase() === item.english?.toLowerCase())
      if (word && item.association) {
        results[word.id] = {
          id: word.id,
          english: word.english,
          hebrew: word.hebrew,
          association: item.association,
          source: 'ai'
        }
        successCount++
      }
    }

    // Save checkpoint
    writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2))

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
    const rate = (successCount / (elapsed || 1) * 60).toFixed(1)
    console.log(`  ✓ ${generated.length} generated (total: ${successCount}/${noAssoc.length}, ${rate}/min)`)

    // Rate limiting: ~1s between batches
    if (i < batches.length - 1) {
      await new Promise(r => setTimeout(r, 1000))
    }
  } catch (error) {
    console.error(`  ✕ Batch ${batchNum} failed:`, error.message)
    if (error.status === 429) {
      console.log('  Rate limited, waiting 30s...')
      await new Promise(r => setTimeout(r, 30000))
      i-- // Retry this batch
    } else {
      // Save what we have and continue
      writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2))
    }
  }
}

console.log(`\n=== Done ===`)
console.log(`Generated: ${successCount}/${noAssoc.length}`)
console.log(`Saved to: ${OUTPUT_FILE}`)
