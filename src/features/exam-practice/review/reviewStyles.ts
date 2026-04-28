/* ═══════════════════════════════════════════════════════════════════
   Shared CSS for the exam review block (matrix + card + option rows +
   passage drawer + confidence prompt). Lives as a string so it can be
   injected via <style>{reviewStyles}</style> inside ExamReviewBlock —
   keeps everything namespaced under .rvw- and avoids touching global
   CSS while still being tree-shaken together with the feature.
   ═══════════════════════════════════════════════════════════════════ */

export const reviewStyles = `
.rvw-root{
  --rvw-ink: #0d294b;
  --rvw-ink-soft: #4A5568;
  --rvw-ink-mute: #6B7280;
  --rvw-pink: #EE2B73;
  --rvw-yellow: #FFE600;
  --rvw-violet: #7C3AED;
  --rvw-teal: #0D9488;
  --rvw-green: #10B981;
  --rvw-green-soft: #D1FAE5;
  --rvw-red: #EF4444;
  --rvw-red-soft: #FEE2E2;
  --rvw-warn: #F59E0B;
  --rvw-surface: #FFFFFF;
  --rvw-paper: #F8FAFC;
  --rvw-paper-2: #F1F5F9;
  --rvw-border: rgba(13,41,75,0.10);
  --rvw-border-strong: rgba(13,41,75,0.18);
  --rvw-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --rvw-shadow-sm: 0 2px 6px rgba(13,41,75,0.06), 0 1px 2px rgba(13,41,75,0.04);
  --rvw-shadow-md: 0 8px 22px rgba(13,41,75,0.08), 0 2px 6px rgba(13,41,75,0.05);
  --rvw-shadow-lg: 0 20px 44px rgba(13,41,75,0.12), 0 6px 14px rgba(13,41,75,0.06);

  position: relative;
  margin-top: 18px;
  font-family: 'Heebo', system-ui, sans-serif;
  color: var(--rvw-ink);
}

/* ═══════════════════════════════════════════════════════════════════
   MATRIX
   ═══════════════════════════════════════════════════════════════════ */
.rvw-matrix{
  background: var(--rvw-surface);
  border-radius: 20px;
  border: 1px solid var(--rvw-border);
  box-shadow: var(--rvw-shadow-md);
  padding: 22px 22px 20px;
  animation: rvwFade 0.4s var(--rvw-ease-out) both;
}
@keyframes rvwFade{ from{ opacity: 0; transform: translateY(6px); } to{ opacity: 1; transform: none; } }
.rvw-matrix-head{
  display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;
  margin-bottom: 14px;
}
.rvw-matrix-head-text small{
  display: block;
  font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--rvw-ink-mute);
  margin-bottom: 4px;
}
.rvw-matrix-head-text b{
  display: block;
  font-family: 'Heebo', sans-serif;
  font-size: 18px; font-weight: 900; color: var(--rvw-ink);
  line-height: 1.1; letter-spacing: -0.015em;
}
.rvw-matrix-head-text em{
  display: block;
  font-style: normal; font-size: 12.5px; font-weight: 600;
  color: var(--rvw-ink-mute); margin-top: 3px;
}
.rvw-matrix-focus{
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, var(--rvw-pink), #FF6B9D);
  color: white;
  border: 0; border-radius: 999px;
  padding: 8px 14px 8px 12px;
  font-family: inherit; font-size: 12.5px; font-weight: 800; letter-spacing: -0.005em;
  cursor: pointer;
  box-shadow: 0 6px 14px rgba(238,43,115,0.3);
  transition: transform 180ms var(--rvw-ease-out), box-shadow 180ms;
}
.rvw-matrix-focus:hover{ transform: translateY(-1px); box-shadow: 0 10px 20px rgba(238,43,115,0.4); }
.rvw-matrix-focus:active{ transform: scale(0.97); }
.rvw-matrix-filters{
  display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap;
}
.rvw-matrix-filter{
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--rvw-paper);
  border: 1.5px solid var(--rvw-border);
  color: var(--rvw-ink-soft);
  padding: 8px 14px; border-radius: 999px;
  font-family: inherit; font-size: 13px; font-weight: 800;
  cursor: pointer;
  transition: all 180ms var(--rvw-ease-out);
}
.rvw-matrix-filter:hover:not(:disabled){ border-color: var(--rvw-border-strong); background: white; }
.rvw-matrix-filter:disabled{ opacity: 0.4; cursor: not-allowed; }
.rvw-matrix-filter.active{
  background: var(--rvw-ink); color: white;
  border-color: var(--rvw-ink);
}
.rvw-matrix-filter-count{
  background: rgba(255,255,255,0.18);
  padding: 1px 7px; border-radius: 999px;
  font-size: 11px; font-weight: 900;
}
.rvw-matrix-filter:not(.active) .rvw-matrix-filter-count{
  background: var(--rvw-paper-2); color: var(--rvw-ink-mute);
}
.rvw-matrix-grid{
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}
@media (max-width: 640px){ .rvw-matrix-grid{ grid-template-columns: repeat(5, 1fr); gap: 6px; } }
@media (max-width: 420px){ .rvw-matrix-grid{ grid-template-columns: repeat(4, 1fr); } }
.rvw-tile{
  position: relative;
  aspect-ratio: 1;
  border: 2px solid transparent;
  border-radius: 14px;
  background: var(--rvw-paper);
  color: var(--rvw-ink);
  font-family: inherit;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px;
  padding: 4px;
  cursor: pointer;
  transition: transform 140ms var(--rvw-ease-out), box-shadow 180ms, border-color 180ms, background 180ms;
  animation: rvwTileIn 0.38s var(--rvw-ease-out) both;
  min-height: 44px;
}
@keyframes rvwTileIn{ from{ opacity: 0; transform: scale(0.9); } to{ opacity: 1; transform: scale(1); } }
.rvw-tile:hover{ transform: translateY(-2px); box-shadow: var(--rvw-shadow-sm); }
.rvw-tile:active{ transform: scale(0.95); }
.rvw-tile-num{
  font-family: 'Heebo', sans-serif;
  font-weight: 900; font-size: 15px; letter-spacing: -0.01em;
  line-height: 1;
}
.rvw-tile-icon{
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px;
}
.rvw-tile-dash{ font-size: 12px; font-weight: 900; color: var(--rvw-ink-mute); }
.rvw-tile-flag{
  position: absolute; top: 3px; right: 4px;
  font-size: 10px; color: var(--rvw-warn);
}
.rvw-tile--ok{
  background: var(--rvw-green-soft);
  border-color: rgba(16,185,129,0.35);
  color: #065F46;
}
.rvw-tile--ok .rvw-tile-icon{ color: var(--rvw-green); }
.rvw-tile--wrong{
  background: var(--rvw-red-soft);
  border-color: rgba(239,68,68,0.35);
  color: #7F1D1D;
}
.rvw-tile--wrong .rvw-tile-icon{ color: var(--rvw-red); }
.rvw-tile--skip{
  background: var(--rvw-paper-2);
  border-color: var(--rvw-border);
  color: var(--rvw-ink-mute);
}
.rvw-matrix-empty{
  padding: 24px 16px; text-align: center;
  color: var(--rvw-ink-mute);
  font-size: 14px; line-height: 1.55;
  background: var(--rvw-paper);
  border-radius: 14px;
}
.rvw-matrix-legend{
  display: flex; gap: 14px; margin-top: 14px;
  font-size: 11px; font-weight: 700; color: var(--rvw-ink-mute);
  justify-content: center;
}
.rvw-matrix-legend > span{ display: inline-flex; align-items: center; gap: 5px; }
.rvw-legend-dot{
  width: 10px; height: 10px; border-radius: 3px; display: inline-block;
}
.rvw-legend-dot.ok{    background: var(--rvw-green); }
.rvw-legend-dot.wrong{ background: var(--rvw-red); }
.rvw-legend-dot.skip{  background: var(--rvw-ink-mute); opacity: 0.5; }

/* ═══════════════════════════════════════════════════════════════════
   CARD
   ═══════════════════════════════════════════════════════════════════ */
.rvw-card{
  background: var(--rvw-surface);
  border-radius: 20px;
  border: 1px solid var(--rvw-border);
  box-shadow: var(--rvw-shadow-md);
  padding: 18px 20px 22px;
  animation: rvwCardIn 0.38s var(--rvw-ease-out) both;
  position: relative;
  scroll-margin-top: 20px;
}
@keyframes rvwCardIn{
  from{ opacity: 0; transform: translateY(10px) scale(0.99); }
  to{ opacity: 1; transform: none; }
}

.rvw-card-top{
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; margin-bottom: 14px;
  padding-bottom: 12px; border-bottom: 1px solid var(--rvw-border);
}
.rvw-card-back{
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--rvw-paper);
  border: 1.5px solid var(--rvw-border);
  color: var(--rvw-ink-soft);
  padding: 7px 12px 7px 10px;
  border-radius: 999px;
  font-family: inherit; font-size: 12.5px; font-weight: 800;
  cursor: pointer;
  transition: all 180ms var(--rvw-ease-out);
}
.rvw-card-back:hover{ background: white; border-color: var(--rvw-border-strong); color: var(--rvw-ink); }
.rvw-card-back:active{ transform: scale(0.97); }
.rvw-card-counter{
  font-family: 'Heebo', sans-serif;
  font-size: 13.5px; font-weight: 700; color: var(--rvw-ink-mute);
  letter-spacing: 0.02em;
}
.rvw-card-counter b{ color: var(--rvw-ink); font-weight: 900; font-size: 15px; }

.rvw-card-meta{
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  margin-bottom: 14px;
}
.rvw-card-type{
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 11px;
  border-radius: 999px;
  font-size: 12.5px; font-weight: 800;
  letter-spacing: -0.005em;
}
.rvw-card-type-emoji{ font-size: 14px; line-height: 1; }
.rvw-card-time{
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; font-weight: 700; color: var(--rvw-ink-mute);
  padding: 5px 10px; border-radius: 999px;
  background: var(--rvw-paper); border: 1px solid var(--rvw-border);
}
.rvw-card-status{
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 11px; border-radius: 999px;
  font-size: 12px; font-weight: 900;
}
.rvw-card-status.ok{ background: var(--rvw-green-soft); color: #065F46; }
.rvw-card-status.wrong{ background: var(--rvw-red-soft); color: #991B1B; }
.rvw-card-status.skip{ background: var(--rvw-paper-2); color: var(--rvw-ink-mute); }

.rvw-card-stem{
  background: var(--rvw-paper);
  border: 1.5px solid var(--rvw-border);
  border-radius: 14px;
  padding: 16px 18px;
  font-family: 'Plus Jakarta Sans', Georgia, 'Times New Roman', serif;
  font-size: 16px; line-height: 1.55; color: #1a1a2e;
  text-align: left;
  margin-bottom: 18px;
  letter-spacing: -0.005em;
}
@media (max-width: 640px){
  .rvw-card-stem{ font-size: 15px; padding: 14px 16px; }
}

/* ═══ Option rows ═══ */
.rvw-card-opts{
  display: flex; flex-direction: column; gap: 10px;
  margin-bottom: 14px;
}
.rvw-opt{
  border-radius: 14px;
  border: 1.5px solid var(--rvw-border);
  background: white;
  overflow: hidden;
  transition: border-color 180ms, background 180ms;
}
.rvw-opt--correct{
  border-color: rgba(16,185,129,0.45);
  background: linear-gradient(180deg, #F0FDF4 0%, white 100%);
}
.rvw-opt--user-wrong{
  border-color: rgba(239,68,68,0.45);
  background: linear-gradient(180deg, #FEF2F2 0%, white 100%);
}
.rvw-opt--muted{ opacity: 0.85; }
.rvw-opt-row{
  display: grid;
  grid-template-columns: auto auto 1fr auto auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  background: transparent; border: 0;
  font-family: inherit; color: inherit;
  text-align: right;
  cursor: pointer;
  transition: background 180ms;
}
.rvw-opt-row:hover{ background: rgba(13,41,75,0.03); }
.rvw-opt-letter{
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  border-radius: 8px;
  background: var(--rvw-paper-2);
  color: var(--rvw-ink-soft);
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 900; font-size: 12px;
  letter-spacing: 0;
}
.rvw-opt--correct .rvw-opt-letter{ background: var(--rvw-green); color: white; }
.rvw-opt--user-wrong .rvw-opt-letter{ background: var(--rvw-red); color: white; }
.rvw-opt-icon{
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px;
}
.rvw-opt--correct .rvw-opt-icon{ color: var(--rvw-green); }
.rvw-opt--user-wrong .rvw-opt-icon{ color: var(--rvw-red); }
.rvw-opt--muted .rvw-opt-icon{ color: var(--rvw-ink-mute); }
.rvw-opt-dot{
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--rvw-ink-mute); opacity: 0.5;
}
.rvw-opt-text{
  font-family: 'Plus Jakarta Sans', Georgia, serif;
  font-size: 15.5px; line-height: 1.4;
  color: var(--rvw-ink);
  letter-spacing: -0.005em;
  overflow-wrap: anywhere;
}
.rvw-opt--muted .rvw-opt-text{ color: var(--rvw-ink-soft); }
.rvw-opt-badge{
  display: inline-flex; align-items: center;
  padding: 3px 9px; border-radius: 999px;
  font-size: 10.5px; font-weight: 900;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.rvw-opt-badge--you{ background: var(--rvw-red-soft); color: #991B1B; }
.rvw-opt-badge--ok{  background: var(--rvw-green-soft); color: #065F46; }
.rvw-opt-chev{
  color: var(--rvw-ink-mute); flex-shrink: 0;
  transition: transform 200ms var(--rvw-ease-out);
}
.rvw-opt-chev.open{ transform: rotate(180deg); }
.rvw-opt-analysis{
  max-height: 0; overflow: hidden;
  transition: max-height 280ms var(--rvw-ease-out);
}
.rvw-opt-analysis.open{ max-height: 600px; }
.rvw-opt-analysis-inner{
  padding: 0 18px 14px 54px;
  font-size: 13.5px; line-height: 1.6;
  color: var(--rvw-ink-soft);
  border-top: 1px dashed var(--rvw-border);
  padding-top: 12px; margin-top: -2px;
}
@media (max-width: 640px){
  .rvw-opt-row{ grid-template-columns: auto auto 1fr auto; gap: 10px; padding: 11px 12px; }
  .rvw-opt-badge{ display: none; }
  .rvw-opt-analysis-inner{ padding-left: 20px; padding-right: 12px; font-size: 13px; }
}

/* ═══ General explanation ═══ */
.rvw-card-expl{
  margin-bottom: 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, #FFF8E1 0%, #FEF3C7 100%);
  border: 1.5px solid rgba(245,158,11,0.25);
  overflow: hidden;
}
.rvw-card-expl-toggle{
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  background: transparent; border: 0;
  padding: 12px 16px;
  font-family: inherit; font-size: 14px; font-weight: 800;
  color: #78350F;
  cursor: pointer;
  text-align: right;
}
.rvw-card-expl-icon{ font-size: 18px; }
.rvw-card-expl-toggle b{ flex: 1; font-weight: 900; }
.rvw-card-expl-chev{ transition: transform 200ms var(--rvw-ease-out); color: #92400E; }
.rvw-card-expl-chev.open{ transform: rotate(180deg); }
.rvw-card-expl-body{
  padding: 0 16px 14px;
  font-size: 14px; line-height: 1.65; color: #713F12;
}

/* ═══ RC passage button ═══ */
.rvw-card-passage-btn{
  display: flex; align-items: center; gap: 12px;
  width: 100%;
  background: linear-gradient(135deg, #E0F2FE, #CFFAFE);
  border: 1.5px solid rgba(13,148,136,0.28);
  color: #134E4A;
  padding: 12px 16px;
  border-radius: 14px;
  font-family: inherit;
  cursor: pointer; text-align: right;
  margin-bottom: 14px;
  transition: all 180ms var(--rvw-ease-out);
}
.rvw-card-passage-btn:hover{
  background: linear-gradient(135deg, #CFFAFE, #BFDBFE);
  transform: translateY(-1px);
  box-shadow: var(--rvw-shadow-sm);
}
.rvw-card-passage-btn b{ display: block; font-size: 14px; font-weight: 900; margin-bottom: 2px; }
.rvw-card-passage-btn small{ font-size: 12px; font-weight: 600; opacity: 0.75; }

/* ═══ Bottom nav ═══ */
.rvw-card-nav{
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  margin-top: 6px;
}
.rvw-card-nav-btn{
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--rvw-paper);
  border: 1.5px solid var(--rvw-border);
  color: var(--rvw-ink-soft);
  padding: 12px 18px;
  border-radius: 14px;
  font-family: inherit; font-size: 14px; font-weight: 800;
  cursor: pointer;
  transition: all 180ms var(--rvw-ease-out);
}
.rvw-card-nav-btn:hover:not(:disabled){ background: white; border-color: var(--rvw-border-strong); color: var(--rvw-ink); }
.rvw-card-nav-btn:active:not(:disabled){ transform: scale(0.98); }
.rvw-card-nav-btn:disabled{ opacity: 0.45; cursor: not-allowed; }
.rvw-card-nav-btn.primary{
  background: linear-gradient(135deg, var(--rvw-ink), #1E3A5F);
  color: white;
  border-color: var(--rvw-ink);
  box-shadow: var(--rvw-shadow-sm);
}
/* Explicit color:white on hover — without it the more-general
   .rvw-card-nav-btn:hover rule above resets color to var(--rvw-ink),
   which equals the navy hover background and the "הבאה" / "סיימנו"
   label literally vanishes (navy on navy). The bug students reported
   on the post-exam review screen ("הכיתוב נעלם בריחוף"). */
.rvw-card-nav-btn.primary:hover:not(:disabled){ background: var(--rvw-ink); color: white; box-shadow: var(--rvw-shadow-md); transform: translateY(-1px); }

/* ═══════════════════════════════════════════════════════════════════
   HYPERCORRECTION PROMPT
   ═══════════════════════════════════════════════════════════════════ */
.rvw-conf{
  margin-bottom: 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%);
  border: 1.5px solid rgba(124,58,237,0.25);
  overflow: hidden;
  animation: rvwConfIn 0.4s var(--rvw-ease-out) both;
}
@keyframes rvwConfIn{ from{ opacity: 0; transform: translateY(-6px); } to{ opacity: 1; transform: none; } }
.rvw-conf-inner{ padding: 16px 18px 18px; }
.rvw-conf-kicker{
  font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--rvw-violet); margin-bottom: 4px;
}
.rvw-conf-q{
  font-family: 'Heebo', sans-serif;
  font-size: 17px; font-weight: 900; color: var(--rvw-ink);
  line-height: 1.2; margin-bottom: 6px; letter-spacing: -0.01em;
}
.rvw-conf-why{
  font-size: 13px; line-height: 1.55; color: var(--rvw-ink-soft);
  margin-bottom: 14px;
}
.rvw-conf-buttons{
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
}
@media (max-width: 640px){ .rvw-conf-buttons{ grid-template-columns: 1fr; } }
.rvw-conf-btn{
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 12px 14px;
  background: white;
  border: 1.5px solid var(--rvw-border);
  border-radius: 12px;
  font-family: inherit; color: var(--rvw-ink);
  text-align: right;
  cursor: pointer;
  transition: all 180ms var(--rvw-ease-out);
}
.rvw-conf-btn:hover:not(:disabled){
  border-color: var(--rvw-violet);
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(124,58,237,0.15);
}
.rvw-conf-btn:active:not(:disabled){ transform: scale(0.98); }
.rvw-conf-btn:disabled{ opacity: 0.5; cursor: default; }
.rvw-conf-btn-emoji{ font-size: 22px; line-height: 1; margin-bottom: 2px; }
.rvw-conf-btn-label{ font-size: 14px; font-weight: 900; color: var(--rvw-ink); }
.rvw-conf-btn-tag{ font-size: 11.5px; font-weight: 600; color: var(--rvw-ink-mute); line-height: 1.35; }
.rvw-conf-btn--high:hover:not(:disabled){ border-color: var(--rvw-pink); }
.rvw-conf-btn--guess:hover:not(:disabled){ border-color: var(--rvw-warn); }

/* ═══════════════════════════════════════════════════════════════════
   PASSAGE DRAWER
   ═══════════════════════════════════════════════════════════════════ */
.rvw-drawer{
  position: fixed; inset: 0;
  z-index: 100;
  pointer-events: none;
  opacity: 0;
  transition: opacity 220ms var(--rvw-ease-out);
}
.rvw-drawer.open{ pointer-events: auto; opacity: 1; }
.rvw-drawer-backdrop{
  position: absolute; inset: 0;
  background: rgba(13,41,75,0.45);
  backdrop-filter: blur(3px);
}
.rvw-drawer-panel{
  position: absolute;
  top: 0; bottom: 0; left: 0;
  width: min(520px, 92vw);
  background: var(--rvw-surface);
  box-shadow: var(--rvw-shadow-lg);
  transform: translateX(-100%);
  transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
  display: flex; flex-direction: column;
}
.rvw-drawer.open .rvw-drawer-panel{ transform: translateX(0); }
.rvw-drawer-head{
  display: flex; align-items: center; gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--rvw-border);
}
.rvw-drawer-head-text{ flex: 1; min-width: 0; }
.rvw-drawer-head-text small{
  display: block;
  font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--rvw-ink-mute); margin-bottom: 2px;
}
.rvw-drawer-head-text b{
  display: block;
  font-family: 'Heebo', sans-serif;
  font-size: 16px; font-weight: 900; color: var(--rvw-ink);
  line-height: 1.2; letter-spacing: -0.01em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rvw-drawer-close{
  display: inline-flex; align-items: center; justify-content: center;
  width: 38px; height: 38px;
  border-radius: 12px;
  background: var(--rvw-paper); border: 1.5px solid var(--rvw-border);
  color: var(--rvw-ink-soft);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 180ms var(--rvw-ease-out);
}
.rvw-drawer-close:hover{ background: white; border-color: var(--rvw-border-strong); color: var(--rvw-ink); }
.rvw-drawer-close:active{ transform: scale(0.95); }
.rvw-drawer-body{
  flex: 1; overflow-y: auto;
  padding: 20px 22px;
  font-family: 'Plus Jakarta Sans', Georgia, serif;
  font-size: 15.5px; line-height: 1.7; color: #1a1a2e;
  text-align: left;
}
.rvw-drawer-body p{ margin-bottom: 14px; }
.rvw-drawer-body p:last-child{ margin-bottom: 0; }
.rvw-drawer-foot{
  padding: 14px 20px 18px;
  border-top: 1px solid var(--rvw-border);
}
.rvw-drawer-done{
  width: 100%;
  background: linear-gradient(135deg, var(--rvw-ink), #1E3A5F);
  color: white;
  border: 0; border-radius: 12px;
  padding: 12px 20px;
  font-family: inherit; font-size: 14px; font-weight: 900;
  cursor: pointer;
  box-shadow: var(--rvw-shadow-sm);
  transition: all 180ms var(--rvw-ease-out);
}
.rvw-drawer-done:hover{ transform: translateY(-1px); box-shadow: var(--rvw-shadow-md); }

@media (max-width: 900px){
  /* Mobile: sheet slides from the BOTTOM instead of the side */
  .rvw-drawer-panel{
    top: auto;
    left: 0; right: 0; bottom: 0;
    width: 100%;
    max-height: 85vh;
    border-top-left-radius: 20px;
    border-top-right-radius: 20px;
    transform: translateY(100%);
  }
  .rvw-drawer.open .rvw-drawer-panel{ transform: translateY(0); }
  .rvw-drawer-panel::before{
    /* Grab handle */
    content: ''; display: block;
    width: 40px; height: 4px;
    background: rgba(13,41,75,0.15);
    border-radius: 2px;
    margin: 8px auto 4px;
  }
}
`
