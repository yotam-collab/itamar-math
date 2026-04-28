import { useState } from 'react'
import { ModeIntro, shouldShowModeIntro } from './ModeIntro'

/* ═══════════════════════════════════════════════════════════════════
   ExamModeIntro — thin wrapper around ModeIntro for the exam-practice
   pages. Knows the canonical title / icon / accent for each exam mode
   so each practice file just drops in:

     <ExamModeIntro modeId="exam-sc" />

   ...without thinking about props. Plays once per (mode × tab session).
   ═══════════════════════════════════════════════════════════════════ */

type ExamModeId =
  | 'exam-sc'
  | 'exam-restatement'
  | 'exam-rc'
  | 'exam-full'
  | 'exam-practice'
  | 'reading-passage'

interface ExamModeMeta {
  title: string
  subtitle?: string
  icon: string
  accentColor: string
}

const META: Record<ExamModeId, ExamModeMeta> = {
  'exam-sc': {
    title: 'השלמת משפטים',
    subtitle: '8 מתוך 22 שאלות בבחינה',
    icon: '✏️',
    accentColor: '#FFE600',
  },
  'exam-restatement': {
    title: 'ניסוח מחדש',
    subtitle: 'הלקוע בין 120 ל-134',
    icon: '🔄',
    accentColor: '#EE2B73',
  },
  'exam-rc': {
    title: 'הבנת הנקרא',
    subtitle: '10 מתוך 22 שאלות',
    icon: '📖',
    accentColor: '#6B3FA0',
  },
  'exam-full': {
    title: 'פרק בחינה מלא',
    subtitle: '22 שאלות · 20 דקות',
    icon: '🚀',
    accentColor: '#FFE600',
  },
  'exam-practice': {
    /* Surfaced when the student starts the daily "תרגול שאלות" mission —
       a mixed SC + Restatement + RC session driven by the coach plan.
       The brand intro orients them ("yes, this IS your daily questions
       practice — not the full exam") before the first question loads. */
    title: 'תרגול שאלות',
    subtitle: 'מבחר מותאם · השלמה, ניסוח, הבנה',
    icon: '🎯',
    accentColor: '#EE2B73',
  },
  'reading-passage': {
    title: 'קטע קריאה',
    subtitle: 'קריאה בקצב טבעי',
    icon: '📚',
    accentColor: '#10B981',
  },
}

interface ExamModeIntroProps {
  modeId: ExamModeId
}

export function ExamModeIntro({ modeId }: ExamModeIntroProps) {
  // Decide on mount — re-mounts during the same session don't replay.
  const [done, setDone] = useState(() => !shouldShowModeIntro(modeId))
  if (done) return null
  const meta = META[modeId]
  return (
    <ModeIntro
      modeId={modeId}
      title={meta.title}
      subtitle={meta.subtitle}
      icon={meta.icon}
      accentColor={meta.accentColor}
      onComplete={() => setDone(true)}
    />
  )
}
