import type { GameConfig, GameId } from './types'
import { asset } from '../../../utils/assetUrl'
import { g } from '../../../utils/gender'

export const GAME_CONFIGS: Record<GameId, GameConfig> = {
  // === Competitive games ===
  matchSprint: {
    id: 'matchSprint',
    title: 'זינוק מהיר',
    subtitle: 'התאם מילים בקצב שיא! 🏃',
    tooltip: 'מופיעה מילה באנגלית — בחר את התרגום הנכון הכי מהר שאפשר. ככל שמהר יותר — יותר נקודות!',
    icon: asset('znk-icon-04.png'),
    accentColor: '#818CF8',
    category: 'game',
  },
  recallRush: {
    id: 'recallRush',
    title: 'שליפת בזק',
    subtitle: 'שלוף מהזיכרון בזק!',
    tooltip: 'רואים תרגום בעברית — צריך לבחור את המילה הנכונה באנגלית מתוך 4 אפשרויות. אימון הזיכרון הפעיל!',
    icon: asset('znk-icon-06.png'),
    accentColor: '#22D3EE',
    category: 'game',
  },
  contextDetective: {
    id: 'contextDetective',
    title: 'בלש המילים',
    subtitle: 'פצח את המשמעות 🔍',
    tooltip: 'מופיע משפט עם מילה חסרה — בחר את המילה שמתאימה לפי ההקשר. מפתח חשיבה כמו בבחינה!',
    icon: asset('znk-icon-07.png'),
    accentColor: '#38BDF8',
    category: 'game',
  },
  speedReview: {
    id: 'speedReview',
    title: 'סקירת בזק',
    get subtitle() { return g('יודע? לא יודע? קדימה!', 'יודעת? לא יודעת? קדימה!') },
    get tooltip() { return g('מילים עפות על המסך — החלט בשנייה: יודע או לא יודע. מה שלא ידעת חוזר ללמידה!', 'מילים עפות על המסך — החליטי בשנייה: יודעת או לא יודעת. מה שלא ידעת חוזר ללמידה!') },
    icon: asset('znk-icon-12.png'),
    accentColor: '#34D399',
    category: 'game',
  },
  rescueMode: {
    id: 'rescueMode',
    title: 'חילוץ מילים',
    get subtitle() { return g('תציל את המילים! 🦸', 'תצילי את המילים! 🦸') },
    get tooltip() { return g('מילים חלשות נופלות — ענה נכון כדי להציל אותן לפני שנעלמות! מתמקד רק במילים שאתה טועה בהן.', 'מילים חלשות נופלות — עני נכון כדי להציל אותן לפני שנעלמות! מתמקד רק במילים שאת טועה בהן.') },
    icon: asset('znk-icon-16.png'),
    accentColor: '#FBBF24',
    category: 'game',
  },
  // === Practice modes ===
  learnMode: {
    id: 'learnMode',
    title: 'שינון מילים חדשות',
    subtitle: 'מילים חדשות מחכות לך',
    tooltip: 'למידה רגועה — כל מילה מוצגת עם תרגום, משפט לדוגמא, והקראה. שולט בקצב שלך.',
    icon: asset('znk-icon-08.png'),
    accentColor: '#818CF8',
    category: 'practice',
  },
  testMode: {
    id: 'testMode',
    title: 'מבחן ידע',
    get subtitle() { return g('בוא נבדוק מה נשאר 💪', 'בואי נבדוק מה נשאר 💪') },
    get tooltip() { return g('מבחן רציני — שאלות מגוונות על מילים שכבר למדת. בודק כמה באמת נשאר בראש!', 'מבחן רציני — שאלות מגוונות על מילים שכבר למדת. בודק כמה באמת נשאר בראש!') },
    icon: asset('znk-icon-11.png'),
    accentColor: '#FB7185',
    category: 'practice',
  },
  matchPairs: {
    id: 'matchPairs',
    title: 'חיבור זוגות',
    get subtitle() { return g('חבר כל זוג!', 'חברי כל זוג!') },
    get tooltip() { return g('שתי עמודות — אנגלית ועברית. חבר כל מילה לתרגום שלה. מאמן זיכרון וחשיבה מהירה!', 'שתי עמודות — אנגלית ועברית. חברי כל מילה לתרגום שלה. מאמן זיכרון וחשיבה מהירה!') },
    icon: asset('znk-icon-04w.png'),
    accentColor: '#FB923C',
    category: 'practice',
  },
  gravity: {
    id: 'gravity',
    title: 'שליפה מהירה',
    get subtitle() { return g('תתפוס לפני שנופל!', 'תתפסי לפני שנופל!') },
    get tooltip() { return g('מילים נופלות מהשמיים — הקלד את התרגום לפני שהן מגיעות למטה. ככל שמתקדמים — מהר יותר!', 'מילים נופלות מהשמיים — הקלידי את התרגום לפני שהן מגיעות למטה. ככל שמתקדמים — מהר יותר!') },
    icon: asset('znk-icon-10.png'),
    accentColor: '#A78BFA',
    category: 'practice',
  },
  flashcards: {
    id: 'flashcards',
    title: 'כרטיסיות היכרות',
    get subtitle() { return g('הפוך, זכור, הלאה!', 'הפכי, זכרי, הלאה!') },
    tooltip: 'כרטיסיות קלאסיות — צד אחד אנגלית, הפוך לעברית. החלק ימינה אם ידעת, שמאלה אם לא.',
    icon: asset('znk-icon-chart.png'),
    accentColor: '#F472B6',
    category: 'practice',
  },
  adaptivePractice: {
    id: 'adaptivePractice',
    title: 'תרגול אדפטיבי',
    subtitle: 'כל המילים — תרגול מותאם לרמה שלך',
    tooltip: 'המערכת בוחרת את סוג התרגול הכי מתאים לך עכשיו — לפי מה שאתה יודע ומה צריך חיזוק.',
    icon: asset('znk-icon-08.png'),
    accentColor: '#818CF8',
    category: 'practice',
  },
  wordHack: {
    id: 'wordHack',
    title: 'WORD HACK',
    subtitle: 'האקים לזיכרון — טריקים למילים',
    tooltip: 'גלה אסוציאציות מגניבות למילים, דרג את הטובות ביותר ותצור משלך!',
    icon: asset('znk-icon-08.png'),
    accentColor: '#818CF8',
    category: 'practice',
  },
}

/** Original 6 competitive game IDs */
export const ALL_GAME_IDS: GameId[] = [
  'matchSprint',
  'recallRush',
  'contextDetective',
  'speedReview',
  'rescueMode',
]

/** 5 practice mode IDs (excludes adaptivePractice) */
export const ALL_PRACTICE_IDS: GameId[] = [
  'learnMode',
  'testMode',
  'matchPairs',
  'gravity',
  'flashcards',
  'wordHack',
]

// ─── Design tokens ─── Dark immersive study mode ───────────────
export const S: Record<string, string> = {
  // Card shadow — dark mode glow
  card: '0 2px 16px rgba(0,0,0,0.3), 0 0 1px rgba(255,255,255,0.05)',
  cardHover: '0 8px 32px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.08)',
  // Elevated shadow — floating elements
  elevated: '0 16px 48px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2)',
  // Subtle inner glow for inputs
  inner: 'inset 0 2px 6px rgba(0,0,0,0.3)',
  // Button press shadow
  pressed: 'inset 0 2px 8px rgba(0,0,0,0.4)',
  // Legacy compat aliases
  extruded: '0 2px 16px rgba(0,0,0,0.3), 0 0 1px rgba(255,255,255,0.05)',
  extrudedSm: '0 1px 10px rgba(0,0,0,0.25), 0 0 1px rgba(255,255,255,0.04)',
  inset: 'inset 0 2px 6px rgba(0,0,0,0.3)',
  insetDeep: 'inset 0 3px 10px rgba(0,0,0,0.35)',
}

// ─── Dark theme palette ───
export const BG = '#0F0B1E'              // Deep dark purple-black
export const CARD_BG = '#1A1533'          // Dark card surface
export const ACCENT = '#818CF8'           // Indigo-400 (lighter for dark bg)
export const ACCENT_LIGHT = 'rgba(129,140,248,0.12)' // Subtle tint for dark
export const SECONDARY = '#22D3EE'        // Cyan-400
export const TEXT = '#F1F5F9'             // Slate-100 (light text on dark)
export const MUTED = '#94A3B8'            // Slate-400
export const CORRECT = '#4ADE80'          // Green-400
export const WRONG = '#FB7185'            // Rose-400
export const WARNING = '#FBBF24'          // Amber-400

// Brand gradient
export const BRAND_GRADIENT = 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #A855F7 100%)'
export const BRAND_GRADIENT_SOFT = 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)'

// Dark card border
export const CARD_BORDER = '1px solid rgba(255,255,255,0.08)'

// XP values
export const XP_CORRECT_BASE = 10
export const XP_CORRECT_FAST = 15 // answered in <2s
export const XP_WRONG = 2
export const XP_RESCUE_SAVED = 5

// Timer defaults per vocab level
export function getTimerDuration(vocabLevel: number): number {
  if (vocabLevel <= 3) return 90
  if (vocabLevel <= 7) return 75
  return 60
}

export function getQuestionCount(vocabLevel: number): number {
  if (vocabLevel <= 3) return 8
  if (vocabLevel <= 7) return 12
  return 15
}
