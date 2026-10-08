# Ignore Python bytecode caches like every other generated artefact

## What this changes
`.gitignore` ignores `__pycache__/` and `*.pyc` anywhere in the repo, so running the winnow audio skills no longer leaves untracked bytecode in `git status`. Nothing an attendee sees changes.

## Where
- `.gitignore` — add a "Python bytecode from the winnow skills' scripts" block with `__pycache__/` and `*.pyc` (repo-wide, not pinned to today's skill paths).
- `tests/unit/gitignore.test.js` (new) — runs `git check-ignore` on `.claude/skills/transcribe-audio/scripts/__pycache__/x.pyc`, `.claude/skills/listen-to-meeting/scripts/__pycache__/` and a path under a renamed skill directory; no lane or database needed.
- Working tree of the main checkout: delete the two untracked `__pycache__` directories (not a commit; done by hand, not by the build).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| `.gitignore` ignores `__pycache__/` and `*.pyc` repo-wide | `git check-ignore` succeeds for a `__pycache__` dir and a `.pyc` file at an arbitrary depth (false on main: exit 1) | unit |
| `git status` is clean where the audio skills have been run | same assertion on the two real skill paths, so their output is not listed as untracked | unit |
| `git check-ignore -v` names the new rule | the `-v` output of the test contains `.gitignore` and the pattern `__pycache__/` | unit |

## Out of scope
Winnow 0.9.0's skill renames; deleting bytecode other people's checkouts hold.
