/**
 * Tiny external store that tracks whether a <ModeIntro> overlay is currently
 * playing on screen. The point: practices/games render the ModeIntro and the
 * actual practice content as siblings — when the intro is up we want
 *
 *   1. the practice timer (e.g. exam-full's 20-minute clock) to NOT tick down,
 *   2. auto-played TTS / read-aloud effects to NOT start narrating,
 *   3. the first-time instructions overlay to NOT layer on top of the intro
 *      animation (the user wanted the intro to play in full first, THEN see
 *      the instructions modal).
 *
 * Implemented as a module-level signal + listener set rather than Zustand so it
 * has no dependency surface and can be imported safely from anywhere (including
 * non-React code paths in the future).
 */

let _activeCount = 0
const _listeners = new Set<() => void>()

function _emit(): void {
  _listeners.forEach((l) => l())
}

/** Increment the active-mode-intro counter. Each ModeIntro mount calls this. */
export function pushModeIntroActive(): void {
  _activeCount += 1
  _emit()
}

/** Decrement; clamp at 0 in case of double-cleanup. */
export function popModeIntroActive(): void {
  _activeCount = Math.max(0, _activeCount - 1)
  _emit()
}

/** Snapshot reader for useSyncExternalStore. */
export function getModeIntroActive(): boolean {
  return _activeCount > 0
}

/** Subscriber registration for useSyncExternalStore. */
export function subscribeModeIntro(listener: () => void): () => void {
  _listeners.add(listener)
  return () => {
    _listeners.delete(listener)
  }
}
