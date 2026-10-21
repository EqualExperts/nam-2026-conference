import { at, Show, Replay, Code, Kicker, Terminal, Tick, later } from '../kit.jsx';
import { box, Line, Wave, Chunks, Flag, LaneTag, typedFor } from './kit.jsx';

/* ------------------------------------------------------------------ *
 * Listen — the meeting, live. Left: the two channels and the transcript as
 * it lands. Right: the session directory filling with chunks, and the chat
 * where the listener says nothing — until something matters.
 * ------------------------------------------------------------------ */

/* The transcript, by the beat each line arrives in. A visible correction
 * (beat 1) is accepted in silence; an unremarked contradiction (beat 2) is
 * held one chunk, then flagged — and the room moves on without resolving it;
 * a gap (beat 3) is held two, flagged, and answered in the room. Every line
 * winnow later sorts is said here. Each line types once the one before is done. */
const SAID = [
  { from: 0, who: 'andy',    time: '00:00:40', t: 'Can everyone see my screen?' },
  { from: 0, who: 'jonas',   time: '00:01:05', t: "Coffee's at 10:30, by the way." },
  { from: 0, who: 'andy',    time: '00:03:10', t: 'The day tabs on the schedule are fine as they are.' },
  { from: 0, who: 'abraham', time: '00:06:20', t: ['On a phone the schedule is all filters and no sessions.', 'You scroll past the whole block before you see a talk.'] },
  { from: 1, who: 'jonas',   time: '00:09:45', t: ["It's the speakers page -- actually, scratch that:", 'the schedule page. The one with the stacked filters.'] },
  { from: 2, who: 'andy',    time: '00:14:30', t: 'Honestly the day tabs are the worst of it. A whole row.' },
  { from: 2, who: 'abraham', time: '00:16:10', t: 'Every filter still has to be reachable on a phone, though.', after: 2600 },
  { from: 3, who: 'jonas',   time: '00:22:05', t: 'Compact it until it fits on a phone, then.' },
  { from: 3, who: 'jonas',   time: '00:23:40', t: 'Modern phones. iPhone 15 size; smaller is out of scope.', after: 4300 },
  { from: 3, who: 'andy',    time: '00:24:30', t: 'The My agenda card on phones? No idea. Someone decide later.' },
  { from: 3, who: 'jonas',   time: '00:25:00', t: "Let's pick this up after the keynote." },
];

const TRANSCRIPT = (() => {
  let clock = 300;
  let step = 0;
  return SAID.map((l) => {
    if (l.from !== step) { step = l.from; clock = 300; }
    const delay = Math.max(clock, l.after ?? 0);
    clock = delay + typedFor(l.t) + 100;
    return { ...l, delay };
  });
})();

/* chunks on disk at each beat, and how many are new */
const CHUNKS = [[4, 4], [9, 5], [13, 4], [21, 8]];

function Lanes() {
  return (
    <div className="grid grid-cols-2 gap-5">
      {[
        { lane: 'me', icon: '🎤', what: 'microphone', tone: 'text-emerald-300' },
        { lane: 'others', icon: '🔈', what: 'system audio', tone: 'text-sky-300' },
      ].map((l) => (
        <div key={l.lane} className={`${box} flex h-[60px] items-center gap-4 px-5`}>
          <span className="relative grid size-9 place-items-center text-[20px]">
            <span className={`pz-radar absolute inset-0 rounded-full border ${l.lane === 'me' ? 'border-emerald-300' : 'border-sky-300'}`} aria-hidden="true" />
            {l.icon}
          </span>
          <LaneTag lane={l.lane} />
          <span className="text-[15px] text-faint">{l.what}</span>
          <Wave n={24} className={`ml-auto ${l.tone}`} />
        </div>
      ))}
    </div>
  );
}

function Transcript({ step }) {
  const lines = TRANSCRIPT.filter((l) => l.from <= step).slice(-5);
  return (
    <div className={`${box} flex h-full flex-col overflow-hidden`}>
      <div className="flex items-center gap-2 border-b border-hairline px-5 py-2 font-mono text-[14px] text-faint">
        <span className="size-2 rounded-full bg-rose-400 animate-pulse-dot" /> transcript.md · live
        <span className="ml-auto">the listener knows only <span className="text-emerald-300">Me</span> or <span className="text-sky-300">Others</span> — no diarization</span>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-4 px-5 py-4">
        {/* a line keeps its delay for life: changing it would restart its typing on every later beat */}
        {lines.map((l) => <Line key={l.time} who={l.who} time={l.time} t={l.t} delay={l.delay} />)}
      </div>
    </div>
  );
}

function SessionDir({ step }) {
  const [count, fresh] = CHUNKS[step];
  return (
    <div className={`${box} p-5`}>
      <div className="flex items-baseline justify-between font-mono">
        <span className="text-[15px] text-ink">~/.winnow/sessions/orbit-phones/</span>
        <span className="text-[15px] text-violet-300">wait.py --after {count - fresh}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between font-mono text-[13px] text-faint">
        <span><span className="text-muted">chunks/</span> {count} files · 5–60 s each</span>
        <span>status.json · transcript.md · meeting-state.md</span>
      </div>
      <div className="mt-2.5"><Chunks key={step} count={count} fresh={fresh} /></div>
    </div>
  );
}

/* The listener's view of the room, in meeting-state.md. */
function State({ delay = 300, children }) {
  return (
    <div className="pz-appear rounded-lg border border-hairline bg-ground/70 px-4 py-2 font-mono text-[15px] leading-relaxed text-muted" style={later(delay)}>
      <div className="text-[13px] text-faint">meeting-state.md</div>
      {children}
    </div>
  );
}

/* One beat's reply, laid over the panel so hidden beats take no room. */
const page = 'absolute inset-x-3 top-3 flex flex-col gap-2.5';

function Chat({ step }) {
  return (
    <div className={`${box} flex h-full flex-col overflow-hidden`}>
      <div className="flex items-center gap-2 border-b border-hairline px-5 py-2 font-mono text-[14px] text-faint">
        <span className="grid size-5 place-items-center rounded-full bg-violet-500/30 text-[11px]">🤖</span> claude · listening
      </div>
      <div className="relative flex-1">
        <Replay on={step === 0} className={page}>
          <div className="rounded-xl border border-hairline bg-raised px-4 py-3 text-[17px] text-ink">
            I’m listening now. When the meeting ends, just tell me — “meeting’s over” — and I’ll wrap up.
          </div>
          <div className="pz-appear flex items-center gap-3 self-center font-mono text-[15px] text-faint" style={later(2600)}>
            <span className="pz-caret">●</span> silent — an ordinary chunk gets no reply
          </div>
        </Replay>

        <Replay on={step === 1} className={page}>
          <State delay={1600}>
            <div>00:09:45 Others · stacked filters: <span className="pz-strike text-rose-300" style={later(2200)}>speakers page</span> <span className="text-amber-300">corrected</span> → schedule page</div>
          </State>
          <div className="pz-appear flex items-center gap-3 self-center font-mono text-[15px] text-faint" style={later(2800)}>
            <Tick className="size-6 text-[12px]" /> the room corrected itself — nothing to say
          </div>
          {/* the one line it sends unprompted: ten quiet minutes since the greeting */}
          <div className="pz-appear rounded-xl border border-hairline bg-raised px-4 py-3 text-[17px] text-ink" style={later(3600)}>
            Still listening — 9 chunks in, nothing worth flagging so far.
            <div className="mt-1 text-[14px] text-faint">proof of life · only after ~10 min with nothing to say</div>
          </div>
        </Replay>

        <Replay on={step === 2} className={page}>
          <State>
            <div>00:03:10 Others · day tabs: fine as they are · <span className="text-emerald-300">live</span></div>
            <div>00:14:30 Others · day tabs: the worst of it · <span className="text-amber-300">contradicts, unremarked</span></div>
            <div className="pz-appear text-faint" style={later(900)}>chunk 12 · nobody picks it up → hold one more</div>
            <div className="pz-appear text-faint" style={later(1500)}>chunk 13 · still unremarked → <span className="text-amber-300">flag</span></div>
          </State>
          <Flag
            kind="conflict" time="00:14:30" delay={2100}
            lines={['Earlier (00:03:10, Others): "the day tabs are fine as they are"', 'Now (00:14:30, Others): "the day tabs are the worst of it"']}
            check="Earlier the day tabs were fine — do they get compacted too, or stay?"
          />
        </Replay>

        <Replay on={step === 3} className={page}>
          <State>
            <div>00:22:05 Others · "fits on a phone" — which phones? · <span className="text-cyan-300">watching</span></div>
            <div className="pz-appear text-faint" style={later(800)}>chunks 19, 20 · nobody says → hold two more</div>
            <div className="pz-appear text-faint" style={later(1400)}>chunk 21 · still open → <span className="text-cyan-300">surfaced</span></div>
            <div className="pz-appear text-emerald-300" style={later(5400)}>00:23:40 Others · answered in the room → filled</div>
          </State>
          <Flag
            kind="gap" time="00:22:05" delay={2000}
            lines={['(00:22:05, Others): "Compact it until it fits on a phone."', 'Nothing in the context or this meeting says which phones count.']}
            check="What is the smallest phone we support?"
          />
        </Replay>
      </div>
    </div>
  );
}

function ListenScene({ step }) {
  return (
    <>
      <div style={at(80, 70, 760, 60)}><Lanes /></div>
      <div style={at(80, 150, 760, 470)}><Transcript step={step} /></div>
      <div style={at(880, 70, 640, 150)}><SessionDir step={step} /></div>
      <div style={at(880, 240, 640, 380)}><Chat step={step} /></div>
    </>
  );
}

const LISTEN_BEATS = [
  {
    kicker: '3 · Listen',
    title: 'Two channels, local Whisper, chunks on disk',
    body: 'Mic is Me, the call’s audio is Others — a channel switch stands in for a speaker change. faster-whisper runs on the laptop, 0.6 s of silence ends an utterance, and the text lands in chunk files the agent polls.',
  },
  {
    kicker: '3 · Staying quiet',
    title: 'A visible correction needs no flag',
    body: 'Most chunks are ordinary, and the right output for ordinary is silence. Jonas corrected himself: the state file notes it, nothing is said. The one line sent unprompted is proof of life, after ten quiet minutes.',
  },
  {
    kicker: '3 · ⚑ A conflict',
    title: 'An unremarked contradiction is held, then flagged',
    body: 'Andy says the day tabs are fine, then the worst of it, and nobody notices. One more chunk, in case the room catches it. It doesn’t: the flag arrives with both quotes — and the room moves on. Winnow will ask.',
  },
  {
    kicker: '3 · ❓ A gap',
    title: 'A gap is held two chunks — then the room answers',
    body: '“Fits on a phone” is anchored to nothing: the context never says which phones count. Held two chunks in case someone says, then surfaced. Jonas answers ninety seconds later — the answer Friday would have guessed.',
  },
];

/* ------------------------------------------------------------------ *
 * Meeting's over: stop, flush, report — and offer the next step.
 * ------------------------------------------------------------------ */

function OverScene() {
  return (
    <>
      <Terminal
        title="claude — listening · orbit-phones"
        style={at(80, 70, 900, 540)}
        bodyClass="text-[17px]"
        lines={[
          { t: "meeting's over", tone: 'cmd' },
          { t: 'stop → written · the capture flushes what it still holds', tone: 'dim', delay: 900 },
          { t: 'chunk-0041.txt · transcript.md complete · meeting-state.md saved', delay: 1500 },
          { t: 'Listened for 38 min · 41 chunks · 2 flags: 1 conflict still open, 1 gap filled in the room.', tone: 'ok', delay: 2300 },
          { t: 'Want me to winnow transcript.md now? I will only start if you say so.', tone: 'hi', delay: 3300 },
          { t: 'yes', tone: 'cmd', delay: 4600 },
        ]}
      />
      <Show from="right" delay={3600} style={at(1020, 70, 500, 250)} className={`${box} p-6`}>
        <Kicker>Never auto-chains</Kicker>
        <div className="mt-2 font-display text-[26px] leading-tight text-ink">It offers. You decide.</div>
        <div className="mt-3 text-[17px] text-muted">The same human checkpoint sits between every skill in the chain — listen never starts winnow, winnow never edits a doc or raises a ticket on its own.</div>
      </Show>
      <Show from="right" delay={4000} style={at(1020, 350, 500, 260)} className={`${box} p-6`}>
        <Kicker>What it leaves behind</Kicker>
        <div className="mt-3 space-y-1.5 font-mono text-[15px] text-muted">
          <div><Code>chunks/</Code> 41 files</div>
          <div><Code>transcript.md</Code> the whole meeting, by channel</div>
          <div><Code>meeting-state.md</Code> assertions and gaps — one conflict still open</div>
          <div><Code>status.json</Code> the last heartbeat</div>
        </div>
      </Show>
    </>
  );
}

const OVER_BEATS = [
  {
    kicker: '4 · Meeting’s over',
    title: 'Stop, flush, report — and offer to winnow',
    body: 'Say it in plain words. The capture writes its last chunks and completes the transcript; the agent reports how long it listened and what it flagged. Then it offers winnow and waits — nothing here chains on its own.',
  },
];

export const LISTEN = [
  { id: 'listen', name: 'Listen', accent: 'text-emerald-300', tone: 'emerald', beats: LISTEN_BEATS, Scene: ListenScene },
  { id: 'over', name: 'Meeting’s over', accent: 'text-amber-300', tone: 'amber', beats: OVER_BEATS, Scene: OverScene },
];
