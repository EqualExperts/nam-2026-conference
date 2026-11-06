# Winnow transcripts

Where Winnow's conversations live: the demo transcript below, and a record of
every conversation Winnow processes.

Every Winnow run leaves one record in this folder — a meeting, a voice note, a
brainstorm, product or technical. Some of what was said becomes tickets, some
goes into the context, and some is deliberately set aside. The record keeps all
three, so "why did we decide not to do that?" has an answer a month later.

The record is named `YYYY-MM-DD-<title>.md`, so the folder reads in date order,
and has eight fields:

- **Title** — what the conversation was about.
- **Date** — when it happened.
- **Participants** — who took part.
- **Source** — where the source lives: a path or link, or "inline" for a
  paste. The record never holds the raw transcript.
- **Tickets raised** — with links.
- **Context updated** — the context documents changed.
- **Set aside** — what was left out, and why.
- **Q&A** — the questions Winnow asked and how they were answered.

A field Winnow cannot determine reads "Unknown" — never omitted, never guessed.
A pasted brainstorm, for instance, has no participants to name.

This folder sits at the top of `context/`, not under product, because Winnow
can process an architecture discussion just as well as a product one.

## In this folder

- `demo-transcript.txt` — a short, rough transcript of one small product
  change, for trying Winnow without a meeting of your own:
  `/winnow context/winnow-transcripts/demo-transcript.txt`.
