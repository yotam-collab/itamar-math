import { useState, useEffect, useRef } from 'react'
import { g } from '../../utils/gender'
import { useStudentProfileStore } from '../../stores/studentProfileStore'
import { asset } from '../../utils/assetUrl'

const ACCENT = '#6C63FF'
const TEXT = '#3D4852'

interface TourStep {
  title: string
  description: string
  emoji: string
  target?: string // CSS selector to highlight
}

function getTourSteps(studentName: string | null): TourStep[] {
  const nameGreeting = studentName
    ? g(`${studentName}, ברוך הבא לזינוק!`, `${studentName}, ברוכה הבאה לזינוק!`)
    : g('ברוך הבא לזינוק!', 'ברוכה הבאה לזינוק!')
  return [
    {
      title: `${nameGreeting} 🏠`,
      description: g(
        'פה הבית שלך — תראה את ההתקדמות שלך, תבחר מה לתרגל, ותזנק קדימה!',
        'פה הבית שלך — תראי את ההתקדמות שלך, תבחרי מה לתרגל, ותזנקי קדימה!',
      ),
      emoji: '👋',
    },
    {
      title: 'אוצר מילים 📝',
      description: g(
        'משחקים, כרטיסיות ואתגרים שיעזרו לך לזכור מילים חדשות. ככל שתתרגל — הרמה תעלה!',
        'משחקים, כרטיסיות ואתגרים שיעזרו לך לזכור מילים חדשות. ככל שתתרגלי — הרמה תעלה!',
      ),
      emoji: '📝',
    },
    {
      title: 'שאלות בחינה 🎯',
      description: g(
        'השלמת משפטים, ניסוח מחדש, הבנת הנקרא — בדיוק כמו בבחינה! והשאלות מותאמות לרמה שלך.',
        'השלמת משפטים, ניסוח מחדש, הבנת הנקרא — בדיוק כמו בבחינה! והשאלות מותאמות לרמה שלך.',
      ),
      emoji: '🎯',
    },
    {
      title: 'קריאה באנגלית 📖',
      description: g(
        'טקסטים מעניינים בנושאים שאתה אוהב. קריאה היא הדרך הכי טובה לזנק קדימה!',
        'טקסטים מעניינים בנושאים שאת אוהבת. קריאה היא הדרך הכי טובה לזנק קדימה!',
      ),
      emoji: '📖',
    },
    {
      title: 'הרמה שלך עולה! 📈',
      description: g(
        'המערכת לומדת אותך ומתאימה את הקושי אוטומטית — תמיד אתגר בול בגובה העיניים!',
        'המערכת לומדת אותך ומתאימה את הקושי אוטומטית — תמיד אתגר בול בגובה העיניים!',
      ),
      emoji: '🚀',
    },
  ]
}

const LS_KEY = 'amirnet-tour-completed'
const LS_SHOW_AGAIN_KEY = 'amirnet-tour-show-again'

export function OnboardingTour() {
  const { studentName } = useStudentProfileStore()
  const [currentStep, setCurrentStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(true) // default: don't show again
  const tourAudioRef = useRef<HTMLAudioElement | null>(null)

  const playTourAudio = (src: string) => {
    if (tourAudioRef.current) {
      tourAudioRef.current.pause()
      tourAudioRef.current.currentTime = 0
    }
    const audio = new Audio(asset(src))
    tourAudioRef.current = audio
    audio.play().catch(() => {})
  }

  // Play audio per tour step — autoplay works because user already interacted during onboarding
  useEffect(() => {
    if (!visible) return
    const tourAudioMap: Record<number, string> = {
      0: 'audio/tour-welcome.mp3',
      1: 'audio/tour-vocab.mp3',
      2: 'audio/tour-exam.mp3',
      3: 'audio/tour-reading.mp3',
      4: 'audio/tour-adaptive.mp3',
    }
    const src = tourAudioMap[currentStep]
    if (src) playTourAudio(src)
  }, [visible, currentStep])

  useEffect(() => {
    const done = localStorage.getItem(LS_KEY)
    const showAgain = localStorage.getItem(LS_SHOW_AGAIN_KEY)

    if (!done || showAgain === 'true') {
      // Delay showing tour to let the page render first
      const timer = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  /* Final safety net: if the parent unmounts the tour mid-narration
     (route change, hot-reload, app teardown), kill any in-flight audio.
     Without this, the audio element survives unmount and keeps playing
     over whatever screen the student lands on. */
  useEffect(() => {
    return () => {
      if (tourAudioRef.current) {
        tourAudioRef.current.pause()
        tourAudioRef.current.currentTime = 0
        tourAudioRef.current.src = ''
        tourAudioRef.current = null
      }
    }
  }, [])

  if (!visible) return null

  const steps = getTourSteps(studentName)
  const step = steps[currentStep]
  const isLast = currentStep === steps.length - 1

  /* Stop the tour narration in any path that ends or transitions a step.
     Without this, pressing "יאללה, מתחילים" on the last slide kept the
     final audio playing into the home page, and pressing "הבא" mid-tour
     left the previous slide's narration running for ~50ms until the
     useEffect for the next step kicked in. */
  const stopTourAudio = () => {
    if (tourAudioRef.current) {
      tourAudioRef.current.pause()
      tourAudioRef.current.currentTime = 0
      tourAudioRef.current.src = ''
      tourAudioRef.current = null
    }
  }

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem(LS_KEY, 'true')
      // Save preference: if dontShowAgain is true, remove show-again flag; otherwise set it
      if (dontShowAgain) {
        localStorage.removeItem(LS_SHOW_AGAIN_KEY)
      } else {
        localStorage.setItem(LS_SHOW_AGAIN_KEY, 'true')
      }
      stopTourAudio()
      setVisible(false)
    } else {
      stopTourAudio()
      setCurrentStep(s => s + 1)
    }
  }

  const handleSkip = () => {
    localStorage.setItem(LS_KEY, 'true')
    if (dontShowAgain) {
      localStorage.removeItem(LS_SHOW_AGAIN_KEY)
    } else {
      localStorage.setItem(LS_SHOW_AGAIN_KEY, 'true')
    }
    stopTourAudio()
    setVisible(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.3s ease',
      }}
      onClick={handleSkip}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 28,
          padding: '32px 28px',
          maxWidth: 360,
          width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          animation: 'scaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          textAlign: 'center',
        }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === currentStep ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === currentStep ? ACCENT : '#E2E8F0',
                transition: 'transform 220ms var(--ease-out), opacity 220ms var(--ease-out), background 220ms var(--ease-out)',
              }}
            />
          ))}
        </div>

        {/* Emoji */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${ACCENT}20, ${ACCENT}10)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 32,
          }}
        >
          {step.emoji}
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: TEXT,
            marginBottom: 8,
            fontFamily: 'var(--font-display)',
          }}
        >
          {step.title}
        </h3>

        {/* Description */}
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: '#6B7280',
            marginBottom: 24,
            fontFamily: 'var(--font-body)',
          }}
        >
          {step.description}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleSkip}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              background: '#fff',
              color: '#6B7280',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
            }}
          >
            דלג
          </button>
          <button
            onClick={handleNext}
            style={{
              flex: 2,
              padding: '12px 16px',
              borderRadius: 14,
              border: 'none',
              background: `linear-gradient(135deg, ${ACCENT}, #A855F7)`,
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              boxShadow: `0 4px 12px ${ACCENT}40`,
            }}
          >
            {isLast ? g('יאללה, מתחילים! 🚀', 'יאללה, מתחילות! 🚀') : 'הבא ←'}
          </button>
        </div>

        {/* Don't show again checkbox — on last step */}
        {isLast && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 16,
              cursor: 'pointer',
              fontSize: 12,
              color: '#94A3B8',
              fontFamily: 'var(--font-body)',
            }}
          >
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: ACCENT, cursor: 'pointer' }}
            />
            אל תראו לי את ההסבר הזה שוב
          </label>
        )}

        {/* Step count */}
        <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 12 }}>
          {currentStep + 1} מתוך {steps.length}
        </p>
      </div>
    </div>
  )
}
