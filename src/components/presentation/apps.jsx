import { later } from './kit.jsx';

/*
 * The apps the room actually uses — GitHub and Claude Desktop, drawn light the
 * way they look — shared by the opening's two ways in and the lab, so the two
 * never drift apart.
 */

/*
 * GitHub, drawn light the way the room sees it: the repo header and its tabs,
 * then a page. Close enough to recognise, not a copy.
 */
export const GH = {
  ink: 'text-[#1f2328]', muted: 'text-[#59636e]', line: 'border-[#d1d9e0]',
  open: 'text-[#1a7f37]', green: 'bg-[#1f883d]', link: 'text-[#0969da]',
};

export function GhOpenIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" /><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
    </svg>
  );
}

const GH_TABS = [['‹›', 'Code'], ['◉', 'Issues', 2], ['⇅', 'Pull requests', 1], ['▷', 'Actions']];

export function GitHub({ tab, children, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-black/10 bg-white ${GH.ink} shadow-2xl shadow-black/50 ${className}`}>
      <div className={`border-b ${GH.line} bg-[#f6f8fa] px-5 pt-3`}>
        <div className="flex items-center gap-3 text-[16px]">
          <span className="size-7 rounded-full bg-[#1f2328]" aria-hidden="true" />
          <span className={GH.muted}>you</span><span className={GH.muted}>/</span><span className="font-semibold">nam-2026-conference</span>
          <span className={`ml-auto rounded-md border ${GH.line} bg-white px-3 py-1 text-[13px] ${GH.muted}`}>Type / to search</span>
        </div>
        <div className="mt-2 flex gap-6 text-[14px]">
          {GH_TABS.map(([icon, name, n]) => (
            <span key={name} className={`flex items-center gap-1.5 border-b-2 pb-2 ${name === tab ? 'border-[#fd8c73] font-semibold' : `border-transparent ${GH.muted}`}`}>
              <span className="text-[12px] opacity-70">{icon}</span>{name}
              {n && <span className="rounded-full bg-black/[0.07] px-1.5 text-[12px]">{n}</span>}
            </span>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * The Code tab of Claude Desktop, as the room will see it: a light window, the
 * project in the sidebar, the session in the middle, its environment on the right.
 */
const SIDEBAR = [['＋', 'New', '⌘N'], ['⌕', 'Search'], ['▢', 'Artifacts'], ['◫', 'Customize'], ['⋯', 'More']];

export function ClaudeDesktop({
  session = 'Ship issue #42',
  ask = 'Hey, can you ship GitHub issue #42?',
  reply = 'On it. I’ll post every step on issue #42, so you can follow along there.',
  steps = ['Read the ticket — it can be built', 'A fast run, as you picked', 'Writing the plan…'],
  question = null,
  compact = false,
  className = 'h-[400px]',
}) {
  // A question Claude asks before it starts — the run to pick — then the reply.
  const replyAt = question ? 2300 : 1200;
  return (
    <div className={`flex ${className} overflow-hidden rounded-2xl border border-black/10 bg-white text-[#1f1e1d] shadow-2xl shadow-black/50`}>
      <div className={`${compact ? 'w-[170px]' : 'w-[215px]'} shrink-0 border-r border-black/10 bg-[#f7f7f5] px-3 py-3 text-[14px]`}>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-[#ff5f57]" /><span className="size-3 rounded-full bg-[#febc2e]" /><span className="size-3 rounded-full bg-[#28c840]" />
          {/* chat or code: two icons, code chosen */}
          <span className="ml-auto flex gap-1">
            <span className="grid size-7 place-items-center rounded-lg text-black/45" aria-hidden="true">
              <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" strokeLinejoin="round" /></svg>
            </span>
            <span className="grid size-7 place-items-center rounded-lg border border-black/10 bg-white text-black/80 shadow-sm" aria-hidden="true">
              <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5M9 3 7 13" /></svg>
            </span>
          </span>
        </div>
        <div className="mt-3 space-y-0.5">
          {SIDEBAR.map(([icon, label, key], i) => (
            <div key={label} className={`flex items-center gap-2.5 rounded-lg px-2 py-1 ${i === 0 ? 'bg-black/5' : ''}`}>
              <span className="w-4 text-center text-black/60">{icon}</span>{label}
              {key && <span className="ml-auto text-[12px] text-black/40">{key}</span>}
            </div>
          ))}
        </div>
        <div className="mt-4 truncate px-2 text-[13px] text-black/50">nam-2026-conference ▾</div>
        <div className="mt-1 truncate rounded-lg bg-black/[0.07] px-2 py-1.5">{session}</div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-black/10 px-5 py-2.5 text-[15px]">{session} <span className="text-black/40">⌄</span></div>
        <div className="flex-1 space-y-3 px-5 py-4 text-[15px] leading-relaxed">
          <div className="pz-appear flex justify-end" style={later(300)}>
            <div className="max-w-[300px] rounded-2xl bg-[#f0eee6] px-4 py-2.5">{ask}</div>
          </div>
          {question && (
            <div className="pz-appear rounded-xl border border-black/10 px-4 py-3" style={later(1000)}>
              <div className="font-medium">{question.ask}</div>
              {/* compact: the choices on one row, so the reply still fits under them */}
              <div className={compact ? 'mt-1.5 flex flex-wrap gap-x-4 gap-y-1' : 'mt-1.5 space-y-1'}>
                {question.options.map((o, i) => (
                  <div key={o} className={`flex items-center gap-2 ${i === 0 ? '' : 'text-black/45'}`}>
                    <span className={`grid size-4 place-items-center rounded-full border ${i === 0 ? 'border-[#2563eb]' : 'border-black/25'}`}>
                      {i === 0 && <span className="pz-pop size-2 rounded-full bg-[#2563eb]" style={later(1700)} />}
                    </span>
                    {o}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="pz-appear" style={later(replyAt)}>
            {reply}
            <ul className="mt-1.5 space-y-0.5">
              {steps.map((l, i) => (
                <li key={l} className="pz-appear flex gap-2" style={later(replyAt + 500 + i * 450)}>
                  <span className={i < steps.length - 1 ? 'text-[#2f9e5b]' : 'text-[#d97757]'}>{i < steps.length - 1 ? '✓' : '●'}</span>{l}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mx-4 mb-4 rounded-2xl border border-black/10 px-4 py-3 text-[14px] text-black/40 shadow-sm">Reply to Claude…</div>
      </div>

      {!compact && <div className="w-[215px] shrink-0 p-3">
        <div className="rounded-xl border border-black/10 p-3 text-[13px]">
          <div className="font-medium">Environment ▾</div>
          <div className="mt-2 space-y-1.5 text-black/80">
            <div>💻 This computer</div>
            <div>📁 nam-2026-conference</div>
            <div>⑂ main</div>
          </div>
        </div>
        <div className="mt-2 flex justify-between rounded-xl border border-black/10 p-3 text-[13px]">
          <span className="font-medium">Context ▸</span><span className="text-black/50">6%</span>
        </div>
      </div>}
    </div>
  );
}

