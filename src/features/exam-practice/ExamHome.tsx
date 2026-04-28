import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useExamStore } from '../../stores/examStore'
import { useGamificationStore } from '../../stores/gamificationStore'
import { useStudentProfileStore } from '../../stores/studentProfileStore'
import { useCoachStore } from '../../stores/coachStore'
import { asset } from '../../utils/assetUrl'
import { TypingHeadline } from '../../components/common/TypingHeadline'
import { g } from '../../utils/gender'
import { playSound } from '../../utils/sounds'

/* ═══════════════════════════════════════════════════════════════════
   EXAM HOME · MATERIAL YOU × ZINUK
   Built for encouragement, not just information. Every element was
   designed around a single question: will this make the student
   practice one more question?
   ═══════════════════════════════════════════════════════════════════ */

const MD = {
  bg: '#FAF3F6',
  surface: '#FFFFFF',
  container: '#F6E4EC',
  containerLo: '#EFD5DF',
  containerHi: '#FBEDF2',
  onSurface: '#1C1015',
  onSurfaceVar: '#52434B',
  primary: '#EE2B73',
  primaryContainer: '#FFD6E4',
  primaryBright: '#FF3D82',
  secondary: '#0d294b',
  tertiary: '#FFE600',
  tertiaryHi: '#FFC72C',
  success: '#06A66B',
  successContainer: '#CFEEE0',
  warning: '#D97706',
  warningContainer: '#FEE8C2',
  error: '#BA1A1A',
  errorContainer: '#FFDAD6',
  purple: '#6750A4',
  purpleBright: '#9333EA',
} as const

function daysUntilExam(examDate: string | null): number | null {
  if (!examDate) return null
  const d = new Date(examDate).getTime()
  if (!Number.isFinite(d)) return null
  const diff = Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : null
}

export function ExamHome() {
  const navigate = useNavigate()
  const { getAverageScore, getAttemptsByType, getRecentAttempts } = useExamStore()
  const { currentStreak, xp } = useGamificationStore()
  const { studentName, examDate } = useStudentProfileStore()
  const coachPlan = useCoachStore((s) => s.dailyPlan)

  const recentAttempts = getRecentAttempts(5)
  const scAvg = getAverageScore('sc')
  const restAvg = getAverageScore('restatement')
  const rcAvg = getAverageScore('rc')
  const fullAvg = getAverageScore('full')
  const scAttempts = getAttemptsByType('sc').length
  const restAttempts = getAttemptsByType('restatement').length
  const rcAttempts = getAttemptsByType('rc').length
  const totalAttempts = scAttempts + restAttempts + rcAttempts + getAttemptsByType('full').length
  const currentScore = fullAvg || Math.round((scAvg + restAvg + rcAvg) / 3) || 0
  const daysLeft = daysUntilExam(examDate)
  // All exam-practice missions in the student's plan (SC + Restatement, +
  // any future RC type). We show the full set so the student can see what's
  // ahead + what's done, not just the next active one.
  const allExamMissions = (coachPlan?.missions || []).filter(
    (m) => m.type === 'exam_sc' || m.type === 'exam_restatement',
  )
  const examMissionsDone = allExamMissions.filter((m) => m.status === 'completed').length
  const examMissionsTotal = allExamMissions.length
  const activeExamMission = allExamMissions.find((m) => m.status !== 'completed' && m.status !== 'locked')
  // Kept for backwards-compat with existing "today mission" CTA below.
  const examMission = activeExamMission

  // Animate donut on mount
  const [donutOffset, setDonutOffset] = useState(314)
  useEffect(() => {
    const t = setTimeout(() => setDonutOffset(314 - (314 * currentScore) / 100), 400)
    return () => clearTimeout(t)
  }, [currentScore])

  // Stats deltas (synthetic for now — the store has the raw numbers)
  const recentDelta = useMemo(() => {
    if (recentAttempts.length < 2) return null
    const latest = recentAttempts[0]
    const prev = recentAttempts[recentAttempts.length - 1]
    const latestPct = Math.round((latest.score / latest.totalQuestions) * 100)
    const prevPct = Math.round((prev.score / prev.totalQuestions) * 100)
    return latestPct - prevPct
  }, [recentAttempts])

  const name = studentName || g('תלמיד', 'תלמידה')

  return (
    <div className="eh" style={{ margin: -16 }}>
      <style>{cssBlock}</style>

      {/* ═══ HERO ═══ */}
      <section className="eh-hero fade-up">
        <div className="eh-sparkles" aria-hidden="true">
          <i /><i /><i /><i /><i /><i />
        </div>
        <div className="eh-hero-grid">
          <div>
            {/* Page intro — crown only; the subtitle paragraph was
                redundant next to the h1 + section chips below. */}
            <div className="eh-page-intro">
              <div className="eh-section-crown" aria-label="אזור שאלות בחינה">
                <div className="eh-section-crown-ico" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="1" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </div>
                <div className="eh-section-crown-text">
                  <small>אמירנט · אזור תרגול</small>
                  <b>תרגול שאלות בחינה</b>
                </div>
              </div>
            </div>

            {daysLeft !== null && (
              <div className="eh-meta-row">
                <span className="eh-pill urgent">⏳ {daysLeft} ימים לבחינה</span>
              </div>
            )}
            <h1 className="eh-title">
              {name}, <span className="accent">כל שאלה</span> פה =<br />
              טעות פחות בבחינה.
            </h1>
            <p className="eh-lede">
              זה לא מבחן. זה שדה אימונים. פה בונים את האינטואיציה {g('שתיתן', 'שתיתן')} {g('לך', 'לך')} תשובות
              נכונות גם כשהשעון לוחץ. משוב מיידי, רמה שמטפסת {g('איתך', 'איתך')}, ואפס בירוקרטיה.
            </p>
            <div className="eh-ctas">
              {/* The "continue where you left off" CTA was removed per
                  product feedback — it routed students back into a
                  partially-completed SC session and felt punishing
                  rather than progressive. The "real exam chapter
                  practice" CTA below now stands alone, and the
                  per-mission CTA further down handles "next mission".
                  See the in-progress practice via the missions list. */}
              <button className="eh-btn-ghost" onClick={() => navigate('/exam/full/start')}>תרגול פרק בחינה אמיתי ←</button>
            </div>
          </div>

          {/* Score card */}
          <div className="eh-score">
            <div className="eh-score-top">
              <div className="donut">
                <svg viewBox="0 0 120 120">
                  <defs>
                    <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFE600" />
                      <stop offset="100%" stopColor="#FF8C42" />
                    </linearGradient>
                  </defs>
                  <circle className="track" cx="60" cy="60" r="50" />
                  <circle
                    className="fill"
                    cx="60" cy="60" r="50"
                    strokeDasharray="314"
                    strokeDashoffset={donutOffset}
                  />
                </svg>
                <div className="center">
                  <b>{currentScore}%</b>
                  <span>ציון נוכחי</span>
                </div>
              </div>
              <div className="eh-score-info">
                <h4>
                  {currentScore >= 85
                    ? 'רמה של פטור — תחזיק שם.'
                    : currentScore >= 70
                    ? `עוד ${Math.max(85 - currentScore, 4)} נקודות לפטור`
                    : 'כל תרגול מעלה ציון.'}
                </h4>
                <p>
                  {totalAttempts > 0
                    ? `סיימת ${totalAttempts} ניסיונות עד עכשיו. עוד קצת וזה מתכנס.`
                    : g('טרם תורגל. בוא נתחיל.', 'טרם תורגלה. בואי נתחיל.')}
                </p>
                {recentDelta !== null && (
                  <span className={`eh-trend ${recentDelta >= 0 ? 'up' : 'down'}`}>
                    {recentDelta >= 0 ? '↑' : '↓'} {Math.abs(recentDelta)} נק׳ לאחרונה
                  </span>
                )}
              </div>
            </div>
            <div className="eh-streak-row">
              <div className="eh-streak">
                <span className="flame">🔥</span>
                <div>
                  <b>{currentStreak}</b>
                  <span>ימים ברצף</span>
                </div>
              </div>
              <div className="eh-streak alt">
                <span className="spark">⚡</span>
                <div>
                  <b>{xp.toLocaleString()}</b>
                  <span>נקודות זינוק</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* My exam missions — always visible so the student can see what's
            on their plate in the exam-questions track and jump in fast.
            Shows up-to-3 missions inline + a primary CTA on the active one. */}
        <div className="eh-today-row">
          <div className="eh-today eh-mymissions">
            <div className="eh-mm-head">
              <span className="eh-today-tag">
                <span className="live" />
                {examMissionsTotal > 0 ? 'המשימות שלך בשאלות בחינה' : 'משימות שאלות בחינה'}
              </span>
              {examMissionsTotal > 0 && (
                <span className="eh-mm-count">
                  {examMissionsDone}/{examMissionsTotal} הושלמו
                </span>
              )}
            </div>

            {examMissionsTotal > 0 ? (
              <>
                <ul className="eh-mm-list">
                  {allExamMissions.slice(0, 3).map((m) => {
                    const done = m.status === 'completed'
                    const locked = m.status === 'locked'
                    const active = !done && !locked && m.id === activeExamMission?.id
                    return (
                      <li key={m.id} className={`eh-mm-item ${done ? 'done' : ''} ${locked ? 'locked' : ''} ${active ? 'active' : ''}`}>
                        <span className="eh-mm-dot" aria-hidden="true">
                          {done ? '✓' : locked ? '🔒' : active ? '▶' : '·'}
                        </span>
                        <div className="eh-mm-text">
                          <b>{m.title}</b>
                          {m.subtitle && <small>{m.subtitle}</small>}
                        </div>
                        <span className="eh-mm-time">~{m.estimatedMinutes || 10} דק׳</span>
                      </li>
                    )
                  })}
                </ul>
                {activeExamMission ? (
                  <button
                    className="eh-today-cta znk-cta-primary znk-tooltip"
                    onClick={() => {
                      playSound('click')
                      try { localStorage.setItem('znk-active-mission', activeExamMission.id) } catch { /* ok */ }
                      // Defensive routing: a malformed coach plan can come
                      // back from the worker with an empty `route` field —
                      // the original onClick then called navigate('') which
                      // is a silent no-op. Fall back to the SC track so
                      // the CTA always takes the student somewhere useful.
                      const fallbackByType: Record<string, string> = {
                        exam_sc: '/exam/sc',
                        exam_restatement: '/exam/restatement',
                      }
                      const route = (activeExamMission.route && activeExamMission.route.trim())
                        || fallbackByType[activeExamMission.type]
                        || '/exam/sc'
                      if (activeExamMission.routeParams && Object.keys(activeExamMission.routeParams).length > 0) {
                        const qs = new URLSearchParams(activeExamMission.routeParams).toString()
                        navigate(`${route}?${qs}`)
                      } else {
                        navigate(route)
                      }
                    }}
                  >
                    <span className="znk-tip" data-placement="bottom" role="tooltip">
                      המשימה הבאה שלך — מותאמת לרמה ולמסלול שלך כרגע
                    </span>
                    <span>{g('להתחיל את המשימה הבאה', 'להתחיל את המשימה הבאה')}</span>
                    {/* Arrow LEFT — forward direction in RTL */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
                  </button>
                ) : (
                  <div className="eh-mm-empty">
                    <span>כל משימות שאלות הבחינה של היום הושלמו 🎉</span>
                    <button
                      className="eh-mm-empty-cta"
                      onClick={() => { playSound('click'); navigate('/exam/sc') }}
                      onMouseEnter={() => playSound('hover')}
                    >
                      {/* Left arrow = forward in RTL */}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
                      <span>⚡ תרגול חופשי</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="eh-mm-fallback">
                  {g(
                    'אין לך עדיין משימות שאלות בחינה בתוכנית. אפשר להתחיל תרגול חופשי עכשיו, או לפתוח את המאמן ולקבוע תוכנית מותאמת.',
                    'אין לך עדיין משימות שאלות בחינה בתוכנית. אפשר להתחיל תרגול חופשי עכשיו, או לפתוח את המאמן ולקבוע תוכנית מותאמת.',
                  )}
                </p>
                <div className="eh-mm-fallback-ctas">
                  <button className="eh-today-cta" onClick={() => navigate('/exam/sc')}>
                    {g('להתחיל תרגול', 'להתחיל תרגול')}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                  </button>
                  <button className="eh-mm-empty-cta" onClick={() => navigate('/journey')}>
                    פתיחת תוכנית עם המאמן ←
                  </button>
                </div>
              </>
            )}
          </div>
          <img
            className="eh-today-char"
            src={asset('char-psicho.png')}
            alt=""
            aria-hidden="true"
          />
        </div>
      </section>

      {/* ═══ SECTION HEAD ═══ */}
      <div className="eh-shead fade-up d2">
        <div>
          <h2>{g('בחר סוג שאלה — וצלול פנימה', 'בחרי סוג שאלה — וצללי פנימה')}</h2>
          <p className="sub">כל סוג מאמן שריר אחר. אל תדלג על אף אחד.</p>
        </div>
        <span className="eh-count">3 סוגים · 22 שאלות</span>
      </div>

      {/* ═══ SECTION CARDS ═══ */}
      <section className="eh-cards">
        <SectionCard
          color="sc"
          icon="✏️"
          title="השלמת משפטים"
          en="Sentence Completion"
          difficulty="easy"
          difficultyLabel="רמה · קל"
          description={g(
            'תשלים את המשפט עם המילה הנכונה. פה אתה הכי חזק — וכדאי להפוך את זה להרגל.',
            'תשלימי את המשפט עם המילה הנכונה. פה את הכי חזקה — וכדאי להפוך את זה להרגל.',
          )}
          questionCount={8}
          avgScore={scAvg}
          attempts={scAttempts}
          bestBadge={scAttempts > 0 && scAvg >= 75 ? `🏆 שיא · ${scAvg}%` : null}
          onClick={() => navigate('/exam/sc')}
        />
        <SectionCard
          color="restatement"
          icon="🔄"
          title="ניסוח מחדש"
          en="Restatement"
          difficulty="med"
          difficultyLabel="רמה · בינוני"
          description="המשפט אותו משפט — מבנה אחר. החלק שמעלה הכי הרבה נקודות ב-30 הימים הבאים."
          questionCount={4}
          avgScore={restAvg}
          attempts={restAttempts}
          hotBadge={restAttempts === 0 || (restAttempts < 3) ? '💡 הזדמנות השבוע' : null}
          onClick={() => navigate('/exam/restatement')}
        />
        <SectionCard
          color="rc"
          icon="📖"
          title="הבנת הנקרא"
          en="Reading Comprehension"
          difficulty="hard"
          difficultyLabel="רמה · מתקדם"
          description="החלק הכי ארוך בבחינה — והזה שמכריע את הציון. כל שאלה פה = שאלה שפחות תפתיע שם."
          questionCount={10}
          avgScore={rcAvg}
          attempts={rcAttempts}
          onClick={() => navigate('/exam/rc')}
        />
      </section>

      {/* ═══ FULL EXAM CTA ═══ */}
      <article className="eh-full fade-up d3" onClick={() => navigate('/exam/full')}>
        <div className="eh-full-inner">
          <div>
            <span className="eh-full-badge">🚀 הדבר האמיתי</span>
            <h3>תרגול פרק בחינה אמיתי — בתנאי אמירנט.</h3>
            <p className="desc">22 שאלות. 20 דקות. טיימר אמיתי, אפס רמזים, ציון מדויק. המעבר מדמה לביטחון אמיתי.</p>
            <div className="eh-full-proof">
              🧠 <span>מחקר:</span> פתרון תחת <b>תנאי מבחן אמיתיים</b> — אפס רמזים, טיימר, ציון — מחזק זיכרון לטווח ארוך יותר מחזרה רגילה <span className="eh-full-cite">(Roediger &amp; Karpicke, Wash. Univ. 2006)</span>.
            </div>
            <div className="eh-full-ctas">
              <button className="eh-full-btn-primary znk-tooltip" onClick={(e) => { e.stopPropagation(); navigate('/exam/full') }}>
                <span className="znk-tip" data-placement="top" role="tooltip">
                  פותח את מסך הקדם-בחינה — שם בודקים פרטים ומתחילים
                </span>
                {g('התחל עכשיו', 'התחילי עכשיו')}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              </button>
            </div>
          </div>
          <div className="eh-full-preview">
            <h5>מה יש בפנים</h5>
            <div className="row"><b>השלמת משפטים</b><span className="count">8 ש׳</span></div>
            <div className="row"><b>ניסוח מחדש</b><span className="count">4 ש׳</span></div>
            <div className="row"><b>הבנת הנקרא</b><span className="count">10 ש׳</span></div>
            <div className="row"><b>משך זמן</b><span className="count">20 דק׳</span></div>
            <div className="row"><b>תגמול</b><span className="count">+120 XP</span></div>
          </div>
        </div>
      </article>

      {/* ═══ STATS BAR ═══ */}
      <section className="eh-stats fade-up d4">
        <div className="sbi">
          <span className="label">שאלות פתרת</span>
          <b>{totalAttempts * 8}</b>
          {totalAttempts > 0 && <span className="delta">+{Math.min(totalAttempts * 2, 50)} השבוע</span>}
        </div>
        <div className="sbi">
          <span className="label">דיוק ממוצע</span>
          <b>{currentScore}%</b>
          {recentDelta !== null && (
            <span className={`delta ${recentDelta < 0 ? 'warn' : ''}`}>
              {recentDelta >= 0 ? '+' : ''}{recentDelta}% לאחרונה
            </span>
          )}
        </div>
        <div className="sbi">
          <span className="label">רצף ימים</span>
          <b>{currentStreak}</b>
          {currentStreak > 0 && <span className="delta">🔥 אל תשבור</span>}
        </div>
        <div className="sbi">
          <span className="label">נקודות זינוק</span>
          <b>{xp.toLocaleString()}</b>
          <span className="delta">⚡ צבור עוד</span>
        </div>
      </section>

      {/* ═══ RECENT RESULTS ═══ */}
      {recentAttempts.length > 0 && (
        <section className="eh-results fade-up d5">
          <div className="head">
            <h2>📊 מה קרה לאחרונה?</h2>
            <button className="all" onClick={() => navigate('/journey')}>{g('הצג הכל', 'הציגי הכל')} ←</button>
          </div>
          {recentAttempts.map((a) => {
            const pct = Math.round((a.score / a.totalQuestions) * 100)
            const cls = pct >= 70 ? '' : pct >= 50 ? 'warn' : 'lose'
            const meta: Record<string, { icon: string; label: string; color: string }> = {
              sc: { icon: '✏️', label: 'השלמת משפטים', color: 'sc' },
              rc: { icon: '📖', label: 'הבנת הנקרא', color: 'rc' },
              restatement: { icon: '🔄', label: 'ניסוח מחדש', color: 'restatement' },
              full: { icon: '🚀', label: 'פרק בחינה אמיתי', color: 'full' },
            }
            const m = meta[a.type] || meta.full
            return (
              <div key={a.id} className={`eh-result-row c-${m.color}`}>
                <div className="ico">{m.icon}</div>
                <div>
                  <h4>{m.label}</h4>
                  <small>
                    {a.score}/{a.totalQuestions} נכונות ·{' '}
                    {new Date(a.completedAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                  </small>
                </div>
                <span className={`score ${cls}`}>{pct}%</span>
              </div>
            )
          })}
        </section>
      )}

      {/* ═══ MOTIVATIONAL ═══ */}
      <section className="eh-mot fade-up d6">
        <span className="q">"</span>
        <p>
          אין דבר כזה ״לא יודע״. יש רק ״עוד לא תרגלתי מספיק״. כל שאלה שפותרים היום היא ערוץ
          שנפתח במוח — וצריך לפתוח הרבה.
          <span>— צוות זינוק · הטיפ של היום</span>
        </p>
      </section>
    </div>
  )
}

/* ─── Section Card subcomponent ──────────────────────────────── */

interface SectionCardProps {
  color: 'sc' | 'restatement' | 'rc'
  icon: string
  title: string
  en: string
  difficulty: 'easy' | 'med' | 'hard'
  difficultyLabel: string
  description: string
  questionCount: number
  avgScore: number
  attempts: number
  bestBadge?: string | null
  hotBadge?: string | null
  onClick: () => void
}

function SectionCard({
  color, icon, title, en, difficulty, difficultyLabel, description,
  questionCount, avgScore, attempts, bestBadge, hotBadge, onClick,
}: SectionCardProps) {
  return (
    <article className={`eh-scard c-${color}`} onClick={onClick}>
      <div className="ico">{icon}</div>
      <div>
        <div className="row1">
          <h3>{title}</h3>
          <span className={`chip ${difficulty}`}>{difficultyLabel}</span>
          {bestBadge && <span className="chip streak">{bestBadge}</span>}
          {hotBadge && <span className="chip hot">{hotBadge}</span>}
        </div>
        <p className="subtitle" dir="ltr">{en}</p>
        <p className="desc">{description}</p>
        <div className="meta">
          <span className="pill">📝 {questionCount} שאלות</span>
          {attempts > 0 ? (
            <span className={`pill ${avgScore >= 70 ? 'win' : avgScore >= 50 ? 'warn' : 'lose'}`}>
              📊 {avgScore}% ממוצע
            </span>
          ) : (
            <span className="pill fresh">🟢 טרם תורגל</span>
          )}
          <span className="pill">⏱ ~{Math.max(4, Math.round(questionCount * 0.8))} דק׳</span>
        </div>
        {attempts > 0 && (
          <div className="progress"><div style={{ width: `${avgScore}%` }} /></div>
        )}
      </div>
      <div className="go">→</div>
    </article>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   CSS — Material You × ZINUK
   ═══════════════════════════════════════════════════════════════════ */

const cssBlock = `
.eh{
  --md-bg: #FAF3F6; --md-surface: #FFFFFF; --md-container: #F6E4EC;
  --md-container-lo: #EFD5DF; --md-container-hi: #FBEDF2;
  --md-on-surface: #1C1015; --md-on-surface-var: #52434B;
  --md-primary: #EE2B73; --md-primary-container: #FFD6E4; --md-primary-bright: #FF3D82;
  --md-secondary: #0d294b; --md-tertiary: #FFE600; --md-tertiary-hi: #FFC72C;
  --md-success: #06A66B; --md-success-container: #CFEEE0;
  --md-warning: #D97706; --md-warning-container: #FEE8C2;
  --md-error: #BA1A1A; --md-error-container: #FFDAD6;
  --purple: #6750A4;
  --ease: cubic-bezier(0.2, 0, 0, 1);
  --bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  background: var(--md-bg); color: var(--md-on-surface);
  min-height: 100dvh; padding-bottom: 80px;
  position: relative;
  /* overflow-x: clip — NOT hidden — because overflow-x:hidden + default
     overflow-y:visible forces the browser to compute overflow-y as auto
     per CSS spec, which makes .eh a nested scroll container. On mobile
     that steals the initial page scroll on first load. clip hides overflow
     WITHOUT creating a scroll context. */
  overflow-x: clip;
}
.eh::before, .eh::after{
  content: ""; position: absolute; pointer-events: none; z-index: 0;
  border-radius: 50%; filter: blur(120px);
}
.eh::before{ width: 600px; height: 600px; background: radial-gradient(circle, rgba(238,43,115,0.24), transparent 65%); top: -200px; right: -130px; }
.eh::after{ width: 520px; height: 520px; background: radial-gradient(circle, rgba(255,199,44,0.22), transparent 65%); bottom: -180px; left: -140px; }
.eh > * { position: relative; z-index: 1; }

/* ── Entrance ── Elements are ALWAYS visible by default (opacity:1). The
   animation only ADDS a subtle slide-up. animation-fill-mode is forwards,
   NOT backwards — this means during the delay the BASE style applies
   (opacity:1, visible), not the keyframe from state (opacity:0, invisible).
   Prevents the iOS Safari bug where elements remained invisible until scroll. */
.fade-up{ opacity: 1; transform: none; }
@media (prefers-reduced-motion: no-preference){
  .fade-up{ animation: fadeUp .55s var(--ease) forwards; }
  .fade-up.d2{animation-delay: .08s;} .fade-up.d3{animation-delay: .14s;}
  .fade-up.d4{animation-delay: .20s;} .fade-up.d5{animation-delay: .26s;}
  .fade-up.d6{animation-delay: .32s;}
}
@keyframes fadeUp{ from{ opacity: 0.3; transform: translateY(10px); } to{ opacity: 1; transform: none; } }

/* ═══ HERO ═══ */
.eh-hero{
  position: relative; overflow: hidden;
  border-radius: 32px; padding: 40px 30px 30px; margin: 16px 16px 24px;
  background:
    radial-gradient(circle at 20% 30%, rgba(255,230,0,0.25), transparent 45%),
    radial-gradient(circle at 80% 80%, rgba(238,43,115,0.38), transparent 50%),
    linear-gradient(135deg, #1a0b3a 0%, #4A1A6B 35%, #9333EA 65%, #EE2B73 100%);
  color: #fff;
  box-shadow: 0 30px 70px -24px rgba(103,80,164,0.5);
}
.eh-sparkles{ position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.eh-sparkles i{
  position: absolute; width: 4px; height: 4px; border-radius: 50%;
  background: #fff; opacity: 0; animation: sparkle 4s ease-in-out infinite;
}
/* Sparkles kept in the score-card half (left in RTL) so they never land on
   the hero title text (which lives on the right in RTL). */
.eh-sparkles i:nth-child(1){ top: 14%; left: 8%;  animation-delay: 0s;   }
.eh-sparkles i:nth-child(2){ top: 42%; left: 3%;  animation-delay: 0.8s; width:6px; height:6px; }
.eh-sparkles i:nth-child(3){ top: 72%; left: 10%; animation-delay: 1.6s; }
.eh-sparkles i:nth-child(4){ top: 60%; left: 28%; animation-delay: 2.4s; width:5px; height:5px; }
.eh-sparkles i:nth-child(5){ top: 88%; left: 20%; animation-delay: 3.2s; }
.eh-sparkles i:nth-child(6){ top: 92%; left: 40%; animation-delay: 0.4s; }
@keyframes sparkle{ 0%,100%{opacity:0; transform:scale(.5);} 50%{opacity:1; transform:scale(1.2);} }

/* ZNK character sits next to the today-mission card as a flex sibling, so
   it never covers copy or CTAs. On mobile it hides to keep the card full-width. */
.eh-score{ position: relative; }
.eh-today-row{
  /* stretch aligns both the card and the mascot to the row's full height —
     the mascot's TOP now starts at the card's top (not overflowing above
     it) while its bottom sits flush with the card's bottom. */
  display: flex; align-items: stretch; gap: 14px;
  margin-top: 22px;
}
.eh-today-row .eh-today{ flex: 1; margin-top: 0; min-width: 0; }
.eh-today-char{
  /* Character fits ENTIRELY inside the row's height — the image's height
     is driven by the card beside it, not the image's natural pixel size.
     width is still clamp-limited so it doesn't dominate the row on tiny
     screens. object-fit:contain preserves aspect ratio. */
  height: 100%;
  max-height: 100%;
  width: auto;
  max-width: clamp(140px, 26vw, 300px);
  object-fit: contain;
  object-position: bottom;
  flex-shrink: 0; pointer-events: none;
  filter: drop-shadow(0 18px 28px rgba(0,0,0,0.35));
  animation: heroCharFloat 4s ease-in-out infinite;
  align-self: stretch;
}
@keyframes heroCharFloat{
  0%,100%{ transform: translateY(0) rotate(-1deg); }
  50%{ transform: translateY(-4px) rotate(1deg); }
}
/* Mobile sizing for .eh-today-char is handled in the mobile hero layout
   block further down — see @media (max-width: 820px). */

.eh-hero-grid{
  display: grid; grid-template-columns: 1.3fr 1fr; gap: 28px; align-items: center;
  position: relative; z-index: 2;
}
@media (max-width: 820px){ .eh-hero-grid{ grid-template-columns: 1fr; } }

/* Page intro block — matched to the /reading .rh-section-crown size.
   Neo-brutalist pill (thick ink border + hard 5px offset shadow) so both
   pages read with the same visual weight in their crown. */
.eh-page-intro{
  margin-bottom: 18px;
}
.eh-page-subtitle{
  margin: 10px 4px 0;
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 700;
  line-height: 1.4;
  color: rgba(26,11,58,0.72);
  max-width: 52ch;
  letter-spacing: -0.005em;
  opacity: 0;
  transform: translateY(10px);
  animation: ehSubIn .6s cubic-bezier(0.22, 1, 0.36, 1) .22s forwards;
}
@keyframes ehSubIn{ to{ opacity: 1; transform: none; } }
/* Section crown — pixel-identical to /reading .rh-section-crown so all
   three gateway pages (exam, full-exam, reading) share one crown size. */
.eh-section-crown{
  display: inline-flex; align-items: center; gap: 14px;
  padding: 14px 22px 14px 18px;
  background: linear-gradient(135deg, rgba(255,230,0,0.98) 0%, rgba(255,199,44,0.98) 100%);
  color: #1a0b3a;
  border: 3px solid #1a0b3a;
  border-radius: 999px;
  box-shadow: 5px 5px 0 0 #1a0b3a;
  animation: ehCrownIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.eh-section-crown-ico{
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border-radius: 50%;
  background: linear-gradient(135deg, #1a0b3a, #4A1A6B);
  color: #FFE600;
  box-shadow: inset 0 1px 2px rgba(255,255,255,0.15);
  flex-shrink: 0;
}
.eh-section-crown-ico svg{ width: 24px; height: 24px; }
.eh-section-crown-text{ display: flex; flex-direction: column; gap: 2px; line-height: 1; text-align: right; }
.eh-section-crown-text small{
  font-family: var(--font-display);
  font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
  color: rgba(26,11,58,0.7);
}
.eh-section-crown-text b{
  font-family: var(--font-display);
  font-size: 26px; font-weight: 900; letter-spacing: -0.015em;
  color: #1a0b3a;
  line-height: 1.05;
}
.eh-section-crown-sub{
  font-weight: 700; opacity: 0.55; font-size: 16px;
}
@keyframes ehCrownIn {
  0% { opacity: 0; transform: translateY(-8px) scale(0.95); }
  60% { opacity: 1; transform: translateY(0) scale(1.03); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.eh-meta-row{ display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
.eh-pill{
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 14px; border-radius: 999px;
  background: rgba(255,255,255,0.16); backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.22);
  font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  font-family: var(--font-display);
}
.eh-pill .dot{ width: 8px; height: 8px; border-radius: 50%; background: #FFE600; box-shadow: 0 0 10px #FFE600; animation: pulseDot 1.6s infinite; }
.eh-pill.urgent{ background: #FFE600; color: #3E2E00; border-color: transparent; animation: urgentPulse 2s infinite; }
@keyframes urgentPulse { 0%,100%{box-shadow: 0 0 0 0 rgba(255,230,0,0.6);} 50%{box-shadow: 0 0 0 10px rgba(255,230,0,0);} }
@keyframes pulseDot { 0%,100%{box-shadow: 0 0 10px #FFE600;} 50%{box-shadow: 0 0 18px #FFE600, 0 0 0 5px rgba(255,230,0,0.2);} }

.eh-title{
  font-family: var(--font-display);
  /* Gateway-page H1 scale — unified across /, /vocabulary, /exam, /exam/full.
     900 weight + -.03em tracking + 1.05 leading matches the other gateways.
     /reading is the outlier (editorial full-bleed hero on white). */
  font-size: clamp(28px, 4.2vw, 44px); font-weight: 900;
  letter-spacing: -0.03em; line-height: 1.05; margin-bottom: 16px; color: #fff;
}
.eh-title .accent{
  background: linear-gradient(90deg, #FFE600, #FFC72C, #FFE600);
  background-size: 200% 100%;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: shimmer 3s linear infinite;
}
@keyframes shimmer{ to { background-position: 200% 0; } }
.eh-lede{ font-size: 15px; line-height: 1.55; color: rgba(255,255,255,0.9); max-width: 560px; margin-bottom: 22px; }
.eh-ctas{ display: flex; gap: 10px; flex-wrap: wrap; }
.eh-btn-primary{
  background: #fff; color: var(--md-primary);
  padding: 14px 24px; border-radius: 999px;
  font-weight: 800; font-size: 14px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  transition: transform .2s var(--ease), box-shadow .2s var(--ease);
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-display); cursor: pointer;
}
.eh-btn-primary:hover{ transform: translateY(-2px); box-shadow: 0 14px 34px rgba(0,0,0,0.24); }
.eh-btn-primary:active{ transform: scale(.96); }
.eh-btn-ghost{
  background: rgba(255,255,255,0.16); color: #fff;
  padding: 14px 20px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.28);
  font-weight: 700; font-size: 13px; cursor: pointer;
  transition: background .2s var(--ease); font-family: var(--font-display);
  backdrop-filter: blur(10px);
}
.eh-btn-ghost:hover{ background: rgba(255,255,255,0.24); }

/* Score card */
.eh-score{
  background: rgba(255,255,255,0.14); backdrop-filter: blur(18px);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: 32px; padding: 22px;
  display: flex; flex-direction: column; gap: 16px;
  box-shadow: 0 14px 34px rgba(0,0,0,0.14);
}
.eh-score-top{ display: flex; align-items: center; gap: 16px; }
.donut{ width: 100px; height: 100px; flex-shrink: 0; position: relative; }
.donut svg{ width: 100%; height: 100%; transform: rotate(-90deg); }
.donut .track{ fill: none; stroke: rgba(255,255,255,0.18); stroke-width: 10; }
.donut .fill{
  fill: none; stroke: url(#donutGrad); stroke-width: 10; stroke-linecap: round;
  transition: stroke-dashoffset 1.6s var(--ease);
  filter: drop-shadow(0 0 8px rgba(255,230,0,0.6));
}
.donut .center{ position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; }
.donut .center b{ font-size: 26px; font-weight: 800; line-height: 1; font-family: var(--font-display); }
.donut .center span{ font-size: 9px; font-weight: 600; opacity: .75; letter-spacing: .14em; text-transform: uppercase; margin-top: 4px; }
.eh-score-info h4{ font-size: 14px; font-weight: 800; margin-bottom: 4px; font-family: var(--font-display); }
.eh-score-info p{ font-size: 12px; color: rgba(255,255,255,0.78); line-height: 1.45; margin: 0; }
.eh-trend{
  display: inline-flex; align-items: center; gap: 5px; margin-top: 8px;
  padding: 4px 10px; border-radius: 999px;
  font-size: 11px; font-weight: 800;
}
.eh-trend.up{ background: rgba(6,166,107,0.3); color: #9FF5C5; }
.eh-trend.down{ background: rgba(186,26,26,0.3); color: #FFB4AB; }

.eh-streak-row{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.14); }
.eh-streak{
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; background: rgba(255,255,255,0.1); border-radius: 16px;
}
.eh-streak .flame, .eh-streak .spark{ font-size: 22px; }
.eh-streak .flame{ animation: flicker 1.2s ease-in-out infinite; }
@keyframes flicker { 0%,100%{transform: scale(1);} 50%{transform: scale(1.15);} }
.eh-streak b{ font-size: 20px; font-weight: 800; font-family: var(--font-display); display: block; line-height: 1; }
.eh-streak span{ font-size: 10px; opacity: .75; font-weight: 600; letter-spacing: .06em; }

/* Today's mission — matched to the home-page .dash-track card so the
   "daily missions" visual language is one and the same across the app:
   dark purple gradient + radial glows + yellow accents + light text. */
.eh-today{
  margin-top: 22px; padding: 18px 22px 20px; border-radius: 24px;
  background:
    radial-gradient(circle at 88% 10%, rgba(255,230,0,0.18), transparent 45%),
    radial-gradient(circle at 12% 88%, rgba(238,43,115,0.22), transparent 50%),
    linear-gradient(135deg, #1a0b3a 0%, #3a1a6b 45%, #7c3aed 95%);
  box-shadow:
    0 14px 36px -12px rgba(91,33,182,0.45),
    0 4px 12px rgba(0,0,0,0.12),
    inset 0 1px 0 rgba(255,255,255,0.08);
  color: #fff;
  position: relative; overflow: hidden;
}
.eh-today h2{ margin-top: 2px; }
.eh-today-grid{ display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center; }
@media (max-width: 640px){ .eh-today-grid{ grid-template-columns: 1fr; } }
.eh-today-tag{
  display: inline-flex; align-items: center; gap: 8px;
  padding: 5px 12px; border-radius: 999px;
  background: linear-gradient(135deg, #EE2B73, #FF6B9D);
  color: #fff;
  font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
  margin-bottom: 10px; font-family: var(--font-display);
  box-shadow: 0 4px 14px rgba(238,43,115,0.35);
}
.eh-today-tag .live{ width: 8px; height: 8px; border-radius: 50%; background: #FFE600; animation: pulseDot 1.8s infinite; }
.eh-today h2{ font-size: 20px; font-weight: 800; color: #fff; font-family: var(--font-display); }
.eh-today .sub{ font-size: 13px; color: rgba(255,255,255,0.72); margin: 6px 0 12px; }
.eh-today-bar{
  display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 999px;
  backdrop-filter: blur(6px);
}
.eh-today-bar .bar{ flex: 1; height: 7px; background: rgba(255,255,255,0.14); box-shadow: inset 0 1px 2px rgba(0,0,0,0.18); border-radius: 999px; overflow: hidden; }
.eh-today-bar .bar > div{ height: 100%; background: linear-gradient(90deg, #10B981 0%, #FFE600 55%, #EE2B73 100%); box-shadow: 0 0 10px rgba(238,43,115,0.4); transition: width 1s var(--ease); }
.eh-today-bar b{ font-size: 13px; font-weight: 800; color: #FFE600; font-family: var(--font-display); }
.eh-today-cta{
  /* Desktop: matches .feh-btn-primary-wide on /exam/full exactly —
     large (22px), bold (900), gradient-filled with a slow pulse glow.
     !important on sizing locks the desktop value against any lurking
     specificity issues. Mobile @media block below overrides cleanly
     because @media rules win even without !important when on mobile.
     Pseudo-fill bypasses button background reset. */
  position: relative; z-index: 2;
  isolation: isolate;
  display: flex;
  width: 100%;
  align-items: center; justify-content: center; gap: 14px;
  padding: 26px 28px !important; border-radius: 22px !important;
  min-height: 78px !important;
  border: 3px solid #FFB800 !important;
  background: transparent;
  color: #0d294b !important; font-weight: 900 !important; font-size: 22px !important;
  letter-spacing: -0.015em;
  cursor: pointer;
  box-shadow:
    0 14px 38px rgba(255,184,0,0.55),
    0 0 56px rgba(255,230,0,0.4),
    inset 0 2px 8px rgba(255,255,255,0.55),
    inset 0 -4px 10px rgba(255,184,0,0.32);
  text-shadow: 0 1px 0 rgba(255,255,255,0.55);
  transition: transform .25s var(--ease), box-shadow .25s var(--ease);
  font-family: var(--font-display);
  margin-top: 8px;
  animation: ehWideCtaPulse 2.6s ease-in-out infinite;
  -webkit-appearance: none; appearance: none;
}
.eh-today-cta::before{
  content: ''; position: absolute; inset: 0; border-radius: inherit;
  background: linear-gradient(135deg, #FFF3A0 0%, #FFE600 45%, #FFB800 100%);
  z-index: -1; pointer-events: none;
}
.eh-today-cta svg{ width: 24px; height: 24px; flex-shrink: 0; }
@keyframes ehWideCtaPulse{
  0%, 100%{
    box-shadow:
      0 14px 38px rgba(255,184,0,0.55),
      0 0 56px rgba(255,230,0,0.4),
      inset 0 2px 8px rgba(255,255,255,0.55),
      inset 0 -4px 10px rgba(255,184,0,0.32);
  }
  50%{
    box-shadow:
      0 18px 52px rgba(255,184,0,0.75),
      0 0 80px rgba(255,230,0,0.65),
      0 0 0 6px rgba(255,230,0,0.22),
      inset 0 2px 8px rgba(255,255,255,0.65),
      inset 0 -4px 10px rgba(255,184,0,0.4);
  }
}
.eh-today-cta:hover{
  transform: translateY(-3px) scale(1.015);
  box-shadow:
    0 20px 48px rgba(255,184,0,0.7),
    0 0 72px rgba(255,230,0,0.6),
    inset 0 2px 8px rgba(255,255,255,0.65),
    inset 0 -4px 10px rgba(255,184,0,0.4);
}
.eh-today-cta:active{ transform: scale(.98); animation-play-state: paused; }

/* ── My Exam Missions card (always-visible) ─────────────────────────
   Shows the student's full exam-question mission list with one active CTA. */
/* My Exam Missions — rendered inside the dark-purple .eh-today card,
   so all backgrounds/text shift to light-on-dark. Active row uses the
   same pink→yellow glow accent as the home-page rail active bubble. */
.eh-mymissions{ padding: 16px 18px 14px; }
.eh-mm-head{ display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.eh-mm-count{
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.16);
  color: rgba(255,255,255,0.85);
  font-size: 10px; font-weight: 800; font-family: var(--font-display);
  letter-spacing: .08em;
  backdrop-filter: blur(6px);
}
.eh-mm-list{
  list-style: none; padding: 0; margin: 0 0 14px;
  display: flex; flex-direction: column; gap: 6px;
}
.eh-mm-item{
  display: grid; grid-template-columns: 22px 1fr auto; gap: 10px;
  align-items: center; padding: 10px 14px; border-radius: 14px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.08);
  transition: background 200ms var(--ease), transform 140ms var(--ease);
  font-family: var(--font-body);
}
.eh-mm-item.active{
  background: linear-gradient(135deg, rgba(238,43,115,0.28), rgba(255,230,0,0.18));
  border-color: rgba(255,230,0,0.45);
  box-shadow: 0 4px 14px rgba(238,43,115,0.3), inset 0 0 0 1px rgba(255,230,0,0.35);
}
.eh-mm-item.done{ opacity: 0.6; }
.eh-mm-item.locked{ opacity: 0.4; }
.eh-mm-dot{
  width: 22px; height: 22px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: #2a1059; color: #FFE600;
  font-size: 11px; font-weight: 900;
  border: 2px solid rgba(255,255,255,0.28);
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}
.eh-mm-item.active .eh-mm-dot{
  background: linear-gradient(135deg, #EE2B73, #FF6B9D);
  border-color: #FFE600;
  color: #fff;
}
.eh-mm-item.done .eh-mm-dot{
  background: linear-gradient(135deg, #10B981, #34D399);
  border-color: #FFE600;
  color: #fff;
}
.eh-mm-item.locked .eh-mm-dot{
  background: #1f1040; color: rgba(255,255,255,0.4);
  border-color: rgba(255,255,255,0.14);
  box-shadow: none;
}
.eh-mm-text{ min-width: 0; }
.eh-mm-text b{
  display: block; font-size: 13px; font-weight: 800; color: #fff;
  font-family: var(--font-display);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.eh-mm-item.active .eh-mm-text b{ color: #FFE600; }
.eh-mm-text small{
  display: block; font-size: 11px; color: rgba(255,255,255,0.65);
  margin-top: 1px; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.eh-mm-time{
  font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.75);
  padding: 3px 8px; border-radius: 999px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.14);
  letter-spacing: .04em;
}
.eh-mm-item.active .eh-mm-time{ background: rgba(255,230,0,0.85); color: #0d294b; border-color: #FFE600; font-weight: 800; }
.eh-mm-empty{
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
  padding: 12px 16px; border-radius: 14px;
  background: var(--md-success-container); color: #004D30;
  font-size: 13.5px; font-weight: 700;
}
/* Free-practice CTA — elevated from a quiet text-link to a bold animated
   brand CTA because this is the student's ONLY next action after completing
   all daily missions. Stand-out gradient + pulse so it reads as primary. */
.eh-mm-empty-cta{
  position: relative;
  isolation: isolate;
  display: inline-flex; align-items: center; justify-content: center;
  gap: 8px;
  padding: 12px 22px;
  border-radius: 14px;
  border: 2px solid rgba(255,255,255,0.55);
  background: transparent;
  color: #fff;
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 14.5px;
  letter-spacing: -0.005em;
  cursor: pointer;
  text-shadow: 0 1px 2px rgba(90,10,40,0.35);
  box-shadow:
    0 8px 22px rgba(238,43,115,0.5),
    0 0 30px rgba(255,138,61,0.45),
    inset 0 1px 0 rgba(255,255,255,0.3);
  transition: transform 200ms cubic-bezier(0.34,1.56,0.64,1),
              box-shadow 220ms ease;
  animation: ehFreePulse 2.4s ease-in-out infinite;
  -webkit-appearance: none;
  appearance: none;
}
/* Gradient fill on pseudo-element — same trick as dash-track-cta to
   avoid the button background reset. */
.eh-mm-empty-cta::before{
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, #EE2B73 0%, #FF8A3D 55%, #FFE600 100%);
  background-color: #EE2B73;
  z-index: -1;
  pointer-events: none;
}
.eh-mm-empty-cta:hover{
  transform: translateY(-2px) scale(1.025);
  box-shadow:
    0 14px 34px rgba(238,43,115,0.68),
    0 0 52px rgba(255,230,0,0.55),
    inset 0 1px 0 rgba(255,255,255,0.4);
}
.eh-mm-empty-cta:active{ transform: scale(0.97); }
.eh-mm-empty-cta svg{ flex-shrink: 0; }
@keyframes ehFreePulse{
  0%, 100% {
    box-shadow:
      0 8px 22px rgba(238,43,115,0.5),
      0 0 30px rgba(255,138,61,0.45),
      inset 0 1px 0 rgba(255,255,255,0.3);
  }
  50% {
    box-shadow:
      0 14px 40px rgba(238,43,115,0.72),
      0 0 56px rgba(255,230,0,0.55),
      0 0 0 5px rgba(255,138,61,0.2),
      inset 0 1px 0 rgba(255,255,255,0.4);
  }
}
.eh-mm-fallback{
  font-size: 13px; color: var(--md-on-surface-var);
  line-height: 1.55; margin: 0 0 14px;
}
.eh-mm-fallback-ctas{ display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

/* Section head */
.eh-shead{
  display: flex; align-items: flex-end; justify-content: space-between;
  margin: 32px 16px 16px; gap: 14px;
}
.eh-shead h2{ font-size: 22px; font-weight: 800; color: var(--md-on-surface); font-family: var(--font-display); letter-spacing: -0.01em; }
.eh-shead .sub{ font-size: 13px; color: var(--md-on-surface-var); margin-top: 4px; }
.eh-count{
  font-size: 11px; color: var(--md-on-surface-var);
  background: var(--md-surface); padding: 7px 14px; border-radius: 999px;
  font-weight: 700; border: 1px solid rgba(0,0,0,0.05);
}

/* Section cards */
.eh-cards{ display: flex; flex-direction: column; gap: 14px; margin: 0 16px; }
.eh-scard{
  position: relative; overflow: hidden;
  display: grid; grid-template-columns: 72px 1fr auto; gap: 18px; align-items: center;
  padding: 18px 22px; background: var(--md-surface); border-radius: 28px;
  border: 1px solid rgba(0,0,0,0.04);
  box-shadow: 0 4px 14px rgba(0,0,0,0.04);
  cursor: pointer;
  transition: transform .35s var(--ease), box-shadow .35s var(--ease);
}
.eh-scard:hover{ transform: translateY(-4px); box-shadow: 0 20px 42px -12px rgba(238,43,115,0.26); }
.eh-scard:active{ transform: scale(.985); }
.eh-scard::before{
  content: ""; position: absolute; inset: auto -15% -55% auto;
  width: 240px; height: 240px; border-radius: 50%;
  background: var(--c-accent, var(--md-primary));
  opacity: .12; filter: blur(40px); transition: opacity .3s var(--ease);
}
.eh-scard:hover::before{ opacity: .3; }
.eh-scard.c-sc          { --c-accent: #EE2B73; --c-accent-container: #FFD6E4; }
.eh-scard.c-restatement { --c-accent: #6750A4; --c-accent-container: #E8DEF8; }
.eh-scard.c-rc          { --c-accent: #0D9488; --c-accent-container: #CFEEE0; }
.eh-scard .ico{
  width: 72px; height: 72px; border-radius: 24px;
  background: var(--c-accent-container); color: var(--c-accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 34px; flex-shrink: 0;
  transition: transform .4s var(--bounce);
}
.eh-scard:hover .ico{ transform: rotate(-6deg) scale(1.06); }
.eh-scard h3{ font-size: 18px; font-weight: 800; letter-spacing: -0.01em; color: var(--md-on-surface); font-family: var(--font-display); }
.eh-scard .subtitle{ font-size: 12px; font-weight: 500; color: var(--md-on-surface-var); margin-top: 2px; letter-spacing: .02em; }
.eh-scard .row1{ display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.eh-scard .chip{ display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; font-size: 10px; font-weight: 800; font-family: var(--font-display); }
.eh-scard .chip.easy{ background: var(--md-success-container); color: #004D30; }
.eh-scard .chip.med{ background: var(--md-warning-container); color: #4A2800; }
.eh-scard .chip.hard{ background: #FFD6E4; color: #3E001E; }
.eh-scard .chip.streak{ background: linear-gradient(135deg, #FF8C42, #FFC72C); color: #3E2E00; box-shadow: 0 4px 10px rgba(255,140,66,0.3); }
.eh-scard .chip.hot{ background: var(--md-primary); color: #fff; animation: pulseChip 2s infinite; }
@keyframes pulseChip { 0%,100%{box-shadow: 0 0 0 0 rgba(238,43,115,0.5);} 50%{box-shadow: 0 0 0 6px rgba(238,43,115,0);} }
.eh-scard .desc{ margin-top: 10px; font-size: 13px; color: var(--md-on-surface-var); line-height: 1.55; }
.eh-scard .meta{ margin-top: 12px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.eh-scard .pill{ display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; background: var(--md-container-hi); color: var(--md-on-surface-var); font-size: 11px; font-weight: 700; }
.eh-scard .pill.win{ background: var(--md-success-container); color: #004D30; }
.eh-scard .pill.warn{ background: var(--md-warning-container); color: #4A2800; }
.eh-scard .pill.lose{ background: var(--md-error-container); color: #410002; }
.eh-scard .pill.fresh{ background: #E8DEF8; color: #21005D; }
.eh-scard .progress{ height: 8px; border-radius: 999px; background: var(--md-container-lo); margin-top: 12px; overflow: hidden; }
.eh-scard .progress > div{ height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--c-accent), var(--md-tertiary-hi)); transition: width 1s var(--ease); box-shadow: 0 0 10px rgba(238,43,115,0.35); }
.eh-scard .go{
  width: 52px; height: 52px; border-radius: 999px;
  background: linear-gradient(135deg, var(--c-accent), var(--c-accent));
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 800; flex-shrink: 0;
  box-shadow: 0 6px 18px rgba(0,0,0,0.16);
  transition: transform .3s var(--bounce);
}
.eh-scard:hover .go{ transform: translateX(-6px) scale(1.08); }
@media (max-width: 620px){
  .eh-scard{ grid-template-columns: 60px 1fr; padding: 16px; border-radius: 24px; }
  .eh-scard .go{ display: none; }
  .eh-scard .ico{ width: 60px; height: 60px; border-radius: 20px; font-size: 28px; }
}

/* Full exam CTA */
.eh-full{
  margin: 32px 16px 0; padding: 34px 30px;
  background:
    radial-gradient(circle at 90% 15%, rgba(255,230,0,0.35), transparent 50%),
    radial-gradient(circle at 10% 85%, rgba(238,43,115,0.4), transparent 55%),
    linear-gradient(135deg, #0d294b 0%, #2C1A6B 45%, #9333EA 85%, #EE2B73 115%);
  color: #fff; border-radius: 40px;
  cursor: pointer; position: relative; overflow: hidden;
  box-shadow: 0 34px 74px -24px rgba(13,41,75,0.55);
  transition: all .4s var(--ease);
}
.eh-full:hover{ transform: translateY(-4px); box-shadow: 0 44px 92px -24px rgba(13,41,75,0.7); }
.eh-full:active{ transform: scale(.99); }
.eh-full-inner{ display: grid; grid-template-columns: 1.3fr 1fr; gap: 28px; align-items: center; position: relative; z-index: 2; }
@media (max-width: 820px){ .eh-full-inner{ grid-template-columns: 1fr; gap: 20px; } }
.eh-full-badge{
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 14px; border-radius: 999px;
  background: #FFE600; color: #3E2E00;
  font-weight: 800; font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
  margin-bottom: 14px; box-shadow: 0 6px 16px rgba(255,230,0,0.4);
  font-family: var(--font-display);
}
.eh-full h3{ font-size: clamp(24px, 3vw, 36px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; font-family: var(--font-display); }
.eh-full .desc{ font-size: 15px; color: rgba(255,255,255,0.86); margin-top: 12px; line-height: 1.55; max-width: 520px; }
.eh-full-proof{
  margin-top: 16px; display: block;
  padding: 12px 16px; background: rgba(255,255,255,0.12); border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.18);
  font-size: 13px; font-weight: 600; line-height: 1.6;
  text-align: start; max-width: 640px;
}
.eh-full-proof b{ color: #FFE600; font-weight: 800; }
.eh-full-cite{
  font-size: 11px; opacity: 0.7; font-weight: 500;
  margin-inline-start: 4px;
  unicode-bidi: isolate; direction: ltr;
}
@media (max-width: 520px){
  .eh-full-proof{ font-size: 12px; padding: 10px 14px; }
  .eh-full-cite{ display: block; margin-top: 4px; margin-inline-start: 0; }
}
.eh-full-ctas{ display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
.eh-full-btn-primary{
  background: #FFE600; color: #3E2E00;
  padding: 14px 26px; border-radius: 999px;
  font-weight: 800; font-size: 14px;
  box-shadow: 0 8px 22px rgba(255,230,0,0.5);
  transition: transform .25s var(--ease);
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  font-family: var(--font-display); border: 0;
}
.eh-full-btn-primary:hover{ transform: translateY(-2px) scale(1.02); }
.eh-full-btn-primary:active{ transform: scale(.96); }

.eh-full-preview{
  background: rgba(255,255,255,0.1); backdrop-filter: blur(14px);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 28px; padding: 20px;
}
.eh-full-preview h5{ font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,0.75); margin-bottom: 12px; font-family: var(--font-display); }
.eh-full-preview .row{
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; font-size: 13px; font-weight: 600;
  border-top: 1px solid rgba(255,255,255,0.12);
}
.eh-full-preview .row:first-of-type{ border-top: none; }
.eh-full-preview .row b{ font-weight: 800; }
.eh-full-preview .row .count{
  display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px;
  border-radius: 999px; background: rgba(255,230,0,0.22); color: #FFE600;
  font-weight: 800; font-size: 11px;
}

/* Stats bar */
.eh-stats{
  margin: 28px 16px 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
}
@media (max-width: 720px){ .eh-stats{ grid-template-columns: repeat(2, 1fr); } }
.sbi{
  display: flex; flex-direction: column; gap: 4px;
  padding: 18px 20px; background: var(--md-surface); border-radius: 24px;
  border: 1px solid rgba(0,0,0,0.05);
  transition: transform .3s var(--ease);
}
.sbi:hover{ transform: translateY(-2px); }
.sbi .label{ font-size: 10px; font-weight: 700; color: var(--md-on-surface-var); letter-spacing: .12em; text-transform: uppercase; }
.sbi b{ font-size: 30px; font-weight: 800; letter-spacing: -0.02em; line-height: 1; color: var(--md-on-surface); font-family: var(--font-display); }
.sbi .delta{ display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 999px; background: var(--md-success-container); color: #004D30; font-size: 10px; font-weight: 800; width: max-content; margin-top: 5px; }
.sbi .delta.warn{ background: var(--md-warning-container); color: #4A2800; }

/* Recent results */
.eh-results{ margin: 28px 16px 0; padding: 22px; background: var(--md-surface); border-radius: 28px; border: 1px solid rgba(0,0,0,0.04); }
.eh-results .head{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.eh-results .head h2{ font-size: 18px; font-weight: 800; font-family: var(--font-display); }
.eh-results .head .all{ padding: 7px 12px; border-radius: 999px; background: transparent; color: var(--md-primary); font-weight: 700; font-size: 12px; border: 0; cursor: pointer; transition: background .3s var(--ease); }
.eh-results .head .all:hover{ background: rgba(238,43,115,0.08); }
.eh-result-row{
  display: grid; grid-template-columns: 44px 1fr auto; gap: 12px;
  align-items: center; padding: 12px; border-radius: 18px;
  background: var(--md-container); transition: all .25s var(--ease);
}
.eh-result-row + .eh-result-row{ margin-top: 8px; }
.eh-result-row:hover{ background: var(--md-container-hi); }
.eh-result-row.c-sc          { --c-accent: #EE2B73; --c-accent-container: #FFD6E4; }
.eh-result-row.c-restatement { --c-accent: #6750A4; --c-accent-container: #E8DEF8; }
.eh-result-row.c-rc          { --c-accent: #0D9488; --c-accent-container: #CFEEE0; }
.eh-result-row.c-full        { --c-accent: #6750A4; --c-accent-container: #E8DEF8; }
.eh-result-row .ico{ width: 44px; height: 44px; border-radius: 14px; background: var(--c-accent-container); color: var(--c-accent); display: flex; align-items: center; justify-content: center; font-size: 20px; }
.eh-result-row h4{ font-size: 13px; font-weight: 800; font-family: var(--font-display); }
.eh-result-row small{ font-size: 11px; color: var(--md-on-surface-var); font-weight: 500; }
.eh-result-row .score{ padding: 8px 16px; border-radius: 999px; font-weight: 800; font-size: 14px; background: var(--md-success-container); color: #004D30; font-family: var(--font-display); }
.eh-result-row .score.warn{ background: var(--md-warning-container); color: #4A2800; }
.eh-result-row .score.lose{ background: var(--md-error-container); color: #410002; }

/* Motivational */
.eh-mot{
  margin: 28px 16px 0; padding: 26px 30px;
  background: linear-gradient(135deg, #0d294b 0%, #2C1A6B 100%);
  color: #fff; border-radius: 28px; position: relative; overflow: hidden;
  display: flex; align-items: center; gap: 20px;
}
.eh-mot::before{
  content:""; position:absolute; inset:-30% -20% auto auto;
  width:240px; height:240px; border-radius:50%;
  background: radial-gradient(circle, rgba(238,43,115,.4), transparent 70%);
  filter: blur(45px);
}
.eh-mot .q{ font-size: 46px; color: #FFE600; font-weight: 800; line-height: .7; opacity: .9; flex-shrink: 0; position: relative; z-index: 1; }
.eh-mot p{ font-size: 15px; font-weight: 600; line-height: 1.5; position: relative; z-index: 1; }
.eh-mot p span{ display: block; font-size: 11px; font-weight: 500; opacity: .7; margin-top: 8px; letter-spacing: .08em; }

/* ══════════════════════════════════════════════════════════════════
   MOBILE SCROLL PERFORMANCE — every line here addresses an actual
   iOS Safari scroll-jank cause. User reported: "scroll gets stuck,
   needs multiple attempts to reach the bottom of the page."

   Root causes addressed:
   — backdrop-filter forces every-frame compositor repaint
   — filter: drop-shadow runs on the CPU per frame; box-shadow runs on
     the GPU compositor instead (orders-of-magnitude cheaper on scroll)
   — Continuous keyframe animations on offscreen elements still cost
     paint cycles
   — Large painted areas (hero gradient) without GPU promotion thrash
     the main thread on scroll
   ══════════════════════════════════════════════════════════════════ */
@media (max-width: 820px){
  .eh-score{ backdrop-filter: none; background: rgba(30, 10, 58, 0.55); }
  .eh-pill{ backdrop-filter: none; background: rgba(255,255,255,0.22); }
  .eh-btn-ghost{ backdrop-filter: none; background: rgba(255,255,255,0.22); }
  .eh-full-preview{ backdrop-filter: none; background: rgba(255,255,255,0.15); }
  /* Disable continuous sparkle animations on mobile. */
  .eh-sparkles{ display: none; }

  /* Promote the hero to a GPU layer so the giant multi-radial gradient
     doesn't repaint on scroll. transform:translateZ(0) is the classic
     hack that's still the most reliable cross-iOS solution.

     NOTE: previous versions also added will-change:transform and
     contain:layout-paint here — both turn out to break iOS Safari\'s
     paint scheduler in this particular layout. Students reported the
     bottom half of /exam not rendering until they scrolled, and a
     stuck spinner showing for a few seconds first. Removing both
     restored normal paint timing without measurably affecting scroll
     perf, since the GPU promotion already comes from translateZ(0). */
  .eh-hero{
    transform: translateZ(0);
  }
  /* Replace drop-shadow filter on the character with a cheap CSS
     shadow. drop-shadow is expensive per-frame; box-shadow is GPU. */
  .eh-today-char{
    filter: none !important;
  }
  /* Previously this rule applied contain:layout-paint to every
     scroll-revealed section — but combined with the fade-up entrance
     animations it caused offscreen sections to be skipped from the
     initial paint on iOS, leaving the below-the-fold area blank until
     scroll, which is the symptom students reported. Containment
     removed. */
}

/* ══════════════════════════════════════════════════════════════════
   MOBILE HERO LAYOUT — reordered stack:
     1. meta pill (days left)
     2. title + lede
     3. today-mission (slim)
     4. score card (donut + streaks)
     5. CTA buttons
     6. hero character (2x size)
   Achieved via display:contents on grid wrappers + CSS order.
   ══════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════════
   /exam MOBILE HERO — "Confident Mentor" redesign (2026-04-26 v3)
   ────────────────────────────────────────────────────────────────────
   The previous version stacked the character on top of the title (RTL
   padding bug + wrong class name targeted) and pushed the primary CTA
   far below the fold. This rewrite commits to a clear hierarchy:

     ┌─────────────────────────────────────────┐
     │ [crown chip]                            │
     │ [days-left pill]                        │
     │                                         │
     │ Big confident headline                  │
     │ One-line context                        │
     │                                         │
     │ ┌─ TODAY MISSION CARD ─────────────┐   │  ← above fold on iPhone SE
     │ │ Mission rows                      │   │
     │ │ [⚡ YELLOW PRIMARY CTA, glowing]   │   │  ← THE action
     │ └───────────────────────────────────┘   │
     │                                         │
     │              [secondary CTA pair]       │
     │              [score donut]              │
     │                                         │
     │ 🤓 ←── char-psicho peeks bottom-left    │  ← decorative companion
     └─────────────────────────────────────────┘

   Key decisions:
   — Character lives at BOTTOM-LEFT, absolute, ~96px wide. It's a
     decorative study-buddy, not a navigation element. Doesn't fight
     the title for space. pointer-events:none so taps pass through.
   — NO padding-inline hacks on text. Char sits below the text flow,
     not beside it, so headline can breathe across the full width.
   — Today-mission card has elevated shadow + z-index above the char
     so it owns the visual focus. Its CTA is the brand-signature
     yellow-glow pill (matches the daily-plan strip on /).
   — Lede capped to 2 lines. Crown + days-pill are compact.
   — overflow:visible on the hero so the char bottom edge can peek
     past the rounded border like a sticker.
   ════════════════════════════════════════════════════════════════════ */
@media (max-width: 820px){
  .eh-hero{
    display: flex; flex-direction: column;
    position: relative;
    overflow: visible;
    padding: 18px 16px 22px;
    margin: 8px 8px 18px;
    border-radius: 22px;
  }
  .eh-hero-grid{ display: contents; }
  .eh-hero-grid > div:first-child{ display: contents; }
  .eh-today-row{ display: contents; }

  /* ─── Flex order — primary action above the fold ────────────── */
  .eh-page-intro{ order: 1; margin-bottom: 10px; }
  .eh-meta-row  { order: 2; margin-bottom: 10px; }
  .eh-title     { order: 3; margin-bottom: 8px; }
  .eh-lede      { order: 4; margin-bottom: 14px; }
  .eh-today     { order: 5; margin-top: 0; }
  .eh-ctas      { order: 6; margin-top: 12px; flex-direction: column; gap: 8px; }
  .eh-score     { order: 7; margin-top: 14px; }

  /* ─── Character — bottom-left companion, decorative only ─────
     Pinned absolute, doesn't participate in the flex flow. Sized
     small so the headline above and the today-card to its right
     own the visual hierarchy. */
  .eh-today-char{
    /* Sized + positioned to match the /vocabulary hero character on
       mobile: 130px wide, 10px gap from top + left edges, slight
       opacity tame-down so the gradient still leads. */
    position: absolute !important;
    top: 10px !important;
    bottom: auto !important;
    left: 10px !important;
    right: auto !important;
    width: 130px !important;
    max-width: 130px !important;
    height: auto !important;
    max-height: none !important;
    object-fit: contain !important;
    object-position: top !important;
    align-self: auto !important;
    margin: 0 !important;
    z-index: 1 !important;
    pointer-events: none !important;
    opacity: 0.92;
  }
  /* Reserve LEFT space (RTL inline-end) so the title doesn't run
     under the character. 130px char + 10px gap + a little breathing
     room = ~150px reserved. */
  .eh-page-intro,
  .eh-meta-row,
  .eh-title,
  .eh-lede{
    padding-inline-end: 150px !important;
    padding-inline-start: 0 !important;
  }
  .eh-today, .eh-ctas, .eh-score{
    padding-inline-end: 0 !important;
    padding-inline-start: 0 !important;
  }

  /* ─── Crown chip — compact ───────────────────────────────────── */
  .eh-section-crown{ padding: 8px 14px 8px 10px; gap: 10px; }
  .eh-section-crown-ico{ width: 30px; height: 30px; }
  .eh-section-crown-ico svg{ width: 18px; height: 18px; }
  .eh-section-crown-text small{ font-size: 9.5px; letter-spacing: 0.16em; }
  .eh-section-crown-text b{ font-size: 16px; }

  /* ─── Days-left pill ─────────────────────────────────────────── */
  .eh-pill{ font-size: 11px; padding: 6px 12px; }

  /* ─── Headline — confident, but bounded ──────────────────────── */
  .eh-title{
    font-size: clamp(22px, 6.6vw, 28px) !important;
    line-height: 1.1 !important;
    letter-spacing: -0.025em;
    margin-bottom: 8px !important;
  }
  .eh-lede{
    font-size: 13.5px !important;
    line-height: 1.45 !important;
    margin-bottom: 14px !important;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ─── Today-mission card — the focal point ───────────────────── */
  .eh-today{
    padding: 14px 14px !important;
    border-radius: 18px !important;
    position: relative;
    z-index: 2;
    box-shadow: 0 12px 28px rgba(13,11,58,0.38);
  }
  .eh-today-grid{ gap: 10px; grid-template-columns: 1fr; }
  .eh-today h2{ font-size: 14px; margin-top: 0; }
  .eh-today .sub{ display: none; }
  .eh-today-tag{ font-size: 9.5px; padding: 3px 10px; margin-bottom: 6px; }
  .eh-today-bar{ padding: 6px 10px; gap: 8px; }
  .eh-today-bar b{ font-size: 11px; }
  .eh-mm-head{ flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .eh-mm-count{ font-size: 10px; padding: 3px 9px; }
  .eh-mm-list{
    /* Cap the visible mission rows to keep the CTA close to the top
       edge of the card. Overflow hidden — the user can scroll the
       card area if they need to see more, but the CTA stays anchored. */
    max-height: 130px;
    overflow: hidden;
    margin-bottom: 12px;
  }
  .eh-mm-item{ padding: 8px 10px; gap: 10px; }
  .eh-mm-item b{ font-size: 13px; }
  .eh-mm-item small{ font-size: 11px; }
  .eh-mm-time{ font-size: 10px; padding: 2px 7px; }

  /* ─── PRIMARY CTA — the brand-signature yellow-glow pill ─────
     Made dramatically more prominent: bigger, brighter glow, gentle
     pulse so the eye is drawn to it as THE action on the page. */
  .eh-today-cta{
    width: 100% !important;
    justify-content: center !important;
    padding: 18px 22px !important;
    font-size: 16.5px !important;
    font-weight: 900 !important;
    min-height: 58px !important;
    border-radius: 16px !important;
    background: linear-gradient(135deg, #FFE600 0%, #FFC72C 100%) !important;
    color: #0d294b !important;
    border: 3px solid #0d294b !important;
    box-shadow:
      5px 5px 0 0 #0d294b,
      0 0 44px rgba(255,230,0,0.85),
      0 0 0 6px rgba(255,230,0,0.18) !important;
    text-shadow: 0 1px 0 rgba(255,255,255,0.6);
    letter-spacing: -0.01em;
    transition: transform 0.15s ease, box-shadow 0.15s ease !important;
    animation: ehCtaPulse 2.2s ease-in-out infinite !important;
  }
  @keyframes ehCtaPulse{
    0%, 100%{
      box-shadow:
        5px 5px 0 0 #0d294b,
        0 0 44px rgba(255,230,0,0.85),
        0 0 0 6px rgba(255,230,0,0.18);
    }
    50%{
      box-shadow:
        5px 5px 0 0 #0d294b,
        0 0 56px rgba(255,230,0,1),
        0 0 0 12px rgba(255,230,0,0.08);
    }
  }
  .eh-today-cta svg{ stroke-width: 3 !important; width: 20px !important; height: 20px !important; }
  .eh-today-cta:active{
    transform: translate(2px, 2px) !important;
    box-shadow: 1px 1px 0 0 #0d294b, 0 0 32px rgba(255,230,0,0.6) !important;
    animation-play-state: paused !important;
  }

  /* ─── Secondary CTAs — stacked, less prominent ──────────────── */
  .eh-ctas .eh-btn-primary,
  .eh-ctas .eh-btn-ghost{
    width: 100%;
    justify-content: center;
    padding: 11px 16px;
    font-size: 13px;
    min-height: 44px;
  }

  /* ─── Score donut — slim, below the fold ─────────────────────── */
  .eh-score{ padding: 16px; gap: 12px; border-radius: 20px; }
  .donut{ width: 88px; height: 88px; }
  .donut .center b{ font-size: 22px; }

  /* ─── Sparkles dimmed — less visual noise ───────────────────── */
  .eh-sparkles{ opacity: 0.45; }
}

/* ─── Narrow phones (iPhone SE 375px / smaller androids) ───────── */
@media (max-width: 380px){
  .eh-hero{ padding: 14px 12px 18px; margin: 6px 6px 14px; }
  .eh-title{ font-size: 21px !important; line-height: 1.1 !important; }
  .eh-lede{ font-size: 13px !important; }
  .eh-today{ padding: 12px !important; }
  .eh-today-cta{ padding: 12px 16px !important; font-size: 13.5px !important; }
  .eh-today-char{ width: 80px !important; max-width: 80px !important; }
}

/* ══════════════════════════════════════════════════════════════════
   MOBILE — research-backed (2026 best practices):
   • Touch targets ≥ 44×44px, 12px+ spacing between
   • 16px body min (iOS auto-zoom prevention)
   • clamp() fluid typography, no abrupt jumps
   • CTAs full-width on narrow screens (thumb-zone friendly)
   • Tight visual grouping (headline+sub+CTA)
   Sources: Apple HIG, Material Design, nngroup
   ══════════════════════════════════════════════════════════════════ */

/* ── Tablet & large phone (≤ 820px already stacks hero grid) ── */

/* ── Standard mobile (≤ 720px) ── */
@media (max-width: 720px){
  /* HERO — tighter padding, fluid headline */
  .eh-hero{ padding: 26px 18px 22px; margin: 12px 12px 18px; border-radius: 24px; }
  .eh-title{ font-size: clamp(26px, 7vw, 34px); line-height: 1.12; margin-bottom: 14px; }
  .eh-lede{ font-size: 15px; line-height: 1.6; margin-bottom: 20px; }
  .eh-meta-row{ margin-bottom: 14px; gap: 6px; }
  .eh-pill{ font-size: 11px; padding: 6px 12px; letter-spacing: .04em; }
  .eh-section-crown{ padding: 11px 18px 11px 14px; gap: 12px; }
  .eh-section-crown-ico{ width: 36px; height: 36px; }
  .eh-section-crown-ico svg{ width: 20px; height: 20px; }
  .eh-section-crown-text small{ font-size: 9.5px; letter-spacing: 0.16em; }
  .eh-section-crown-text b{ font-size: 20px; }
  .eh-section-crown-sub{ font-size: 13px; }
  .eh-page-intro{ margin-bottom: 16px; }
  .eh-page-subtitle{ font-size: 14.5px; margin-top: 10px; max-width: none; }

  /* CTAs — min 44px height, readable font, flex-wrap on wider, stack on narrow */
  .eh-ctas{ gap: 10px; }
  .eh-btn-primary, .eh-btn-ghost{ font-size: 14px; padding: 13px 20px; min-height: 44px; }

  /* SCORE CARD — fluid donut, compact info */
  .eh-score{ padding: 18px; border-radius: 24px; gap: 14px; }
  .eh-score-top{ gap: 14px; }
  .donut{ width: 90px; height: 90px; }
  .donut .center b{ font-size: 22px; }
  .donut .center span{ font-size: 8px; letter-spacing: .1em; margin-top: 2px; }
  .eh-score-info h4{ font-size: 14px; margin-bottom: 3px; }
  .eh-score-info p{ font-size: 12px; line-height: 1.45; }
  .eh-trend{ font-size: 11px; padding: 3px 9px; margin-top: 6px; }
  .eh-streak{ padding: 9px 12px; gap: 9px; }
  .eh-streak b{ font-size: 19px; }
  .eh-streak span{ font-size: 10px; }
  .eh-streak .flame, .eh-streak .spark{ font-size: 20px; }

  /* TODAY MISSION — stack CTA under content */
  .eh-today-grid{ grid-template-columns: 1fr; gap: 12px; }
  .eh-today-cta{ width: 100%; justify-content: center; padding: 14px 22px; min-height: 48px; }
  .eh-today h2{ font-size: 18px; }
  .eh-today .sub{ font-size: 12px; }

  /* SECTION CARDS */
  .eh-cards{ margin: 0 12px; gap: 12px; }
  .eh-scard{ padding: 18px; border-radius: 24px; }
  .eh-scard h3{ font-size: 16px; }
  .eh-scard .desc{ font-size: 12px; line-height: 1.5; margin-top: 8px; }

  /* FULL EXAM CTA (gradient banner) */
  .eh-full{ padding: 24px 20px; margin: 24px 12px 0; border-radius: 28px; }
  .eh-full h3{ font-size: clamp(22px, 6vw, 28px); line-height: 1.15; }
  .eh-full .desc{ font-size: 13px; margin-top: 10px; line-height: 1.5; }
  .eh-full-badge{ font-size: 10px; padding: 5px 12px; }
  .eh-full-preview{ padding: 16px; border-radius: 22px; }
  .eh-full-preview h5{ font-size: 10px; margin-bottom: 8px; }
  .eh-full-preview .row{ padding: 8px 0; font-size: 12px; }
  .eh-full-preview .row .count{ font-size: 10px; padding: 3px 8px; }
  .eh-full-btn-primary{ font-size: 14px; padding: 13px 22px; min-height: 44px; }

  /* STATS BAR */
  .eh-stats{ margin: 22px 12px 0; }
  .sbi{ padding: 14px 16px; border-radius: 20px; }
  .sbi b{ font-size: 24px; }
  .sbi .label{ font-size: 9px; letter-spacing: .08em; }

  /* RESULTS / MOT */
  .eh-results, .eh-mot{ margin: 22px 12px 0; padding: 18px; border-radius: 24px; }
}

/* ── Narrow mobile (≤ 480px) — iPhone SE, small androids ── */
@media (max-width: 480px){
  .eh-hero{ padding: 22px 16px 18px; margin: 10px 10px 16px; border-radius: 22px; }
  .eh-title{ font-size: clamp(22px, 7.5vw, 28px); line-height: 1.15; margin-bottom: 12px; }
  .eh-lede{ font-size: 14px; line-height: 1.55; margin-bottom: 18px; max-width: 100%; }

  /* Stack CTAs full-width — primary below headline (thumb zone) */
  .eh-ctas{ flex-direction: column; gap: 10px; }
  .eh-btn-primary, .eh-btn-ghost{ width: 100%; justify-content: center; padding: 14px 20px; min-height: 48px; }

  /* Score card — compact but legible */
  .eh-score{ padding: 16px; gap: 12px; border-radius: 22px; }
  .eh-score-top{ gap: 12px; }
  .donut{ width: 80px; height: 80px; }
  .donut .center b{ font-size: 20px; }
  .donut .center span{ font-size: 7px; }
  .eh-score-info h4{ font-size: 13px; }
  .eh-score-info p{ font-size: 11px; line-height: 1.4; }
  .eh-streak-row{ gap: 8px; padding-top: 10px; }
  .eh-streak{ padding: 7px 10px; gap: 7px; }
  .eh-streak b{ font-size: 17px; }
  .eh-streak span{ font-size: 9px; }
  .eh-streak .flame, .eh-streak .spark{ font-size: 18px; }

  /* Today mission sizing on small phones — layout is handled by the
     820px mobile hero block above. */
  .eh-today-bar{ padding: 7px 10px; gap: 8px; }

  /* Full exam — stack CTAs */
  .eh-full{ padding: 22px 16px; border-radius: 26px; margin: 22px 10px 0; }
  .eh-full h3{ font-size: clamp(20px, 6.5vw, 26px); }
  .eh-full .desc{ font-size: 12.5px; }
  .eh-full-ctas{ flex-direction: column; align-items: stretch; gap: 10px; }
  .eh-full-btn-primary{ width: 100%; justify-content: center; padding: 14px 22px; min-height: 48px; }
  .eh-full-preview{ padding: 14px; }
  .eh-full-preview .row{ padding: 7px 0; font-size: 11.5px; }

  /* Section cards */
  .eh-cards{ margin: 0 10px; gap: 10px; }
  .eh-scard{ padding: 16px; border-radius: 22px; }

  /* Stats + results + mot */
  .eh-stats{ margin: 18px 10px 0; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .sbi{ padding: 12px 14px; }
  .sbi b{ font-size: 22px; }
  .eh-results, .eh-mot{ margin: 18px 10px 0; padding: 16px; }
}

/* ── Tiny phones (≤ 360px) — iPhone SE 1st gen, old Androids ── */
@media (max-width: 360px){
  .eh-hero{ padding: 20px 14px 16px; }
  .eh-title{ font-size: clamp(20px, 7.8vw, 24px); }
  .eh-lede{ font-size: 13.5px; }
  .donut{ width: 72px; height: 72px; }
  .donut .center b{ font-size: 18px; }
}
`
