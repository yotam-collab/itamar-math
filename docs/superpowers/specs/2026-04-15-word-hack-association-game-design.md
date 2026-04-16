# WORD HACK — משחק אסוציאציות קהילתי

## סקירה

משחק חדש בשם **WORD HACK** שבו תלמידים נחשפים לאסוציאציות לזכירת מילים באנגלית, מדרגים אותן, יוצרים אסוציאציות משלהם, ורואים אסוציאציות של תלמידים אחרים.

### מטרות
1. **מעורבות** — תלמידים יוצרים תוכן, מדרגים, ורואים תוכן של אחרים
2. **העשרת מאגר** — כל מילה מקבלת מספר אסוציאציות (AI + קהילה), הטובות ביותר מקודמות לשאר התרגולים
3. **תרגול אוצר מילים** — שלב 3 (בוחן) מוודא שהתלמיד באמת למד

### מספרים
- 2,055 מילים בסה"כ
- 727 מילים עם אסוציאציה מקורית (35%)
- 1,328 מילים חסרות אסוציאציה — ייוצרו ע"י Claude API

---

## זרימת משחק — 3 שלבים

סט = 10 מילים. כל הסט עובר שלב 1, אח"כ כולו שלב 2, ואז כולו שלב 3. משך: ~3-4 דקות.

### שלב 1: הצצה (Discovery)

**מטרה:** חשיפה ראשונית למילה + אסוציאציה. קריאה בלבד, ללא לחץ.

**מסך:**
- מילה באנגלית + תרגום עברי
- **תמונה גדולה** (DALL-E 3, 130×90px)
- כרטיס אסוציאציה עם highlight של הקשר הצלילי (bold צהוב)
- תגית "מקורית" / "AI" / שם תלמיד
- משפט לדוגמה (אנגלית + עברית)
- כפתור "הבנתי ←"

**XP:** +5 לכל מילה

**בחירת אסוציאציה להצגה:** האסוציאציה עם הדירוג הגבוה ביותר. אם קיימת אסוציאציה מקורית — היא תמיד מוצגת ראשונה.

### שלב 2: דרג + צור (Rate & Create)

**מטרה:** מעורבות פעילה — התלמיד שופט ויוצר.

**מסך:**
- מילה + **תמונה קטנה** (44×44px ליד המילה, כתזכורת ויזואלית)
- כרטיס אסוציאציה + דירוג 1-5 כוכבים
- "הכי פופולרי בקהילה" — האסוציאציה בעלת הדירוג הגבוה ביותר מבין כל האסוציאציות (כולל AI וקהילה), עם שם התורם + דירוג
- כפתור "יש לך רעיון טוב יותר?" → פתיחת textarea להוספת אסוציאציה

**XP:** +5 לדירוג, +10 אם גם יצר אסוציאציה

**דירוג:** 1-5 כוכבים. נשמר ב-D1 כצמד (userId, associationId, rating).

### שלב 3: בוחן (Quiz)

**מטרה:** בדיקת שליפה — האם התלמיד באמת זוכר?

**מסך:**
- מילה באנגלית בלבד (ללא תרגום, ללא תמונה)
- 4 אפשרויות תרגום (1 נכונה + 3 מסיחים מאותה יחידה)
- שני כפתורי רמז:
  - "💡 אסוציאציה" — מציג את האסוציאציה, עולה 5 XP
  - "🖼️ תמונה" — מציג את התמונה, עולה 3 XP
- טיימר + XP indicator

**XP:**
- תשובה נכונה ללא רמז: +15
- תשובה נכונה עם רמז תמונה: +12
- תשובה נכונה עם רמז אסוציאציה: +10
- תשובה נכונה עם שני הרמזים: +7
- תשובה שגויה: 0

**מסיחים:** נבחרים מאותה יחידת מילים (unit), כדי להיות סבירים אבל לא קלים מדי.

### מסך סיום

משתמש ב-`GameResultScreen` הקיים עם תוספת:
- "אסוציאציות שיצרת: X" (אם יצר)
- "אסוציאציות שדירגת: Y"
- מעבר אוטומטי למשימה הבאה (הפיצ'ר שכבר מומש)

---

## ארכיטקטורה

### Backend: Cloudflare Worker + D1

Worker חדש: `cloudflare-associations-worker`

**למה D1 ולא KV:**
- צריך queries מורכבים (JOIN, ORDER BY rating, GROUP BY word)
- נתונים רלציוניים (מילים ↔ אסוציאציות ↔ דירוגים)
- D1 בחינם עד 5GB + 5M reads/day

### D1 Schema

```sql
-- אסוציאציות
CREATE TABLE associations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id INTEGER NOT NULL,           -- ID מ-words.json
  english TEXT NOT NULL,              -- המילה באנגלית (לנוחות)
  text TEXT NOT NULL,                 -- טקסט האסוציאציה
  source TEXT NOT NULL,               -- 'original' | 'ai' | 'student'
  author_id TEXT,                     -- null עבור original/ai, student ID עבור student
  author_name TEXT,                   -- שם תצוגה (nullable)
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'pending_review' | 'rejected' | 'promoted'
  avg_rating REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(word_id, text)               -- מונע כפילויות
);

-- דירוגים
CREATE TABLE ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  association_id INTEGER NOT NULL REFERENCES associations(id),
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(association_id, user_id)     -- דירוג אחד לכל זוג
);

-- אינדקסים
CREATE INDEX idx_assoc_word ON associations(word_id, status);
CREATE INDEX idx_assoc_status ON associations(status, avg_rating DESC);
CREATE INDEX idx_ratings_assoc ON ratings(association_id);
```

### API Endpoints

```
GET  /associations/:wordId
  → מחזיר את כל האסוציאציות הפעילות למילה, ממוינות לפי דירוג
  → אסוציאציות original תמיד ראשונות
  Response: { associations: Association[], originalId: number | null }

GET  /associations/batch?ids=1,2,3,...
  → bulk fetch עבור 10 מילים בסט (שלב 1 טוען הכל מראש)
  Response: { [wordId]: { associations: Association[], originalId: number | null } }

POST /associations
  → יצירת אסוציאציה חדשה ע"י תלמיד
  Body: { wordId, text, authorId, authorName }
  → עוברת סינון תוכן אוטומטי
  → אם עוברת: status = 'active'
  → אם חשודה: status = 'pending_review'
  Response: { association: Association, moderation: 'approved' | 'flagged' }

POST /ratings
  → דירוג אסוציאציה
  Body: { associationId, userId, rating }
  → מעדכן avg_rating ו-rating_count באופן אטומי
  Response: { success: true, newAvg: number, newCount: number }

GET  /promoted
  → רשימת כל האסוציאציות שעברו סף קידום (לשימוש בשאר התרגולים)
  → סף: rating_count >= 10 AND avg_rating >= 3.5
  → לא כולל original (אלה תמיד מוצגות)
  Response: { promoted: { wordId: string, text: string }[] }

POST /admin/import
  → ייבוא אסוציאציות (original + AI-generated) ע"י admin
  Body: { associations: { wordId, text, source }[] }
  Headers: Authorization: Bearer <ADMIN_TOKEN>
```

### Client-Side Integration

**חדש:**
- `src/features/vocabulary/games/WordHackMode.tsx` — קומפוננטת המשחק הראשית
- `src/services/associationApi.ts` — service layer לתקשורת עם Worker
- `src/features/vocabulary/games/components/WordHackPhase1.tsx` — שלב הצצה
- `src/features/vocabulary/games/components/WordHackPhase2.tsx` — שלב דירוג
- `src/features/vocabulary/games/components/WordHackPhase3.tsx` — שלב בוחן

**שינויים בקיים:**
- `src/features/vocabulary/games/types.ts` — הוספת `'wordHack'` ל-GameId
- `src/features/vocabulary/GameRouter.tsx` — הוספת route למשחק
- `src/services/mockCoachData.ts` — הוספת mission type `'vocab_wordhack'`
- קומפוננטות תרגול קיימות (FlashcardsMode, LearnMode וכו') — שימוש באסוציאציות מקודמות (promoted) בנוסף למקוריות

**Cache strategy:**
- `GET /associations/batch` נשמר ב-localStorage עם TTL של 24 שעות
- `GET /promoted` נשמר ב-localStorage עם TTL של 12 שעות
- דירוגים נשלחים מיד (fire-and-forget)

---

## ייצור אסוציאציות — Claude API

### תהליך
1. לימוד סגנון מ-727 אסוציאציות קיימות
2. ייצור אסוציאציה לכל אחת מ-1,328 מילים חסרות
3. ייבוא ל-D1 עם `source = 'ai'`

### סגנון זינוק (נלמד מהדוגמאות הקיימות)
- מבוסס **צליל**: מילה באנגלית נשמעת כמו ביטוי בעברית
- **הומוריסטי**: סיטואציה מצחיקה או אבסורדית
- **קצר**: 1-2 משפטים מקסימום
- **הקשר ברור**: הדגשת הקשר צלילי בין המילה לאסוציאציה

### Script: `scripts/generate-associations.ts`

```
Input:  words.json (1,328 מילים ללא אסוציאציה)
Output: generated-associations.json
API:    Claude API (claude-sonnet-4-20250514)
Cost:   ~$2-5 (batch of 1,328 words, ~50 tokens per association)
```

**Prompt strategy:**
- Few-shot: 10 דוגמאות מהאסוציאציות הקיימות
- Constraint: עברית בלבד, מבוסס צליל, הומוריסטי, 1-2 משפטים
- Batch: 20 מילים per request (לחסוך latency)

### ייבוא
אחרי ייצור — סקריפט `scripts/import-associations.ts` שולח ל-Worker endpoint `POST /admin/import`.

---

## מנגנון קידום (Promotion)

### כלל קידום
אסוציאציה (AI או student) מקודמת לשאר התרגולים כאשר:
- `rating_count >= 10` (מספיק דגימה)
- `avg_rating >= 3.5` (איכות מספקת)

### מה קורה בקידום
- השדה `status` משתנה ל-`'promoted'`
- ה-endpoint `GET /promoted` מחזיר אותה
- הקליינט שומר את הרשימה ב-localStorage (TTL 12h)
- קומפוננטות תרגול קיימות (FlashcardsMode, LearnMode, AdaptivePractice) מציגות אותה לצד/במקום שדה `association` מ-words.json (למילים שאין להן אסוציאציה מקורית)

### אסוציאציות מקוריות — מוגנות
- 727 אסוציאציות שכבר קיימות ב-words.json מיובאות ל-D1 עם `source = 'original'`
- אסוציאציה מקורית **תמיד** מוצגת בכל התרגולים — לא ניתן להחליף, לדרג או למחוק אותה
- במשחק WORD HACK: מוצגת ראשונה בשלב 1, עם תגית "מקורית"
- אסוציאציות מקודמות **מתווספות** לצד המקורית, לא מחליפות אותה

---

## סינון תוכן (Content Moderation)

### גישה: שכבה כפולה

**שכבה 1 — Client-side (מיידי):**
- רשימת מילים אסורות בעברית ובאנגלית (גזענות, מיניות, אלימות)
- ~200 מילים/ביטויים
- בדיקה לפני שליחה לשרת
- אם נמצא: הודעת שגיאה ידידותית, לא שולח לשרת

**שכבה 2 — Server-side (Worker):**
- אותה רשימת מילים (redundancy)
- Pattern matching: ביטויים חלקיים, החלפות אותיות (l33t speak)
- אם חשוד: `status = 'pending_review'` (לא מוצג לתלמידים אחרים עד אישור)
- אם ברור שפוגעני: `status = 'rejected'`
- Log לטבלת `moderation_log` (לניתוח עתידי)

**מה לא חוסמים:**
- הומור תמים (בדיחות, אבסורד)
- שגיאות כתיב
- אסוציאציות "חלשות" — אלה יקבלו דירוג נמוך באופן טבעי

### טבלת moderation (D1)

```sql
CREATE TABLE moderation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  association_id INTEGER REFERENCES associations(id),
  action TEXT NOT NULL,         -- 'auto_approved' | 'auto_rejected' | 'flagged'
  reason TEXT,                  -- 'profanity' | 'sexual' | 'racist' | 'violence'
  matched_pattern TEXT,         -- הביטוי שנמצא
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## זיהוי תלמידים (User Identity)

האפליקציה פועלת client-side ללא login. לצורך WORD HACK צריך מזהה יציב:

- **userId:** UUID שנוצר פעם אחת ונשמר ב-localStorage (`znk-user-id`)
- **authorName:** שם התלמיד מ-`studentProfileStore` (למשל "נועם, 10ב")
- לא נדרש login או auth — מזהה אנונימי מספיק

**שם תצוגה:** מוצג ליד אסוציאציות קהילתיות. אם אין שם — "תלמיד אנונימי".

---

## שילוב בתוכנית יומית (Coach)

- Mission type חדש: `vocab_wordhack`
- מיקום בסדר היומי: אחרי flashcards, לפני adaptive
- סדר unlock חדש (משנה את הקיים):
  - flashcards = 1 (ללא שינוי)
  - **wordHack = 2** (חדש)
  - adaptive = 3 (היה 2)
  - learn = 4 (היה 3)
  - gravity = 5 (היה 4)
- זמן משוער: 4 דקות
- Route: `/vocabulary/games/wordHack`
- routeParams: `{ unit: string, count: string }`

---

## סיכום טכני

| רכיב | טכנולוגיה | סטטוס |
|-------|-----------|-------|
| משחק (frontend) | React + TypeScript | חדש |
| Worker API | Cloudflare Worker + D1 | חדש |
| ייצור אסוציאציות | Claude API (Sonnet) | חדש |
| סינון תוכן | Client + Server wordlist | חדש |
| שילוב בתרגולים | עדכון קיימים | שינוי |
| תוכנית יומית | mockCoachData.ts | שינוי |

### עלות
- **Cloudflare:** $0/חודש (Free tier מספיק ל-500 תלמידים)
- **ייצור אסוציאציות:** ~$2-5 חד-פעמי (Claude API)
- **סה"כ שוטף:** $0

---

## מצב ראשוני ו-edge cases

### אחרי ייבוא ראשוני
- כל 2,055 מילים יקבלו לפחות אסוציאציה אחת (727 original + 1,328 AI)
- לא יהיו מילים ללא אסוציאציה במשחק

### תמונות חסרות
- ייצור תמונות DALL-E 3 עדיין פעיל (~370/2,055 מוכנות)
- אם אין תמונה למילה: שלב 1 מציג ללא תמונה (המסך עדיין עובד)
- שלב 2: לא מציג thumbnail
- שלב 3: כפתור רמז "🖼️ תמונה" מוחבא

### Worker לא זמין (offline/error)
- המשחק פועל עם fallback ל-words.json (שדה `association`)
- דירוגים ואסוציאציות חדשות נשמרים ב-localStorage ונשלחים ב-retry כשהWorker חוזר
