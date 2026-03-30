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
