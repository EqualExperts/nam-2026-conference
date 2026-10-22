# Workshop demo ticket — select several tracks

The ticket every attendee files on their fork and ships with `/ship <n> --fast`.
Copy the title and body into a new issue (`gh issue create`, or the GitHub UI).
Each *Done when* line names what a test can check, so the implementer writes
that check the first time — on the first live run a missing "deselect"
assertion cost a whole extra round. `docs/context/schedule.md` (*Gotchas*,
"Several values for one filter") tells the agents how the change lands.

**Title:** Schedule: select several tracks at once

**Body:**

```markdown
On the schedule page you can only pick one track at a time: clicking a second track replaces the first. Someone following two tracks has to flip between them to see their day.

Make the track pills on /schedule multi-select: each pill toggles on and off on its own, and the list shows sessions from any selected track.

## Done when
- Selecting two tracks highlights both, and the list shows exactly the sessions of those two tracks (the result count is the two tracks' counts added).
- After deselecting one of them, only the other track's sessions are listed.
- "All" clears every selected track and lists every track's sessions; it is highlighted when no track is selected.
- The selection is in the URL as `?track=a,b`, so reloading keeps it, and an existing `?track=a` link still shows that one track.
```
