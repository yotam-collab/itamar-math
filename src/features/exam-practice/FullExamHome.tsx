import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExamStore } from '../../stores/examStore'
import { useStudentProfileStore } from '../../stores/studentProfileStore'
import { useGamificationStore } from '../../stores/gamificationStore'
import { asset } from '../../utils/assetUrl'
import { g } from '../../utils/gender'

/* ═══════════════════════════════════════════════════════════════════════
   FULL EXAM HOME · דף תרגול פרק בחינה מלא
   Design aligned with ExamHome (/exam) — dark gradient hero, .feh-* classes.
   Core feature: estimated AMIR score gauge + research-backed motivation.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── AMIR band definitions (50-150 scale, NITE official) ── */
const AMIR_BANDS = [
  { min: 50, max: 84, color: '#EF4444', label: 'טרום-בסיסי' },
  { min: 85, max: 99, color: '#F97316', label: 'בסיסי' },
  { min: 100, max: 119, color: '#F59E0B', label: 'מתקדמים א׳' },
  { min: 120, max: 133, color: '#10B981', label: 'מתקדמים ב׳' },
  { min: 134, max: 150, color: '#06B6D4', label: 'פטור' },
] as const

function bandForScore(score: number): (typeof AMIR_BANDS)[number] {
  return AMIR_BANDS.find(b => score >= b.min && score <= b.max) ?? AMIR_BANDS[0]
}

/* ── SVG helpers for the semicircular gauge ── */
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180.0
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, endDeg)
  const end = polarToCartesian(cx, cy, r, startDeg)
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}
function scoreToAngle(score: number): number {
  const clamped = Math.max(50, Math.min(150, score))
  return -90 + ((clamped - 50) / 100) * 180 // -90° → +90°
}

/* ══════════════════════════════════════════════════════════════════ */

export function FullExamHome() {
  const navigate = useNavigate()
  const { getAttemptsByType, getAverageScore, getRecentAttempts } = useExamStore()
  const { studentName, examDate } = useStudentProfileStore()
  const { currentStreak } = useGamificationStore()

  const name = studentName || g('תלמיד', 'תלמידה')

  /* ── Performance aggregates ── */
  const scAvg = getAverageScore('sc')
  const restAvg = getAverageScore('restatement')
  const rcAvg = getAverageScore('rc')
  const fullAvg = getAverageScore('full')
  const fullAttempts = getAttemptsByType('full')
  const scAttempts = getAttemptsByType('sc').length
  const restAttempts = getAttemptsByType('restatement').length
  const rcAttempts = getAttemptsByType('rc').length
  const totalAttempts = scAttempts + restAttempts + rcAttempts + fullAttempts.length * 3

  const bestScore = fullAttempts.length > 0
    ? Math.max(...fullAttempts.map(a => Math.round((a.score / a.totalQuestions) * 100)))
    : 0

  const recent = getRecentAttempts(20).filter(a => a.type === 'full').slice(0, 5)

  /* ── Days until exam ── */
  const daysLeft = useMemo(() => {
    if (!examDate) return null
    const diff = Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  }, [examDate])

  /* ── Estimated AMIR score calculation ──
     Weighted by question count in the real exam (8 SC + 4 Rest + 10 RC = 22).
     If the student has full-exam attempts, we weight those heavily since they
     are the truest signal. Raw 0-100 maps linearly to AMIR 50-150. */
  const estimatedScore = useMemo(() => {
    // No practice at all → floor
    if (totalAttempts === 0) return 50

    let rawPct: number
    if (fullAttempts.length > 0) {
      // Full attempts dominate (they simulate the real thing)
      const partial = (scAvg * 8 + restAvg * 4 + rcAvg * 10) / 22
      rawPct = fullAvg * 0.6 + partial * 0.4
    } else {
      // Weight by question count; ignore sections with 0 attempts
      const parts: Array<{ w: number; v: number }> = []
      if (scAttempts > 0) parts.push({ w: 8, v: scAvg })
      if (restAttempts > 0) parts.push({ w: 4, v: restAvg })
      if (rcAttempts > 0) parts.push({ w: 10, v: rcAvg })
      if (parts.length === 0) return 50
      const totalW = parts.reduce((s, p) => s + p.w, 0)
      rawPct = parts.reduce((s, p) => s + p.w * p.v, 0) / totalW
    }
    // Map 0-100 → 50-150 linearly
    return Math.round(50 + rawPct)
  }, [totalAttempts, fullAttempts.length, fullAvg, scAvg, restAvg, rcAvg, scAttempts, restAttempts, rcAttempts])

  const band = bandForScore(estimatedScore)

  const confidence: 'low' | 'medium' | 'high' =
    totalAttempts < 5 ? 'low' : totalAttempts < 15 ? 'medium' : 'high'
  const confidenceLabel =
    confidence === 'low' ? 'אמדן ראשוני — כמה תרגולים נוספים יחדדו אותו'
    : confidence === 'medium' ? 'אמדן מבוסס — עוד תרגולים יקרבו לדיוק גבוה'
    : 'אמדן מדויק — מבוסס על מאסת תרגולים'

  /* ── Motivational proof banner (data-driven) ── */
  const pointsToExemption = Math.max(0, 134 - estimatedScore)
  const pointsToNextBand = Math.max(0, (AMIR_BANDS.find(b => b.min > estimatedScore)?.min ?? 150) - estimatedScore)
  const nextBandLabel = AMIR_BANDS.find(b => b.min > estimatedScore)?.label

  /* ── Recent trend ── */
  const trend = useMemo(() => {
    if (recent.length < 2) return null
    const latest = Math.round((recent[0].score / recent[0].totalQuestions) * 100)
    const prev = Math.round((recent[1].score / recent[1].totalQuestions) * 100)
    return latest - prev
  }, [recent])

  /* ── Gauge geometry ── */
  const gaugeSize = 320
  const cx = gaugeSize / 2
  const cy = gaugeSize / 2 + 20
  const r = 130
  const strokeWidth = 24
  const needleAngle = scoreToAngle(estimatedScore)

  /* ── Animated needle sweep on page entry ──
     Needle starts at the leftmost band (score 50 ≈ -90°) and sweeps
     with a gentle overshoot into place. Uses CSS transition on the SVG
     <g> element so it's GPU-accelerated and doesn't block input. */
  const [animatedAngle, setAnimatedAngle] = useState(-90)
  useEffect(() => {
    // Wait one paint so the transition animates FROM -90 TO needleAngle
    const t = setTimeout(() => setAnimatedAngle(needleAngle), 120)
    return () => clearTimeout(t)
  }, [needleAngle])

  /* Animated score count-up — matches the needle's sweep so the number
     doesn't jump to the final value while the needle is mid-swing. */
  const [animatedScore, setAnimatedScore] = useState(50)
  useEffect(() => {
    const start = performance.now()
    const duration = 1600 // ms — matches transition duration below
    const from = 50
    const to = estimatedScore
    let rafId = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // Ease-out-cubic for a natural deceleration mirroring the needle
      const eased = 1 - Math.pow(1 - t, 3)
      setAnimatedScore(Math.round(from + (to - from) * eased))
      if (t < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [estimatedScore])

  return (
    <div className="feh" style={{ margin: -16 }}>
      <style>{css}</style>

      {/* ═══ HERO ═══ */}
      <section className="feh-hero fade-up">
        <div className="feh-sparkles" aria-hidden="true"><i /><i /><i /><i /><i /></div>

        {/* Page intro — prominent "this is פרק בחינה מלא" header for
            first-time students. Subtitle + back button removed per
            product review: the h1 + section-chips carry enough context. */}
        <div className="feh-page-intro">
          <div className="feh-section-crown" aria-label="אזור פרק בחינה מלא">
            <div className="feh-section-crown-ico" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2.5 2.5" />
                <path d="M9 2h6" />
                <path d="M12 2v3" />
              </svg>
            </div>
            <div className="feh-section-crown-text">
              <small>אמירנט · אזור תרגול</small>
              <b>תרגול פרק בחינה מלא</b>
            </div>
          </div>
        </div>

        {daysLeft !== null && (
          <div className="feh-hero-top">
            <span className="feh-pill urgent" data-tip="כמה ימים נשארו ליום הבחינה. כל יום עובר = יום פחות לתרגול.">
              ⏳ {daysLeft} ימים לאמירנט
            </span>
          </div>
        )}

        <div className="feh-hero-grid">
          <div className="feh-hero-main">
            <h1>
              {name}, <span className="accent">20 דקות</span>.<br />
              איפה {g('אתה באמת', 'את באמת')}?
            </h1>
            <p className="feh-lede">
              22 שאלות · טיימר רציף · אפס רמזים · ציון בקנה מידה אמירנט.
              זו לא חזרה — זו הסימולציה הכי קרובה ליום הבחינה שיש.
            </p>

            {/* Section-breakdown chips removed — the h1 + lede + sub-sections
                info are enough; the chips crowded the hero without adding
                information the student hadn't already absorbed. */}

            <div className="feh-ctas">
              <button
                className="feh-btn-primary feh-btn-primary-wide znk-cta-primary"
                onClick={() => navigate('/exam/full/start')}
              >
                <span>להתחלת פרק בחינה מלא</span>
                {/* Left-pointing arrow (forward in RTL) */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
              </button>
            </div>
          </div>

          {/* ── Zinuk mascot — its own grid column (CENTRE in RTL) ── */}
          <img
            src={asset('char-calculator.png')}
            alt=""
            aria-hidden="true"
            className="feh-hero-char"
          />

          {/* ── Score Gauge — visual-LEFT column in RTL ── */}
          <div className="feh-gauge-card" data-tip={confidenceLabel}>
            <div className="feh-gauge-head">
              <b>הציון המשוער {g('שלך', 'שלך')}</b>
              <small>בקנה מידה של אמירנט (50–150)</small>
            </div>
            {/* viewBox extended by 32px on each side so "50" and "150" labels
                don't get clipped — they sit slightly outside the gauge radius. */}
            <svg viewBox={`-32 0 ${gaugeSize + 64} ${gaugeSize * 0.68}`} className="feh-gauge">
              <defs>
                <filter id="needleShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4" />
                </filter>
              </defs>
              {/* Background bands */}
              {AMIR_BANDS.map(b => {
                const startAngle = scoreToAngle(b.min)
                const endAngle = scoreToAngle(b.max)
                return (
                  <path
                    key={b.min}
                    d={describeArc(cx, cy, r, startAngle, endAngle)}
                    stroke={b.color}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="butt"
                    opacity={0.85}
                  />
                )
              })}
              {/* Tick marks */}
              {[50, 85, 100, 120, 134, 150].map(t => {
                const a = scoreToAngle(t)
                const p1 = polarToCartesian(cx, cy, r - strokeWidth / 2 - 6, a)
                const p2 = polarToCartesian(cx, cy, r + strokeWidth / 2 + 4, a)
                const labelP = polarToCartesian(cx, cy, r + strokeWidth / 2 + 20, a)
                return (
                  <g key={t}>
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" />
                    <text x={labelP.x} y={labelP.y} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="700" fill="rgba(255,255,255,0.7)" fontFamily="var(--font-display)">{t}</text>
                  </g>
                )
              })}
              {/* Needle — animated sweep on mount, then tracks estimatedScore */}
              <g
                filter="url(#needleShadow)"
                style={{
                  transform: `rotate(${animatedAngle}deg)`,
                  transformOrigin: `${cx}px ${cy}px`,
                  transition: 'transform 1.6s cubic-bezier(0.34, 1.15, 0.64, 1)',
                }}
              >
                <line x1={cx} y1={cy} x2={cx} y2={cy - r + 10} stroke="#fff" strokeWidth="5" strokeLinecap="round" />
                <circle cx={cx} cy={cy} r="10" fill="#fff" />
                <circle cx={cx} cy={cy} r="4" fill={band.color} />
              </g>
            </svg>
            <div className="feh-gauge-score">
              <b style={{ color: band.color }}>{animatedScore}</b>
              <span className="feh-gauge-band" style={{ background: band.color }}>רמה: {band.label}</span>
            </div>
            <div className="feh-gauge-foot">
              {pointsToExemption > 0 ? (
                <span data-tip="134 הוא סף הפטור ברוב המוסדות — זו המטרה.">
                  עוד <b>{pointsToExemption}</b> נקודות לפטור (134)
                </span>
              ) : (
                <span data-tip="מעולה! הציון המשוער בטווח פטור. תעמוד/י על הגובה עד יום הבחינה.">
                  🎉 {g('אתה בטווח פטור', 'את בטווח פטור')}!
                </span>
              )}
              {nextBandLabel && pointsToNextBand > 0 && pointsToNextBand < pointsToExemption && (
                <span className="feh-gauge-next">
                  · עוד <b>{pointsToNextBand}</b> לרמת <b>{nextBandLabel}</b>
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS STRIP ═══ */}
      <section className="feh-stats fade-up d2">
        <div className="feh-stat" data-tip="כמה פעמים סיימת סימולציה מלאה. כל סיום מחשל אותך — במיוחד סביב פרקי בחינה שלמים.">
          <span className="lbl">סימולציות</span>
          <b>{fullAttempts.length}</b>
          <span className="sub">שהשלמת</span>
        </div>
        <div className="feh-stat" data-tip="הציון הגבוה ביותר שקיבלת בסימולציה. זה הרף שחלפת פעם — תוכיח שזה לא היה מקרה.">
          <span className="lbl">שיא אישי</span>
          <b>{bestScore}<small>%</small></b>
          <span className="sub">בסימולציה מלאה</span>
        </div>
        <div className="feh-stat" data-tip="ממוצע כל הסימולציות. יעד: לדחוף את הממוצע למעלה בכל ניסיון חדש.">
          <span className="lbl">ממוצע</span>
          <b>{fullAttempts.length > 0 ? fullAvg : '—'}{fullAttempts.length > 0 && <small>%</small>}</b>
          <span className="sub">בסימולציות</span>
        </div>
        <div className="feh-stat" data-tip={currentStreak >= 1 ? `רצף של ${currentStreak} ימים. אל תשבור אותו — יום אחד חסר מחזיר אותך לאפס.` : 'יום ראשון לרצף חדש — תרגול אחד היום מתחיל את הספירה.'}>
          <span className="lbl">רצף</span>
          <b>🔥 {currentStreak}</b>
          <span className="sub">ימים ברצף</span>
        </div>
      </section>

      {/* ═══ RECENT ATTEMPTS ═══ */}
      {recent.length > 0 && (
        <section className="feh-recent fade-up d5">
          <div className="feh-shead inline">
            <h2>הסימולציות האחרונות {g('שלך', 'שלך')}</h2>
            {trend !== null && (
              <span className={`feh-trend ${trend >= 0 ? 'up' : 'down'}`} data-tip={trend >= 0 ? `השתפרת ב-${Math.abs(trend)} נקודות מהפעם הקודמת. הקצב הזה = עוד רמה בתוך חודש.` : `ירידה של ${Math.abs(trend)} נקודות. לא סוף העולם — תרגול ממוקד יחזיר אותך למעלה.`}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)} נק׳
              </span>
            )}
          </div>
          <div className="feh-recent-list">
            {recent.map(a => {
              const pct = Math.round((a.score / a.totalQuestions) * 100)
              const d = new Date(a.completedAt)
              const dateStr = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
              const bandStatus = pct >= 85 ? 'excellent' : pct >= 70 ? 'good' : pct >= 50 ? 'warn' : 'low'
              return (
                <div key={a.id} className={`feh-recent-row s-${bandStatus}`}>
                  <span className="date">{dateStr}</span>
                  <span className="qs">{a.score}/{a.totalQuestions}</span>
                  <div className="bar"><div style={{ width: `${pct}%` }} /></div>
                  <span className="pct">{pct}%</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ═══ FINAL CTA — focused, gender-clean, Zinuk voice ═══ */}
      <section className="feh-final fade-up d5">
        <img src={asset('char-english.png')} alt="" className="feh-final-char" aria-hidden="true" />
        <div>
          <h3>{pointsToExemption > 0 ? `עוד ${pointsToExemption} נקודות לפטור` : g('אתה בטווח פטור — תחזיק שם.', 'את בטווח פטור — תחזיקי שם.')}</h3>
          <p>
            {fullAttempts.length === 0
              ? g('עוד לא עשית סימולציה — בוא נראה איפה אתה עומד.', 'עוד לא עשית סימולציה — בואי נראה איפה את עומדת.')
              : g('עוד סיבוב מזיז את המחוג. הזמן בידיים שלך.', 'עוד סיבוב מזיז את המחוג. הזמן בידיים שלך.')}
          </p>
          <button className="feh-btn-primary big znk-tooltip" onClick={() => navigate('/exam/full/start')}>
            <span className="znk-tip" data-placement="top" role="tooltip">
              22 שאלות · 20 דקות · בתנאי אמת — הציון הכי קרוב לבחינה האמיתית
            </span>
            <span>{g('אני רוצה להתחיל!', 'אני רוצה להתחיל!')}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 3 5 12 19 21 19 3" /></svg>
          </button>
        </div>
      </section>
    </div>
  )
}

/* SectionBreakdown subcomponent removed — replaced by inline .feh-chips
   in the hero for a tighter, more action-focused page. */

/* ═══════════════════════════════════════════════════════════════════
   CSS — namespaced .feh (matches ExamHome .eh visual language)
   =================================================================== */
const css = `
.feh{
  --md-primary: #EE2B73; --md-ink: #0d294b;
  font-family: var(--font-body, 'Heebo', sans-serif);
  padding-bottom: 32px;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
}

/* Fade up sequence */
.fade-up{ opacity: 0; transform: translateY(18px); animation: fehFadeUp .7s var(--ease) forwards; }
.fade-up.d2{animation-delay: .10s;} .fade-up.d3{animation-delay: .18s;}
.fade-up.d4{animation-delay: .26s;} .fade-up.d5{animation-delay: .34s;}
.fade-up.d6{animation-delay: .42s;}
@keyframes fehFadeUp{to{opacity:1; transform:none;}}

/* ═══ HERO ═══ */
.feh-hero{
  position: relative; overflow: hidden;
  border-radius: 32px; padding: 32px 30px; margin: 16px 16px 20px;
  background:
    radial-gradient(circle at 15% 20%, rgba(255,230,0,0.22), transparent 45%),
    radial-gradient(circle at 85% 80%, rgba(236,72,153,0.42), transparent 55%),
    linear-gradient(135deg, #1a0b3a 0%, #3D1F66 40%, #7A2A8E 75%, #EC4899 115%);
  color: #fff;
  box-shadow: 0 28px 66px -22px rgba(61,31,102,0.55);
}
.feh-sparkles{ position: absolute; inset: 0; pointer-events: none; }
.feh-sparkles i{
  position: absolute; width: 4px; height: 4px; border-radius: 50%;
  background: #fff; opacity: 0; animation: fehSparkle 4s ease-in-out infinite;
}
.feh-sparkles i:nth-child(1){ top: 18%; left: 8%;  animation-delay: 0s; }
.feh-sparkles i:nth-child(2){ top: 72%; left: 4%;  animation-delay: 1s; width:6px; height:6px; }
.feh-sparkles i:nth-child(3){ top: 42%; left: 12%; animation-delay: 2s; }
.feh-sparkles i:nth-child(4){ top: 88%; left: 22%; animation-delay: 1.6s; width:5px; height:5px; }
.feh-sparkles i:nth-child(5){ top: 60%; left: 26%; animation-delay: 3s; }
@keyframes fehSparkle{ 0%,100%{opacity:0; transform:scale(.5);} 50%{opacity:1; transform:scale(1.2);} }

/* Zinuk mascot — dedicated grid column (visual left in RTL). Sits as a
   regular grid child now, so flex/absolute hacks are gone. align-items:
   end on the grid pins it to the bottom line of the hero. */
.feh-hero-char{
  display: block;
  width: 100%;
  max-width: 320px;
  height: auto;
  pointer-events: none;
  margin-bottom: -32px;   /* bleed into the hero's bottom padding */
  position: relative; z-index: 3;
  justify-self: center;
  filter: drop-shadow(0 18px 30px rgba(124,58,237,0.5))
          drop-shadow(0 6px 14px rgba(0,0,0,0.3));
  animation: fehCharFloat 5.5s ease-in-out infinite, fehCharIn 0.75s cubic-bezier(0.34, 1.36, 0.64, 1) both;
  transform-origin: center bottom;
}
@keyframes fehCharFloat{
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50%      { transform: translateY(-6px) rotate(2deg); }
}
@keyframes fehCharIn{
  from { opacity: 0; transform: translateY(32px) scale(0.9) rotate(-6deg); }
  to   { opacity: 1; transform: translateY(0) scale(1) rotate(0); }
}
@media (max-width: 1100px){
  .feh-hero-char{ max-width: 240px; margin-bottom: -24px; }
}
@media (max-width: 920px){
  .feh-hero-char{
    /* Single-column — char is last in the stack. Centre it, keep it
       compact so the hero doesn't grow too tall. */
    max-width: 200px;
    margin: 6px auto -18px;
  }
}
@media (max-width: 520px){
  .feh-hero-char{
    max-width: 160px;
    margin-bottom: -14px;
    opacity: 0.95;
  }
}
@media (prefers-reduced-motion: reduce){
  .feh-hero-char{ animation: none; }
}

/* Page intro block — prominent "what is this page" header */
.feh-page-intro{
  margin-bottom: 18px;
  position: relative; z-index: 2;
}
.feh-page-subtitle{
  margin: 12px 4px 0;
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 700;
  line-height: 1.45;
  color: rgba(255,255,255,0.88);
  max-width: 56ch;
  letter-spacing: -0.005em;
  /* Staggered fade-up behind the crown */
  opacity: 0;
  transform: translateY(10px);
  animation: fehSubIn .6s cubic-bezier(0.22, 1, 0.36, 1) .22s forwards;
}
@keyframes fehSubIn{ to{ opacity: 1; transform: none; } }
/* Section crown — pixel-identical to /reading .rh-section-crown and
   /exam .eh-section-crown so all three gateway pages share one crown size. */
/* Crown chip — color-matched to .eh-section-crown on /exam so the two
   exam-area gateways share the same yellow + navy crown vocabulary.
   Was orange→pink gradient with white text; switched to yellow→amber
   gradient with navy text + 5px hard navy shadow. */
.feh-section-crown{
  display: inline-flex; align-items: center; gap: 14px;
  padding: 14px 22px 14px 18px;
  background: linear-gradient(135deg, rgba(255,230,0,0.98) 0%, rgba(255,199,44,0.98) 100%);
  color: #1a0b3a;
  border: 3px solid #1a0b3a;
  border-radius: 999px;
  box-shadow: 5px 5px 0 0 #1a0b3a;
  position: relative; z-index: 2;
  animation: fehCrownIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.feh-section-crown-ico{
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border-radius: 50%;
  background: linear-gradient(135deg, #1a0b3a, #4A1A6B);
  color: #FFE600;
  box-shadow: inset 0 1px 2px rgba(255,255,255,0.15);
  flex-shrink: 0;
}
.feh-section-crown-ico svg{ width: 24px; height: 24px; }
.feh-section-crown-text{ display: flex; flex-direction: column; gap: 2px; line-height: 1; }
.feh-section-crown-text small{
  font-family: var(--font-display);
  font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
  color: rgba(26,11,58,0.7);
}
.feh-section-crown-text b{
  font-family: var(--font-display);
  font-size: 26px; font-weight: 900; letter-spacing: -0.015em;
  color: #1a0b3a;
  line-height: 1.05;
}
.feh-section-crown-sub{
  font-weight: 700; opacity: 0.55; font-size: 15px;
}
@keyframes fehCrownIn {
  0% { opacity: 0; transform: translateY(-8px) scale(0.95); }
  60% { opacity: 1; transform: translateY(0) scale(1.03); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.feh-hero-top{
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-bottom: 20px; position: relative; z-index: 2;
}
.feh-back{
  background: rgba(255,255,255,0.14); color: #fff;
  border: 1px solid rgba(255,255,255,0.22); backdrop-filter: blur(10px);
  padding: 8px 16px; border-radius: 999px;
  font-family: var(--font-display); font-weight: 700; font-size: 13px;
  cursor: pointer; transition: background .2s var(--ease);
}
.feh-back:hover{ background: rgba(255,255,255,0.22); }
.feh-pill{
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 14px; border-radius: 999px;
  background: rgba(255,255,255,0.16); backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.24);
  font-family: var(--font-display); font-size: 12px; font-weight: 700;
}
.feh-pill.urgent{ background: #FFE600; color: #3E2E00; border-color: transparent; animation: fehUrgent 2s infinite; }
@keyframes fehUrgent{ 0%,100%{box-shadow:0 0 0 0 rgba(255,230,0,.5);} 50%{box-shadow:0 0 0 10px rgba(255,230,0,0);} }

.feh-hero-grid{
  /* 3-column hero. DOM order is [main, char, gauge]; RTL flips the
     visual order, so the student sees:
        → gauge (visual-left) · char (CENTRE) · main/title (visual-right)
     align-items: end pins the gauge and mascot to the bottom line. */
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(200px, 0.95fr) minmax(240px, 1fr);
  gap: 22px; align-items: end;
  position: relative; z-index: 2;
}
@media (max-width: 1100px){
  .feh-hero-grid{
    grid-template-columns: minmax(240px, 1fr) minmax(160px, 0.85fr) minmax(220px, 0.9fr);
    gap: 18px;
  }
}
@media (max-width: 920px){
  .feh-hero-grid{
    /* Collapse to single column: main (title) on top, char in the
       middle, gauge at the bottom. */
    grid-template-columns: 1fr;
    gap: 14px;
  }
}

.feh-hero-main{ display: flex; flex-direction: column; }
.feh-tag{
  display: inline-flex; align-items: center; gap: 6px; margin-bottom: 14px;
  font-family: var(--font-display); font-size: 11px; font-weight: 800;
  letter-spacing: .14em; color: #FFE600;
  text-transform: uppercase;
}
.feh-hero h1{
  /* Gateway-page H1 — same 900 / -.03em / 1.05 system as /, /vocabulary,
     /exam, and the reading-home kicker. Keeps every gateway's lead line
     at the same visual weight. */
  font-family: var(--font-display); font-weight: 900;
  font-size: clamp(28px, 4.2vw, 46px); letter-spacing: -0.03em; line-height: 1.05;
  margin-bottom: 14px; color: #fff;
}
.feh-hero h1 .accent{
  background: linear-gradient(90deg, #FFE600, #FFC72C, #FFE600);
  background-size: 200% 100%;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: fehShimmer 3s linear infinite;
}
@keyframes fehShimmer{ to{ background-position: 200% 0; } }
.feh-lede{
  /* Gateway-page lede — unified 15px / 1.55 across all 4 colored-hero pages. */
  font-size: 15px; line-height: 1.55; color: rgba(255,255,255,0.88);
  max-width: 540px; margin-bottom: 16px;
}
.feh-proof{
  display: inline-flex; align-items: center; gap: 8px; margin-bottom: 18px;
  padding: 9px 14px; border-radius: 16px;
  background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18);
  font-size: 12.5px; font-weight: 600; line-height: 1.5;
}
.feh-proof span{ color: #FFE600; font-weight: 800; }

/* Section chips — inline breakdown in hero */
.feh-chips{
  display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px;
}
.feh-chip{
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 12px; border-radius: 999px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.18);
  backdrop-filter: blur(8px);
  font-family: var(--font-display);
  font-size: 12.5px; font-weight: 700;
  color: #fff; line-height: 1.2;
}
.feh-chip b{ font-weight: 700; }
.feh-chip small{
  font-weight: 800; font-size: 11.5px;
  padding: 2px 7px; border-radius: 999px;
  background: rgba(255,230,0,0.2); color: #FFE600;
}
.feh-chip-ico{
  width: 22px; height: 22px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px;
  background: rgba(255,255,255,0.18);
}

.feh-ctas{ display: flex; gap: 10px; flex-wrap: wrap; }
.feh-btn-primary{
  background: #FFE600; color: #3E2E00;
  padding: 14px 26px; border-radius: 999px;
  border: 0; cursor: pointer;
  font-family: var(--font-display); font-weight: 800; font-size: 14px;
  display: inline-flex; align-items: center; gap: 8px;
  box-shadow: 0 10px 26px rgba(255,230,0,0.5);
  transition: transform .2s var(--ease), box-shadow .2s var(--ease);
  min-height: 48px;
}
.feh-btn-primary:hover{ transform: translateY(-2px) scale(1.02); box-shadow: 0 14px 32px rgba(255,230,0,0.6); }
.feh-btn-primary:active{ transform: scale(.96); }
.feh-btn-primary.big{ padding: 16px 32px; font-size: 16px; }
/* Wide + bold variant — the page's primary action, impossible to miss.
   Full-width, tall, bright gradient fill with glow pulse, navy body text. */
.feh-btn-primary-wide{
  width: 100%;
  justify-content: center;
  gap: 14px;
  padding: 26px 28px;
  min-height: 78px;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.015em;
  border-radius: 22px;
  border: 3px solid #FFB800;
  background: linear-gradient(135deg, #FFF3A0 0%, #FFE600 45%, #FFB800 100%);
  color: #0d294b;
  text-shadow: 0 1px 0 rgba(255,255,255,0.55);
  box-shadow:
    0 14px 38px rgba(255,184,0,0.55),
    0 0 56px rgba(255,230,0,0.4),
    inset 0 2px 8px rgba(255,255,255,0.55),
    inset 0 -4px 10px rgba(255,184,0,0.32);
  animation: fehWideCtaPulse 2.6s ease-in-out infinite;
  margin-top: 4px;
}
.feh-btn-primary-wide:hover{
  transform: translateY(-3px) scale(1.015);
  box-shadow:
    0 20px 48px rgba(255,184,0,0.7),
    0 0 72px rgba(255,230,0,0.6),
    inset 0 2px 8px rgba(255,255,255,0.65),
    inset 0 -4px 10px rgba(255,184,0,0.4);
}
.feh-btn-primary-wide:active{ transform: scale(.98); }
.feh-btn-primary-wide svg{ width: 24px; height: 24px; flex-shrink: 0; }
@keyframes fehWideCtaPulse{
  0%, 100% {
    box-shadow:
      0 14px 38px rgba(255,184,0,0.55),
      0 0 56px rgba(255,230,0,0.4),
      inset 0 2px 8px rgba(255,255,255,0.55),
      inset 0 -4px 10px rgba(255,184,0,0.32);
  }
  50% {
    box-shadow:
      0 18px 52px rgba(255,184,0,0.75),
      0 0 80px rgba(255,230,0,0.65),
      0 0 0 6px rgba(255,230,0,0.22),
      inset 0 2px 8px rgba(255,255,255,0.65),
      inset 0 -4px 10px rgba(255,184,0,0.4);
  }
}
@media (max-width: 640px){
  .feh-btn-primary-wide{ font-size: 18px; min-height: 68px; padding: 22px 20px; }
  .feh-btn-primary-wide svg{ width: 20px; height: 20px; }
}

/* ═══ GAUGE CARD ═══
   Compacted so the mascot can sit below it without overlap:
   — tighter padding (16/18px instead of 22/24)
   — gauge SVG capped at 260px max-width (was full 320)
   — smaller score number (40px instead of 48)
   — tighter margins between sections                                    */
.feh-gauge-card{
  background: rgba(255,255,255,0.1); backdrop-filter: blur(18px);
  border: 1px solid rgba(255,255,255,0.22); border-radius: 24px;
  padding: 16px 18px 14px; color: #fff; position: relative;
  width: 100%;
  /* Centre the gauge card in its grid column. */
  justify-self: center;
  align-self: end;
}
.feh-gauge-head{ text-align: center; margin-bottom: 2px; }
.feh-gauge-head b{ font-family: var(--font-display); font-size: 14px; font-weight: 800; display: block; }
.feh-gauge-head small{ font-size: 10.5px; color: rgba(255,255,255,0.65); letter-spacing: .04em; }
.feh-gauge{
  width: 100%; max-width: 260px; height: auto; display: block; margin: 0 auto;
}
.feh-gauge-score{
  text-align: center; margin-top: -14px;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.feh-gauge-score b{
  font-family: var(--font-display); font-size: 40px; font-weight: 800; line-height: 1;
  letter-spacing: -0.03em;
}
.feh-gauge-band{
  display: inline-block; font-family: var(--font-display); font-size: 11px; font-weight: 800;
  padding: 4px 10px; border-radius: 999px; color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.15);
}
.feh-gauge-foot{
  margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.16);
  text-align: center; font-size: 12px; line-height: 1.5;
}
.feh-gauge-foot b{ color: #FFE600; font-weight: 800; }
.feh-gauge-next{ opacity: .7; }

/* ═══ STATS STRIP ═══ */
.feh-stats{
  margin: 20px 16px 0; display: grid;
  grid-template-columns: repeat(4, 1fr); gap: 12px;
}
@media (max-width: 720px){ .feh-stats{ grid-template-columns: repeat(2, 1fr); } }
.feh-stat{
  background: #fff; border-radius: 20px; padding: 16px 18px;
  border: 1px solid rgba(0,0,0,0.06);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  display: flex; flex-direction: column; gap: 4px;
  transition: transform .2s var(--ease);
}
.feh-stat:hover{ transform: translateY(-2px); }
.feh-stat .lbl{ font-size: 10px; font-weight: 800; color: #6B7280; letter-spacing: .14em; text-transform: uppercase; font-family: var(--font-display); }
.feh-stat b{ font-family: var(--font-display); font-size: 28px; font-weight: 800; line-height: 1; color: #0d294b; letter-spacing: -0.02em; }
.feh-stat b small{ font-size: 14px; opacity: 0.7; font-weight: 700; }
.feh-stat .sub{ font-size: 11px; color: #9CA3AF; font-weight: 600; }

/* ═══ SECTION HEAD ═══ */
.feh-shead{ margin: 32px 16px 12px; display: flex; flex-direction: column; gap: 2px; }
.feh-shead.inline{ flex-direction: row; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.feh-shead h2{ font-family: var(--font-display); font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #0d294b; }
.feh-shead small{ font-size: 12px; color: #6B7280; font-weight: 600; }

/* ═══ SECTIONS BREAKDOWN ═══ */
.feh-sections{
  margin: 0 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
}
@media (max-width: 820px){ .feh-sections{ grid-template-columns: 1fr; } }
.feh-sec{
  background: #fff; border-radius: 24px; padding: 18px 20px;
  border: 2px solid rgba(0,0,0,0.06);
  display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center;
  transition: all .2s var(--ease); cursor: default;
}
.feh-sec:hover{ border-color: var(--sc-accent); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.08); }
.feh-sec-ico{
  width: 48px; height: 48px; border-radius: 14px;
  background: var(--sc-bg); color: var(--sc-accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
}
.feh-sec-body b{ font-family: var(--font-display); font-size: 15px; font-weight: 800; color: #0d294b; display: block; }
.feh-sec-body small{ font-size: 11px; color: #9CA3AF; font-weight: 600; }
.feh-sec-meta{ text-align: center; }
.feh-sec-meta .count{
  display: block; font-family: var(--font-display); font-size: 22px; font-weight: 800;
  color: var(--sc-accent); line-height: 1;
}
.feh-sec-meta small{ font-size: 10px; color: #9CA3AF; font-weight: 600; }

/* ═══ RULES ═══ */
.feh-rules{
  margin: 24px 16px 0; padding: 22px; border-radius: 28px;
  background: #FDF4FF; border: 1px solid rgba(139,92,246,0.18);
}
.feh-rules h3{
  font-family: var(--font-display); font-size: 18px; font-weight: 800;
  color: #5B21B6; margin-bottom: 14px; letter-spacing: -0.01em;
}
.feh-rules-grid{
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
}
@media (max-width: 820px){ .feh-rules-grid{ grid-template-columns: repeat(2, 1fr); } }
.feh-rule{
  background: #fff; border-radius: 18px; padding: 16px 14px; text-align: center;
  border: 1px solid rgba(0,0,0,0.05); transition: transform .2s var(--ease);
}
.feh-rule:hover{ transform: translateY(-2px); }
.feh-rule .ico{ font-size: 28px; display: block; margin-bottom: 8px; }
.feh-rule b{ font-family: var(--font-display); font-size: 14px; font-weight: 800; color: #0d294b; display: block; margin-bottom: 4px; }
.feh-rule small{ font-size: 11px; color: #6B7280; font-weight: 600; line-height: 1.4; }

/* ═══ RECENT ═══ */
.feh-recent{ margin: 0 16px; padding: 22px; border-radius: 28px; background: #fff; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 4px 14px rgba(0,0,0,0.04); }
.feh-trend{
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 11px; border-radius: 999px; font-family: var(--font-display);
  font-size: 12px; font-weight: 800;
}
.feh-trend.up{ background: #D1FAE5; color: #065F46; }
.feh-trend.down{ background: #FEE2E2; color: #991B1B; }
.feh-recent-list{ display: flex; flex-direction: column; gap: 10px; }
.feh-recent-row{
  display: grid; grid-template-columns: 70px 60px 1fr 56px; gap: 10px; align-items: center;
  padding: 10px 14px; border-radius: 14px; background: #F9FAFB;
  border: 1px solid rgba(0,0,0,0.04);
  transition: transform .15s var(--ease);
}
.feh-recent-row:hover{ transform: translateX(-2px); }
.feh-recent-row .date{ font-size: 12px; color: #6B7280; font-weight: 700; font-family: var(--font-display); }
.feh-recent-row .qs{ font-size: 12px; color: #0d294b; font-weight: 800; font-family: var(--font-display); }
.feh-recent-row .bar{ height: 7px; background: #E5E7EB; border-radius: 999px; overflow: hidden; }
.feh-recent-row .bar > div{ height: 100%; border-radius: 999px; transition: width .6s var(--ease); }
.feh-recent-row .pct{ font-family: var(--font-display); font-size: 14px; font-weight: 800; text-align: end; }
.feh-recent-row.s-excellent .bar > div{ background: linear-gradient(90deg, #06B6D4, #10B981); }
.feh-recent-row.s-excellent .pct{ color: #06B6D4; }
.feh-recent-row.s-good .bar > div{ background: linear-gradient(90deg, #10B981, #F59E0B); }
.feh-recent-row.s-good .pct{ color: #10B981; }
.feh-recent-row.s-warn .bar > div{ background: #F59E0B; }
.feh-recent-row.s-warn .pct{ color: #F59E0B; }
.feh-recent-row.s-low .bar > div{ background: #EF4444; }
.feh-recent-row.s-low .pct{ color: #EF4444; }

/* ═══ TIPS ═══ */
.feh-tips{
  margin: 0 16px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
}
@media (max-width: 720px){ .feh-tips{ grid-template-columns: 1fr; } }
.feh-tip{
  background: #fff; border-radius: 22px; padding: 18px 20px;
  border: 1px solid rgba(0,0,0,0.05);
  display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: start;
  transition: transform .2s var(--ease);
}
.feh-tip:hover{ transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.06); }
.feh-tip .num{
  width: 36px; height: 36px; border-radius: 50%;
  background: linear-gradient(135deg, #8B5CF6, #EC4899);
  color: #fff; font-family: var(--font-display); font-weight: 800; font-size: 16px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 10px rgba(139,92,246,0.3);
}
.feh-tip b{ font-family: var(--font-display); font-size: 14px; font-weight: 800; color: #0d294b; display: block; margin-bottom: 4px; }
.feh-tip small{ font-size: 12.5px; color: #6B7280; font-weight: 500; line-height: 1.55; display: block; }

/* ═══ FINAL CTA ═══ */
.feh-final{
  margin: 28px 16px 0; padding: 32px 28px;
  border-radius: 32px; position: relative; overflow: hidden;
  background:
    radial-gradient(circle at 85% 20%, rgba(255,230,0,0.28), transparent 55%),
    linear-gradient(135deg, #0d294b 0%, #5B21B6 60%, #EC4899 110%);
  color: #fff;
  display: grid; grid-template-columns: auto 1fr; gap: 22px; align-items: center;
  box-shadow: 0 20px 50px -20px rgba(13,41,75,0.5);
}
@media (max-width: 620px){ .feh-final{ grid-template-columns: 1fr; text-align: center; } }
.feh-final-char{
  width: clamp(100px, 18vw, 150px); height: auto; filter: drop-shadow(0 10px 18px rgba(0,0,0,0.3));
}
@media (max-width: 620px){ .feh-final-char{ width: 110px; margin: 0 auto; } }
.feh-final h3{ font-family: var(--font-display); font-size: clamp(20px, 3vw, 28px); font-weight: 800; letter-spacing: -0.02em; margin-bottom: 8px; }
.feh-final p{ font-size: 14px; color: rgba(255,255,255,0.82); margin-bottom: 16px; line-height: 1.5; }

/* ═══ TOOLTIPS (smart mouseover) ═══ */
[data-tip]{ position: relative; }
[data-tip]::before, [data-tip]::after{
  position: absolute; pointer-events: none;
  opacity: 0; transform: translateX(50%) translateY(6px);
  transition: opacity .18s var(--ease-out), transform .18s var(--ease-out);
  z-index: 100;
}
[data-tip]::before{
  content: attr(data-tip);
  bottom: calc(100% + 10px); right: 50%;
  background: #0d294b; color: #fff;
  padding: 9px 13px; border-radius: 10px;
  font-family: var(--font-display); font-size: 11.5px; font-weight: 600;
  line-height: 1.5; text-align: center;
  white-space: normal; width: max-content; max-width: 260px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.3);
}
[data-tip]::after{
  content: ""; bottom: calc(100% + 4px);
  right: 50%; width: 0; height: 0;
  border: 6px solid transparent; border-top-color: #0d294b;
}
[data-tip]:hover::before, [data-tip]:hover::after,
[data-tip]:focus-visible::before, [data-tip]:focus-visible::after{
  opacity: 1; transform: translateX(50%) translateY(0);
}
@media (max-width: 640px){ [data-tip]::before, [data-tip]::after{ display: none; } }

/* ═══ MOBILE ═══ */
@media (max-width: 720px){
  .feh-hero{ padding: 24px 18px 22px; margin: 12px 12px 18px; border-radius: 26px; }
  .feh-hero h1{ font-size: clamp(24px, 7vw, 32px); }
  .feh-lede{ font-size: 14px; }
  .feh-proof{ font-size: 12px; padding: 8px 12px; }
  .feh-ctas{ gap: 8px; }
  .feh-btn-primary{ font-size: 14px; padding: 13px 22px; min-height: 48px; width: 100%; justify-content: center; }
  .feh-btn-primary.big{ font-size: 15px; padding: 14px 26px; }
  .feh-gauge-card{ padding: 18px 16px; border-radius: 24px; }
  .feh-gauge-score b{ font-size: 40px; }
  .feh-stats{ margin: 18px 12px 0; gap: 10px; }
  .feh-stat{ padding: 14px; border-radius: 18px; }
  .feh-stat b{ font-size: 24px; }
  .feh-shead{ margin: 26px 12px 10px; }
  .feh-shead h2{ font-size: 18px; }
  .feh-sections, .feh-rules, .feh-recent, .feh-tips{ margin-left: 12px; margin-right: 12px; }
  .feh-rules{ padding: 18px; border-radius: 24px; }
  .feh-final{ padding: 24px 20px; margin: 22px 12px 0; border-radius: 28px; }
}
@media (max-width: 480px){
  .feh-hero{ padding: 20px 14px 18px; margin: 10px 10px 14px; }
  .feh-hero h1{ font-size: clamp(22px, 7.5vw, 28px); }
  .feh-hero-top{ margin-bottom: 14px; }
  .feh-back{ font-size: 12px; padding: 6px 12px; }
  .feh-pill{ font-size: 11px; padding: 5px 10px; }
  .feh-tag{ font-size: 10px; }
  .feh-section-crown{ padding: 11px 18px 11px 14px; gap: 12px; }
  .feh-section-crown-ico{ width: 36px; height: 36px; }
  .feh-section-crown-ico svg{ width: 22px; height: 22px; }
  .feh-section-crown-text small{ font-size: 9.5px; letter-spacing: 0.16em; }
  .feh-section-crown-text b{ font-size: 20px; }
  .feh-section-crown-sub{ font-size: 13px; }
  .feh-page-intro{ margin-bottom: 16px; }
  .feh-page-subtitle{ font-size: 14.5px; margin-top: 10px; max-width: none; }
}
`
