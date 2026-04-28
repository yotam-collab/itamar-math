import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudentProfileStore, type EnglishLevel, type SelfAssessment, type Gender } from '../../stores/studentProfileStore'
import { playSound } from '../../utils/sounds'
import { asset } from '../../utils/assetUrl'
import { SpeakerBtn } from '../../utils/tts'
// ClickableEnglishText disabled in diagnostic to prevent word-lookup cheating
import type { Icon } from '@phosphor-icons/react'
import {
  Atom,
  Cpu,
  Clock,
  UsersThree,
  Leaf,
} from '@phosphor-icons/react'
import scData from '../../data/exam/sentence-completion.json'
import restData from '../../data/exam/restatements.json'
import rcData from '../../data/exam/reading-comprehension.json'

const S = {
  extruded: '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)',
  extrudedSm: '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)',
  inset: 'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)',
} as const

const BG = '#E0E5EC'
const ACCENT = '#6C63FF'
const TEXT = '#3D4852'
const MUTED = '#6B7280'
const SECONDARY = '#38B2AC'
const CORRECT = '#10B981'
const WRONG = '#EF4444'

type Step = 'welcome' | 'name' | 'gender' | 'examDate' | 'psychoDate' | 'level' | 'assessment' | 'topics' | 'diagnostic' | 'done'

const TOPICS: { id: string; label: string; Icon: Icon; color: string }[] = [
  { id: 'Science', label: 'מדע', Icon: Atom, color: '#6C63FF' },
  { id: 'Technology', label: 'טכנולוגיה', Icon: Cpu, color: '#38B2AC' },
  { id: 'History', label: 'היסטוריה', Icon: Clock, color: '#F59E0B' },
  { id: 'Society', label: 'חברה', Icon: UsersThree, color: '#EE2B73' },
  { id: 'Nature', label: 'טבע', Icon: Leaf, color: '#10B981' },
]

/** Shuffle array (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface DiagnosticQuestion {
  id: string
  sentence: string
  options: string[]
  correct: number
  /** If present, this question is part of an RC passage */
  passage?: string
  passageTitle?: string
}

/** Build 12-question diagnostic test: 4 easy SC + 3 hard SC + 2 restatement + 3 RC */
function buildDiagnosticQuestions(): DiagnosticQuestion[] {
  const scQuestions = scData as { id: string; sentence: string; options: string[]; correct: number }[]
  const restQuestions = restData as { id: string; sentence: string; options: string[]; correct: number }[]
  const rcPassages = rcData as { id: string; title: string; passage: string; questions: { id: string; question: string; options: string[]; correct: number }[] }[]

  const easy = shuffle(scQuestions.filter(q => q.id.includes('-a'))).slice(0, 4)
  const hard = shuffle(scQuestions.filter(q => q.id.includes('-b'))).slice(0, 3)
  const rest = shuffle(restQuestions).slice(0, 2)

  // Pick 1 RC passage and take up to 3 questions from it
  const rcPassage = rcPassages.length > 0 ? shuffle(rcPassages)[0] : null
  const rcQuestions: DiagnosticQuestion[] = rcPassage
    ? shuffle(rcPassage.questions).slice(0, 3).map(q => ({
        id: q.id,
        sentence: q.question,
        options: q.options,
        correct: q.correct,
        passage: rcPassage.passage,
        passageTitle: rcPassage.title,
      }))
    : []

  // First question is always a restatement, then SC shuffled, then RC at the end
  const firstRestatement = rest[0]
  const remainingRest = rest.slice(1)
  return [firstRestatement, ...shuffle([...easy, ...hard, ...remainingRest]), ...rcQuestions].filter(Boolean)
}

/** Gendered text helper for onboarding (uses local gender state, not store) */
function gLocal(gender: Gender | null, male: string, female: string): string {
  return gender === 'female' ? female : male
}

export function Onboarding() {
  const navigate = useNavigate()
  const { completeOnboarding, completeDiagnostic, setPreferredTopics, skipDiagnostic, seedStrongDummyProfile } = useStudentProfileStore()

  const [step, setStep] = useState<Step>('welcome')
  const [studentName, setStudentName] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [examDate, setExamDate] = useState<string | null>(null)
  const [examDateUnknown, setExamDateUnknown] = useState(false)
  const [psychoDate, setPsychoDate] = useState<string | null>(null)
  const [psychoDateOption, setPsychoDateOption] = useState<'date' | 'unknown' | 'none' | null>(null)
  const [level, setLevel] = useState<EnglishLevel | null>(null)
  const [assessment, setAssessment] = useState<SelfAssessment | null>(null)
  const [topics, setTopics] = useState<string[]>([])

  // Diagnostic test state
  const diagnosticQuestions = useMemo(() => buildDiagnosticQuestions(), [])
  const [diagIndex, setDiagIndex] = useState(0)
  const [diagSelected, setDiagSelected] = useState<number | null>(null)
  const [diagCorrectCount, setDiagCorrectCount] = useState(0)
  const [diagShowFeedback, setDiagShowFeedback] = useState(false)
  const [seenInstructionTypes, setSeenInstructionTypes] = useState<Set<string>>(new Set())

  const shouldDiagnose = level && level !== '3-units' && level !== 'not-tested' && assessment && assessment !== 'weak'

  const finalExamDate = examDateUnknown ? null : examDate
  const finalPsychoDate = psychoDateOption === 'none' ? 'none' : psychoDateOption === 'unknown' ? null : psychoDate

  // Stop any onboarding narration (step audio) before leaving the flow —
  // otherwise the final screen's TTS keeps playing over the home page.
  // Also halts any global TTS (in case speakEnglish was called).
  const stopOnboardingAudio = () => {
    if (stepAudioRef.current) {
      stepAudioRef.current.pause()
      stepAudioRef.current.currentTime = 0
      stepAudioRef.current = null
    }
    // Cancel any TTS from the global utils module too
    import('../../utils/tts').then(m => m.stopAllTTS()).catch(() => {})
  }

  const handleFinish = () => {
    if (!level || !assessment) return
    stopOnboardingAudio()
    completeOnboarding(level, assessment, studentName.trim() || null, gender, finalExamDate, finalPsychoDate)
    setPreferredTopics(topics)
    skipDiagnostic()
    playSound('complete')
    navigate('/')
  }

  const handleFinishWithDiagnostic = () => {
    if (!level || !assessment) return
    stopOnboardingAudio()
    const score = Math.round((diagCorrectCount / diagnosticQuestions.length) * 100)
    completeOnboarding(level, assessment, studentName.trim() || null, gender, finalExamDate, finalPsychoDate)
    setPreferredTopics(topics)
    completeDiagnostic(score)
    playSound('complete')
    navigate('/')
  }

  const handleDiagSelect = (idx: number) => {
    // Allow changing answer freely — no lock on selection
    const dq = diagnosticQuestions[diagIndex]
    const qType = dq.passage ? 'rc' : dq.id.startsWith('rest') ? 'restatement' : 'sc'
    setSeenInstructionTypes(prev => new Set(prev).add(qType))
    setDiagSelected(idx)
    setDiagShowFeedback(true) // enables "next" button
    // No sound feedback in diagnostic — don't reveal right/wrong
    playSound('click')
  }

  // Track correct answers in a ref so we always have the latest count
  const diagCorrectRef = useRef(0)

  const handleDiagNext = () => {
    // Stop any playing TTS
    window.speechSynthesis?.cancel()
    // Score the answer only when "next" is pressed (not on selection)
    if (diagSelected !== null) {
      const isCorrect = diagSelected === diagnosticQuestions[diagIndex].correct
      if (isCorrect) {
        diagCorrectRef.current += 1
        setDiagCorrectCount(c => c + 1)
      }
    }
    if (diagIndex + 1 < diagnosticQuestions.length) {
      setDiagIndex(i => i + 1)
      setDiagSelected(null)
      setDiagShowFeedback(false)
    } else {
      // Use ref for accurate count (state may not have updated yet)
      if (!level || !assessment) return
      const score = Math.round((diagCorrectRef.current / diagnosticQuestions.length) * 100)
      completeOnboarding(level, assessment, studentName.trim() || null, gender, finalExamDate, finalPsychoDate)
      setPreferredTopics(topics)
      completeDiagnostic(score)
      playSound('complete')
      navigate('/')
    }
  }

  const toggleTopic = (id: string) => {
    setTopics((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id])
  }

  // Play step audio
  const stepAudioRef = useRef<HTMLAudioElement | null>(null)
  const welcomeAudioPlayed = useRef(false)

  // Safety net (Bug #4): if Onboarding ever unmounts — by completion, by
  // navigate, by the test backdoor, by a crash that swaps the route — kill
  // any in-flight step narration. Without this, the audio element survives
  // unmount and keeps speaking over /journey, /, etc. The earlier explicit
  // `stopOnboardingAudio()` calls miss several exit paths (line 197, 358).
  useEffect(() => {
    return () => {
      if (stepAudioRef.current) {
        stepAudioRef.current.pause()
        stepAudioRef.current.currentTime = 0
        stepAudioRef.current.src = ''
        stepAudioRef.current = null
      }
      // Also halt any pregenerated TTS in case it was kicked off mid-flow.
      import('../../utils/tts').then(m => m.stopAllTTS()).catch(() => {})
    }
  }, [])

  const playStepAudio = (src: string) => {
    if (stepAudioRef.current) {
      stepAudioRef.current.pause()
      stepAudioRef.current.currentTime = 0
      stepAudioRef.current.src = ''
    }
    const audio = new Audio(asset(src))
    stepAudioRef.current = audio
    // Track whether this audio is still the "current" one when play()
    // resolves. If not (because step changed or the component unmounted
    // mid-load), force-pause AGAIN — Safari ignores a pause issued before
    // the deferred play() promise resolves, leaving the audio playing
    // over the next route. (Bug #4 reinforcement.)
    audio.play().then(() => {
      if (stepAudioRef.current !== audio) {
        audio.pause()
        audio.currentTime = 0
      }
    }).catch(() => {})
  }

  // Welcome audio needs user interaction first — played via onClick on the welcome screen
  const handleWelcomeInteraction = () => {
    if (!welcomeAudioPlayed.current && step === 'welcome') {
      welcomeAudioPlayed.current = true
      playStepAudio('audio/welcome-intro.mp3')
    }
  }

  useEffect(() => {
    // Stop any previous audio
    if (stepAudioRef.current) {
      stepAudioRef.current.pause()
      stepAudioRef.current.currentTime = 0
    }
    // Skip welcome — it's handled by user interaction
    if (step === 'welcome') return
    const audioMap: Partial<Record<Step, string>> = {
      name: 'audio/welcome-name.mp3',
      gender: 'audio/welcome-gender.mp3',
      examDate: 'audio/welcome-exam-date.mp3',
      psychoDate: 'audio/welcome-psycho-date.mp3',
      level: 'audio/welcome-level.mp3',
      assessment: 'audio/welcome-assessment.mp3',
      topics: 'audio/welcome-topics.mp3',
      diagnostic: 'audio/welcome-diagnostic.mp3',
    }
    const src = audioMap[step]
    if (src) {
      playStepAudio(src)
      return () => { if (stepAudioRef.current) { stepAudioRef.current.pause(); stepAudioRef.current.currentTime = 0 } }
    }
  }, [step])

  // Play audio for first SC / RC question in diagnostic
  const diagAudioPlayedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (step !== 'diagnostic') return
    const dq = diagnosticQuestions[diagIndex]
    if (!dq) return
    const qType = dq.passage ? 'rc' : dq.id.startsWith('rest') ? 'restatement' : 'sc'
    if (diagAudioPlayedRef.current.has(qType)) return
    const audioForType: Record<string, string> = {
      sc: 'audio/welcome-diagnostic-sc.mp3',
      rc: 'audio/welcome-diagnostic-rc.mp3',
    }
    const src = audioForType[qType]
    if (src) {
      diagAudioPlayedRef.current.add(qType)
      if (stepAudioRef.current) {
        stepAudioRef.current.pause()
        stepAudioRef.current.currentTime = 0
      }
      const audio = new Audio(asset(src))
      stepAudioRef.current = audio
      audio.play().catch(() => {})
    }
  }, [step, diagIndex, diagnosticQuestions])

  const goToNextAfterTopics = () => {
    if (shouldDiagnose) {
      playSound('click')
      setStep('diagnostic')
    } else {
      handleFinish()
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ background: BG }}>
      <div className="w-full max-w-md space-y-6 animate-fadeIn">

        {/* ═══ WELCOME ═══ */}
        {step === 'welcome' && (
          <div className="text-center space-y-6" onClick={handleWelcomeInteraction}>
            <img src={asset('znk-logo.png')} alt="זינוק" className="h-16 mx-auto" />
            <div style={{ background: BG, boxShadow: S.extruded, borderRadius: 32, padding: 32 }}>
              <img src={asset('char-mentor.png')} alt="" className="mx-auto mb-4" style={{ width: 120, height: 'auto' }} />
              <h1 className="text-2xl font-extrabold mb-3" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
                יאללה, בואו נזנק! 🚀
              </h1>
              <p className="text-base mb-6" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
                30 שניות ואנחנו מתאימים לך תרגול שמדויק בול בשבילך.
              </p>
              <button
                className="neu-btn-accent w-full py-4 text-lg"
                onClick={() => { playSound('click'); setStep('name') }}
              >
                קדימה! 💪
              </button>
            </div>
          </div>
        )}

        {/* ═══ NAME ═══ */}
        {step === 'name' && (
          <div style={{ background: BG, boxShadow: S.extruded, borderRadius: 32, padding: 28 }}>
            <div className="text-center mb-6">
              <span className="text-4xl mb-3 block">👋</span>
              <h2 className="text-2xl font-extrabold mb-2" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
                איך קוראים לך?
              </h2>
              <p className="text-sm" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
                ככה נדע לפנות אליך בצורה אישית
              </p>
            </div>

            <div className="mb-2">
              <label className="text-xs font-bold mb-2 block" style={{ color: ACCENT, fontFamily: 'var(--font-display)' }}>
                השם שלך ✍️
              </label>
              <input
                type="text"
                placeholder="כתבו את השם שלכם כאן..."
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                className="w-full py-4 px-5 rounded-2xl text-right text-lg font-bold outline-none"
                style={{
                  background: BG,
                  boxShadow: S.inset,
                  color: TEXT,
                  fontFamily: 'var(--font-display)',
                  border: studentName.trim() ? `2px solid ${ACCENT}` : `2px solid transparent`,
                  fontSize: 18,
                }}
                dir="rtl"
                autoFocus
              />
            </div>

            <button
              className="neu-btn-accent w-full py-4 mt-6 text-base"
              style={{ opacity: studentName.trim() ? 1 : 0.5 }}
              disabled={!studentName.trim()}
              onClick={() => {
                playSound('click')
                // ─── TEST BACKDOOR: name "חזקה" → bypass everything,
                //     seed strong-student dummy profile, jump to dashboard.
                if (studentName.trim() === 'חזקה') {
                  seedStrongDummyProfile('חזקה')
                  navigate('/')
                  return
                }
                setStep('gender')
              }}
            >
              ← קדימה!
            </button>
          </div>
        )}

        {/* ═══ GENDER ═══ */}
        {step === 'gender' && (
          <div style={{ background: BG, boxShadow: S.extruded, borderRadius: 32, padding: 28 }}>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-extrabold mb-2" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
                היי {studentName}! 🤩
              </h2>
              <p className="text-sm" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
                איך לפנות אליך?
              </p>
            </div>

            <div className="flex gap-4">
              {([
                { value: 'male' as const, label: 'לשון זכר', emoji: '👦' },
                { value: 'female' as const, label: 'לשון נקבה', emoji: '👧' },
              ]).map(opt => (
                <div
                  key={opt.value}
                  className="flex-1 flex flex-col items-center justify-center gap-3 p-5 rounded-2xl cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] duration-200"
                  style={{
                    background: BG,
                    boxShadow: gender === opt.value ? S.inset : S.extrudedSm,
                    outline: gender === opt.value ? `3px solid ${ACCENT}` : 'none',
                  }}
                  onClick={() => { playSound('click'); setGender(opt.value) }}
                >
                  <span className="text-3xl">{opt.emoji}</span>
                  <span className="font-bold text-sm" style={{ color: gender === opt.value ? ACCENT : TEXT, fontFamily: 'var(--font-display)' }}>
                    {opt.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Skip gender option */}
            <button
              className="w-full mt-3 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 znk-tooltip"
              style={{ background: 'transparent', border: 'none', color: MUTED, fontFamily: 'var(--font-body)' }}
              onClick={() => { playSound('click'); setGender(null); setStep('examDate') }}
            >
              <span className="znk-tip" data-placement="top" role="tooltip">
                אפשר לדלג — הטקסטים יישארו ניטרליים, אפשר לעדכן בהגדרות
              </span>
              דלג ←
            </button>

            <div className="flex gap-3 mt-3">
              <button
                className="flex-1 py-3.5 rounded-xl font-bold text-sm"
                style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }}
                onClick={() => setStep('name')}
              >
                חזרה ←
              </button>
              <button
                className="neu-btn-accent flex-1 py-3.5"
                style={{ opacity: gender ? 1 : 0.5 }}
                disabled={!gender}
                onClick={() => { playSound('click'); setStep('examDate') }}
              >
                ← יאללה, קדימה!
              </button>
            </div>
          </div>
        )}

        {/* ═══ EXAM DATE ═══ */}
        {step === 'examDate' && (
          <div style={{ background: BG, boxShadow: S.extruded, borderRadius: 32, padding: 28 }}>
            <div className="text-center mb-6">
              <span className="text-4xl mb-3 block">📅</span>
              <h2 className="text-2xl font-extrabold mb-2" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
                מתי הבחינה באנגלית?
              </h2>
              <p className="text-sm" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
                ככה נדע לתכנן לך לוח זמנים מדויק
              </p>
            </div>

            {!examDateUnknown && (
              <div className="mb-4 relative">
                {/* Visible formatted date display */}
                <div
                  className="w-full py-4 px-5 rounded-2xl text-center text-lg font-bold cursor-pointer"
                  style={{
                    background: BG,
                    boxShadow: S.inset,
                    color: examDate ? TEXT : MUTED,
                    fontFamily: 'var(--font-display)',
                    border: examDate ? `2px solid ${ACCENT}` : `2px solid transparent`,
                    fontSize: 18,
                  }}
                  onClick={() => (document.getElementById('exam-date-input') as HTMLInputElement)?.showPicker?.()}
                >
                  {examDate
                    ? (() => { const [y, m, d] = examDate.split('-'); return `${parseInt(d)}/${parseInt(m)}/${y}` })()
                    : 'לחצו לבחירת תאריך'}
                </div>
                {/* Hidden native date picker */}
                <input
                  id="exam-date-input"
                  type="date"
                  value={examDate || ''}
                  onChange={e => { setExamDate(e.target.value); setExamDateUnknown(false) }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}

            <div
              className="flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] duration-200"
              style={{
                background: BG,
                boxShadow: examDateUnknown ? S.inset : S.extrudedSm,
                outline: examDateUnknown ? `2px solid ${ACCENT}` : 'none',
              }}
              onClick={() => { playSound('click'); setExamDateUnknown(!examDateUnknown); if (!examDateUnknown) setExamDate(null) }}
            >
              <span className="text-xl flex-shrink-0">🤷</span>
              <div>
                <p className="font-bold text-sm" style={{ color: examDateUnknown ? ACCENT : TEXT, fontFamily: 'var(--font-display)' }}>
                  עדיין לא {gLocal(gender, 'יודע', 'יודעת')}
                </p>
                <p className="text-xs" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
                  לא נורא, נתעדכן אחר כך
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 py-3.5 rounded-xl font-bold text-sm"
                style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }}
                onClick={() => setStep('gender')}
              >
                חזרה ←
              </button>
              <button
                className="neu-btn-accent flex-1 py-3.5"
                style={{ opacity: (examDate || examDateUnknown) ? 1 : 0.5 }}
                disabled={!examDate && !examDateUnknown}
                onClick={() => { playSound('click'); setStep('psychoDate') }}
              >
                המשך ←
              </button>
            </div>
          </div>
        )}

        {/* ═══ PSYCHOMETRIC COURSE DATE ═══ */}
        {step === 'psychoDate' && (
          <div style={{ background: BG, boxShadow: S.extruded, borderRadius: 32, padding: 28 }}>
            <div className="text-center mb-6">
              <span className="text-4xl mb-3 block">🎓</span>
              <h2 className="text-xl font-extrabold mb-2" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
                {gLocal(gender, 'עושה', 'עושה')} קורס פסיכומטרי?
              </h2>
              <p className="text-sm" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
                נתאם את הקצב שלך עם הקורס
              </p>
            </div>

            <div className="space-y-3">
              {/* Option: Enter date */}
              <div
                className="flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] duration-200"
                style={{
                  background: BG,
                  boxShadow: psychoDateOption === 'date' ? S.inset : S.extrudedSm,
                  outline: psychoDateOption === 'date' ? `2px solid ${ACCENT}` : 'none',
                }}
                onClick={() => { playSound('click'); setPsychoDateOption('date') }}
              >
                <span className="text-xl flex-shrink-0">📆</span>
                <div className="flex-1">
                  <p className="font-bold text-sm" style={{ color: psychoDateOption === 'date' ? ACCENT : TEXT, fontFamily: 'var(--font-display)' }}>
                    כן, הקורס מתחיל ב...
                  </p>
                </div>
              </div>

              {/* Date picker (shown when "date" option selected) */}
              {psychoDateOption === 'date' && (
                <div className="pr-4 animate-fadeIn relative">
                  <div
                    className="w-full py-3 px-5 rounded-2xl text-center text-base font-bold cursor-pointer"
                    style={{
                      background: BG,
                      boxShadow: S.inset,
                      color: psychoDate ? TEXT : MUTED,
                      fontFamily: 'var(--font-display)',
                      border: psychoDate ? `2px solid ${ACCENT}` : `2px solid transparent`,
                    }}
                    onClick={() => (document.getElementById('psycho-date-input') as HTMLInputElement)?.showPicker?.()}
                  >
                    {psychoDate
                      ? (() => { const [y, m, d] = psychoDate.split('-'); return `${parseInt(d)}/${parseInt(m)}/${y}` })()
                      : 'לחצו לבחירת תאריך'}
                  </div>
                  <input
                    id="psycho-date-input"
                    type="date"
                    value={psychoDate || ''}
                    onChange={e => setPsychoDate(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </div>
              )}

              {/* Option: Don't know */}
              <div
                className="flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] duration-200"
                style={{
                  background: BG,
                  boxShadow: psychoDateOption === 'unknown' ? S.inset : S.extrudedSm,
                  outline: psychoDateOption === 'unknown' ? `2px solid ${ACCENT}` : 'none',
                }}
                onClick={() => { playSound('click'); setPsychoDateOption('unknown'); setPsychoDate(null) }}
              >
                <span className="text-xl flex-shrink-0">🤷</span>
                <p className="font-bold text-sm" style={{ color: psychoDateOption === 'unknown' ? ACCENT : TEXT, fontFamily: 'var(--font-display)' }}>
                  כן, אבל עדיין לא {gLocal(gender, 'יודע', 'יודעת')} מתי
                </p>
              </div>

              {/* Option: No course */}
              <div
                className="flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] duration-200"
                style={{
                  background: BG,
                  boxShadow: psychoDateOption === 'none' ? S.inset : S.extrudedSm,
                  outline: psychoDateOption === 'none' ? `2px solid ${ACCENT}` : 'none',
                }}
                onClick={() => { playSound('click'); setPsychoDateOption('none'); setPsychoDate(null) }}
              >
                <span className="text-xl flex-shrink-0">✌️</span>
                <p className="font-bold text-sm" style={{ color: psychoDateOption === 'none' ? ACCENT : TEXT, fontFamily: 'var(--font-display)' }}>
                  אני לא {gLocal(gender, 'עושה', 'עושה')} קורס פסיכומטרי
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 py-3.5 rounded-xl font-bold text-sm"
                style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }}
                onClick={() => setStep('examDate')}
              >
                חזרה ←
              </button>
              <button
                className="neu-btn-accent flex-1 py-3.5"
                style={{ opacity: psychoDateOption ? 1 : 0.5 }}
                disabled={!psychoDateOption || (psychoDateOption === 'date' && !psychoDate)}
                onClick={() => { playSound('click'); setStep('level') }}
              >
                המשך ←
              </button>
            </div>
          </div>
        )}

        {/* ═══ LEVEL ═══ */}
        {step === 'level' && (
          <div style={{ background: BG, boxShadow: S.extruded, borderRadius: 32, padding: 28 }}>
            <h2 className="text-xl font-extrabold mb-2" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
              כמה יחידות באנגלית? 📚
            </h2>
            <p className="text-sm mb-6" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
              זה עוזר לנו לדייק את הרמה
            </p>
            <div className="space-y-3">
              {([
                { value: 'not-tested' as const, label: 'לא נבחנתי', desc: 'עוד לא עשיתי בגרות באנגלית' },
                { value: '3-units' as const, label: '3 יחידות', desc: 'רמה בסיסית' },
                { value: '4-units' as const, label: '4 יחידות', desc: 'רמה בינונית' },
                { value: '5-units' as const, label: '5 יחידות', desc: 'רמה מתקדמת' },
              ]).map((opt) => (
                <div
                  key={opt.value}
                  className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] duration-200"
                  style={{
                    background: BG,
                    boxShadow: level === opt.value ? S.inset : S.extrudedSm,
                    outline: level === opt.value ? `2px solid ${ACCENT}` : 'none',
                  }}
                  onClick={() => { playSound('click'); setLevel(opt.value) }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: level === opt.value ? ACCENT : BG,
                      boxShadow: level === opt.value ? 'none' : S.extrudedSm,
                      color: level === opt.value ? '#fff' : TEXT,
                      fontWeight: 800,
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {opt.value === 'not-tested' ? '?' : opt.value.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>{opt.label}</p>
                    <p className="text-sm" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>{opt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 py-3.5 rounded-xl font-bold text-sm"
                style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }}
                onClick={() => setStep('psychoDate')}
              >
                חזרה ←
              </button>
              <button
                className="neu-btn-accent flex-1 py-3.5"
                style={{ opacity: level ? 1 : 0.5 }}
                disabled={!level}
                onClick={() => { playSound('click'); setStep('assessment') }}
              >
                המשך ←
              </button>
            </div>
          </div>
        )}

        {/* ═══ ASSESSMENT ═══ */}
        {step === 'assessment' && (
          <div style={{ background: BG, boxShadow: S.extruded, borderRadius: 32, padding: 28 }}>
            <h2 className="text-xl font-extrabold mb-2" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
              {gLocal(gender, 'איפה אתה נמצא עם האנגלית?', 'איפה את נמצאת עם האנגלית?')} 🤔
            </h2>
            <p className="text-sm mb-6" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
              {gLocal(gender, 'תהיה כנה, זה עוזר לנו לעזור לך', 'תהיי כנה, זה עוזר לנו לעזור לך')}
            </p>
            <div className="space-y-3">
              {([
                { value: 'weak' as const, label: gLocal(gender, 'צריך עזרה רצינית', 'צריכה עזרה רצינית'), desc: 'אנגלית זה לא הצד החזק שלי', emoji: '💪' },
                { value: 'medium' as const, label: 'איפשהו באמצע', desc: gLocal(gender, 'מכיר בסיס, אבל צריך לתרגל', 'מכירה בסיס, אבל צריכה לתרגל'), emoji: '📚' },
                { value: 'strong' as const, label: gLocal(gender, 'די חזק', 'די חזקה'), desc: gLocal(gender, 'רוצה להגיע לציון גבוה', 'רוצה להגיע לציון גבוה'), emoji: '🎯' },
              ]).map((opt) => (
                <div
                  key={opt.value}
                  className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] duration-200"
                  style={{
                    background: BG,
                    boxShadow: assessment === opt.value ? S.inset : S.extrudedSm,
                    outline: assessment === opt.value ? `2px solid ${ACCENT}` : 'none',
                  }}
                  onClick={() => { playSound('click'); setAssessment(opt.value) }}
                >
                  <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                  <div>
                    <p className="font-bold" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>{opt.label}</p>
                    <p className="text-sm" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>{opt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 py-3.5 rounded-xl font-bold text-sm"
                style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }}
                onClick={() => setStep('level')}
              >
                חזרה ←
              </button>
              <button
                className="neu-btn-accent flex-1 py-3.5"
                style={{ opacity: assessment ? 1 : 0.5 }}
                disabled={!assessment}
                onClick={() => { playSound('click'); setStep('topics') }}
              >
                המשך ←
              </button>
            </div>
          </div>
        )}

        {/* ═══ TOPICS ═══ */}
        {step === 'topics' && (
          <div style={{ background: BG, boxShadow: S.extruded, borderRadius: 32, padding: 28 }}>
            <h2 className="text-xl font-extrabold mb-2" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
              על מה כיף לך לקרוא? 🔥
            </h2>
            <p className="text-sm mb-6" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
              נתאים לך קטעי קריאה שבאמת מעניינים. {gLocal(gender, 'תבחר', 'תבחרי')} כמה שבא לך!
            </p>
            <div className="grid grid-cols-2 gap-3">
              {TOPICS.map((topic) => {
                const selected = topics.includes(topic.id)
                return (
                  <div
                    key={topic.id}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] duration-200"
                    style={{
                      background: BG,
                      boxShadow: selected ? S.inset : S.extrudedSm,
                      outline: selected ? `2px solid ${ACCENT}` : 'none',
                    }}
                    onClick={() => { playSound('click'); toggleTopic(topic.id) }}
                  >
                    <topic.Icon weight="fill" size={28} color={selected ? ACCENT : topic.color} />
                    <span className="font-bold text-sm" style={{ color: selected ? ACCENT : TEXT, fontFamily: 'var(--font-display)' }}>
                      {topic.label}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 py-3.5 rounded-xl font-bold text-sm"
                style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }}
                onClick={() => setStep('assessment')}
              >
                חזרה ←
              </button>
              <button
                className="neu-btn-accent flex-1 py-3.5"
                onClick={goToNextAfterTopics}
              >
                {shouldDiagnose ? 'אני רוצה למבדק! 🎯' : 'אני רוצה להתחיל! 🚀'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ DIAGNOSTIC TEST — Exam-practice style ═══ */}
        {step === 'diagnostic' && (() => {
          const dq = diagnosticQuestions[diagIndex]

          // Determine question type for instructions
          const qType = dq.passage ? 'rc' : dq.id.startsWith('rest') ? 'restatement' : 'sc'
          const isFirstOfType = !seenInstructionTypes.has(qType)

          const instructionMap: Record<string, { emoji: string; title: string; text: string }> = {
            sc: {
              emoji: '✏️',
              title: 'השלמת משפטים',
              text: 'קראו את המשפט ובחרו את המילה או הביטוי שמשלימים אותו הכי טוב',
            },
            restatement: {
              emoji: '🔄',
              title: 'ניסוח מחדש',
              text: 'קראו את המשפט ובחרו את התשובה שאומרת את אותו הדבר — במילים אחרות',
            },
            rc: {
              emoji: '📖',
              title: 'הבנת הנקרא',
              text: 'קראו את הקטע ואז ענו על השאלות לפיו — אפשר לחזור לקטע בכל שלב',
            },
          }

          const getOptionStyle = (i: number) => {
            if (!diagShowFeedback) {
              return { background: BG, boxShadow: S.extrudedSm, outline: 'none' }
            }
            // Diagnostic: don't reveal correct/wrong — just highlight selected
            if (i === diagSelected) {
              return { background: BG, boxShadow: S.inset, outline: `3px solid ${ACCENT}` }
            }
            return { background: BG, boxShadow: S.extrudedSm, outline: 'none', opacity: 0.6 }
          }

          return (
            <div className="space-y-5 animate-fadeIn pb-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <button
                  className="px-4 py-2 rounded-xl font-bold text-sm"
                  style={{ background: BG, boxShadow: S.extrudedSm, color: TEXT, fontFamily: 'var(--font-display)', border: 'none', cursor: 'pointer' }}
                  onClick={() => handleFinish()}
                >
                  דלג ←
                </button>
                <h2 className="font-bold text-base" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>🎯 מבדק רמה</h2>
                <span className="text-sm font-bold" style={{ color: MUTED, fontFamily: 'var(--font-display)' }}>{diagIndex + 1}/{diagnosticQuestions.length}</span>
              </div>

              {/* Progress bar */}
              <div className="h-3 rounded-xl overflow-hidden" style={{ background: BG, boxShadow: S.inset }} dir="ltr">
                <div
                  className="h-full rounded-xl transition-[transform,box-shadow,background-color,border-color,opacity] duration-300"
                  style={{ width: `${((diagIndex + (diagShowFeedback ? 1 : 0)) / diagnosticQuestions.length) * 100}%`, background: `linear-gradient(90deg, ${ACCENT}, ${SECONDARY})` }}
                />
              </div>

              {/* Instruction banner — shows on first question of each type */}
              {(
                <div
                  className="animate-fadeIn"
                  dir="rtl"
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT}12, ${SECONDARY}12)`,
                    border: `2px solid ${ACCENT}25`,
                    borderRadius: 20,
                    padding: '14px 18px',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${ACCENT}18`, fontSize: 20 }}
                    >
                      {instructionMap[qType].emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm mb-0.5" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>
                        {instructionMap[qType].title}
                      </p>
                      <p className="text-xs" style={{ color: MUTED, fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
                        {instructionMap[qType].text}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* RC Passage (if this is an RC question) */}
              {dq.passage && (
                <div
                  className="max-h-[35vh] overflow-y-auto"
                  style={{ background: BG, boxShadow: S.extruded, borderRadius: 28, padding: 24 }}
                >
                  <div dir="ltr" className="text-left">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-base" style={{ color: TEXT, fontFamily: 'var(--font-display)' }}>{dq.passageTitle}</h3>
                      <SpeakerBtn text={dq.passage} size={18} />
                    </div>
                    {dq.passage.split('\n\n').map((para, i) => (
                      <p key={i} className="text-sm leading-relaxed mb-3 last:mb-0" style={{ color: TEXT, fontFamily: 'var(--font-body)' }}>
                        {para}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Question + Options — LTR for English content */}
              <div dir="ltr" className="text-left space-y-4">
                <div style={{ background: BG, boxShadow: dq.passage ? S.inset : S.extruded, borderRadius: dq.passage ? 20 : 28, padding: dq.passage ? '14px 18px' : 24 }}>
                  <div className="flex items-start gap-3">
                    <p className={`${dq.passage ? 'text-sm font-semibold' : 'text-lg'} leading-relaxed flex-1`} style={{ color: TEXT, fontFamily: 'var(--font-body)' }}>
                      {dq.sentence}
                    </p>
                    <SpeakerBtn text={dq.sentence} size={dq.passage ? 16 : 18} />
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-3">
                  {dq.options.map((opt, i) => (
                    <div
                      key={i}
                      className={`cursor-pointer transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 ${!diagShowFeedback ? 'hover:-translate-y-0.5' : ''}`}
                      style={{
                        ...getOptionStyle(i),
                        borderRadius: 20,
                        padding: '16px 20px',
                      }}
                      onClick={() => handleDiagSelect(i)}
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-sm" style={{ color: diagSelected === i && diagShowFeedback ? ACCENT : MUTED }}>({i + 1})</span>
                        <span className="flex-1" style={{ color: TEXT, fontFamily: 'var(--font-body)' }}>
                          {opt}
                        </span>
                        <SpeakerBtn text={opt} size={14} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next button (no correct/wrong feedback in diagnostic) */}
              {diagShowFeedback && (
                <button
                  className="neu-btn-accent w-full text-sm py-3.5 mt-2 animate-fadeIn"
                  onClick={handleDiagNext}
                >
                  {diagIndex + 1 < diagnosticQuestions.length ? 'הבא ←' : 'סיימתי! אני רוצה לראות תוצאות 🏆'}
                </button>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
