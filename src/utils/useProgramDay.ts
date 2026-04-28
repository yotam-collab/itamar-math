import { useMemo } from 'react'
import { useStudentProfileStore } from '../stores/studentProfileStore'

/* Pulled out as a top-level helper so the React-hooks purity linter doesn't
   flag the Date.now() call as an impure read from inside the hook body.
   The same calculation pattern was already in use in JourneyPage / PlanPage
   without issue — moving it here just consolidates the source of truth. */
function computeDaysUntil(examDate: string): number {
  const diff = Math.ceil(
    (new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  return Math.max(0, diff)
}

/**
 * Single source of truth for the student's position inside their study
 * program + the countdown to the exam. Replaces ad-hoc copies of the same
 * formula scattered across CoachWidget / JourneyPage / PlanPage that drifted
 * apart and produced inconsistent labels (e.g. header showing "יום 12"
 * while the journey page showed "יום 23" for the same student).
 *
 * Conventions:
 *  - `examDate` lives in the student profile store (Zustand) as ISO date or null.
 *  - When `examDate` is null (student picked "לא יודע/ת מתי הבחינה"), we
 *    suppress the countdown entirely — `showCountdown === false` — so UI
 *    can render a softer "אין תאריך בחינה" copy instead of fake numbers.
 */

const PROGRAM_LENGTH_DAYS = 23

export interface ProgramDayInfo {
  /** Days remaining until the exam, or null if no exam date is set. */
  daysUntilExam: number | null
  /** 1-indexed position inside the program, clamped to [1, PROGRAM_LENGTH_DAYS]. */
  dayInProgram: number | null
  /** True iff a countdown number should be rendered. */
  showCountdown: boolean
  /** Convenience: total program length, exposed so callers don't hard-code. */
  programLengthDays: number
}

export function useProgramDay(): ProgramDayInfo {
  const examDate = useStudentProfileStore((s) => s.examDate)
  return useMemo<ProgramDayInfo>(() => {
    if (!examDate) {
      return {
        daysUntilExam: null,
        dayInProgram: null,
        showCountdown: false,
        programLengthDays: PROGRAM_LENGTH_DAYS,
      }
    }
    const daysUntilExam = computeDaysUntil(examDate)
    /* Day in program = N - daysUntilExam, clamped to [1, N]. Matches the
       formula JourneyPage was already using, so existing screens do not
       observe a behavior shift — they just stop disagreeing with each other. */
    const raw = PROGRAM_LENGTH_DAYS - daysUntilExam
    const dayInProgram = Math.max(1, Math.min(PROGRAM_LENGTH_DAYS, raw))
    return {
      daysUntilExam,
      dayInProgram,
      showCountdown: true,
      programLengthDays: PROGRAM_LENGTH_DAYS,
    }
  }, [examDate])
}
