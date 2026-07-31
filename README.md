# In-House Hinglish Podcast Transcriber

Created a first-of-its-kind browser-based Hinglish transcriber when no reliable or affordable solution existed, using Deepgram Nova 3 for Hindi STT with speaker diarization and Google Gemini Flash for Devanagari-to-Roman script transliteration, running entirely client-side with zero backend.

## What it does

Transcribes Hinglish (Hindi + English) audio/video with accurate speaker labels. Outputs clean Roman-script Hinglish — the way it's actually spoken — instead of pure Devanagari or broken English.

## Stack

- **Deepgram Nova 3** — Hindi speech-to-text with speaker diarization
- **Google Gemini Flash** — Devanagari-to-Roman transliteration
- **Vanilla JS + HTML** — fully browser-based, zero backend, zero server costs

## Why it exists

No existing transcription tool handles Hinglish well. Options were either English-only, required expensive infra, or produced Devanagari output unsuitable for podcast captions and show notes. This fills that gap entirely in the browser.

## Usage

1. Open `index.html` in a browser
2. Paste your Deepgram and Gemini API keys
3. Upload audio/video file
4. Get speaker-labeled Roman-script Hinglish transcript

## Large files

Deepgram returns a 504 for any pre-recorded request that takes more than 10 minutes to
process, so a multi-hour podcast sent as a single upload fails — the connection is torn
down mid-response and the browser reports only `Failed to fetch`.

The app now splits the mp3 on MPEG frame boundaries into ~10-minute parts before
uploading, so no single request can reach that limit. Splitting is a byte-level
operation (no decoding), so a 3-hour file costs a few hundred milliseconds and a few MB
of memory. Parts are uploaded three at a time with retry/backoff, then the transcripts
are merged: timestamps are re-based onto the full timeline, and an 8-second overlap
between parts is used to keep speaker identities consistent (Deepgram numbers speakers
per request, so "Speaker 0" in part 2 is not automatically the same person as in part 1).

Transliteration is chunked on speaker-turn boundaries for the same reason — the output
is as long as the input, so a whole podcast in one call would exceed the output limit.

### Optionally shrink the file first

Chunking alone is enough to make large files work. If your upload is slow, compressing
first is worth it — Deepgram resamples to 16 kHz internally, so mono 16 kHz costs
nothing in accuracy:

```bash
ffmpeg -i input.mp3 -ac 1 -ar 16000 -b:a 64k -map_metadata -1 output.mp3
```

That takes a 183 MB / 3-hour file down to roughly 25 MB in about 30 seconds. Running the
same transcode in the browser was deliberately not built in: ffmpeg.wasm needs
`SharedArrayBuffer` (which needs COOP/COEP headers Netlify does not send by default) and
a pure-JS encoder would lock the tab up for 8-12 minutes on a file this size — slower
and less reliable than just uploading the chunks.

A CloudConvert API key still enables server-side compression before chunking, as before.
