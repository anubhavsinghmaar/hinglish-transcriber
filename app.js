// ── DOM References ──
const $ = (id) => document.getElementById(id);
const settingsBtn = $("settingsBtn");
const settingsModal = $("settingsModal");
const closeModalBtn = $("closeModalBtn");
const deepgramKeyInput = $("deepgramKeyInput");
const geminiKeyInput = $("geminiKeyInput");
const cloudConvertKeyInput = $("cloudConvertKeyInput");
const saveKeysBtn = $("saveKeysBtn");
const saveStatus = $("saveStatus");
const dropZone = $("dropZone");
const fileInput = $("fileInput");
const fileInfo = $("fileInfo");
const fileName = $("fileName");
const fileSize = $("fileSize");
const removeFileBtn = $("removeFileBtn");
const processBtn = $("processBtn");
const statusCard = $("statusCard");
const statusSpinner = $("statusSpinner");
const statusCheck = $("statusCheck");
const statusError = $("statusError");
const statusText = $("statusText");
const progressBar = $("progressBar");
const errorCard = $("errorCard");
const errorText = $("errorText");
const outputCard = $("outputCard");
const outputArea = $("outputArea");
const deepgramArea = $("deepgramArea");
const copyDgBtn = $("copyDgBtn");
const copyGmBtn = $("copyGmBtn");
const steps = [1, 2, 3, 4].map((i) => $("step" + i));

let selectedFile = null;

// ── Helpers ──
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024,
    sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatTime(seconds) {
  if (!seconds) return "[00:00]";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `[${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}]`;
  }
  return `[${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}]`;
}

function toggleVisibility(inputId, btn) {
  const inp = $(inputId);
  const isPassword = inp.type === "password";
  inp.type = isPassword ? "text" : "password";
  btn.querySelector(".eye-open").classList.toggle("hidden", isPassword);
  btn.querySelector(".eye-closed").classList.toggle("hidden", !isPassword);
}

// Convert Web Audio API AudioBuffer → WAV ArrayBuffer (pure JS, zero deps)
function audioBufferToWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;

  // Interleave channels
  let interleaved;
  if (numChannels === 1) {
    interleaved = audioBuffer.getChannelData(0);
  } else {
    const length = audioBuffer.length;
    interleaved = new Float32Array(length * numChannels);
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        interleaved[i * numChannels + ch] = audioBuffer.getChannelData(ch)[i];
      }
    }
  }

  // Convert float samples to 16-bit PCM
  const dataLength = interleaved.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // WAV header
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);                          // subchunk1 size
  view.setUint16(20, format, true);                      // audio format (PCM)
  view.setUint16(22, numChannels, true);                 // channels
  view.setUint32(24, sampleRate, true);                  // sample rate
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true);             // block align
  view.setUint16(34, bitsPerSample, true);               // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return buffer;
}

// ── Settings Modal ──
function openModal() {
  deepgramKeyInput.value = localStorage.getItem("deepgramKey") || "";
  geminiKeyInput.value = localStorage.getItem("geminiKey") || "";
  cloudConvertKeyInput.value = localStorage.getItem("cloudConvertKey") || "";
  saveStatus.classList.add("hidden");
  settingsModal.style.display = "flex";
  settingsModal.classList.remove("hidden");
  requestAnimationFrame(() => (settingsModal.style.opacity = "1"));
}

function closeModal() {
  settingsModal.style.opacity = "0";
  setTimeout(() => {
    settingsModal.style.display = "none";
    settingsModal.classList.add("hidden");
  }, 250);
}

settingsBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);
settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) closeModal();
});

saveKeysBtn.addEventListener("click", () => {
  const dg = deepgramKeyInput.value.trim();
  const gm = geminiKeyInput.value.trim();
  const cc = cloudConvertKeyInput.value.trim();
  if (dg) localStorage.setItem("deepgramKey", dg);
  else localStorage.removeItem("deepgramKey");
  if (gm) localStorage.setItem("geminiKey", gm);
  else localStorage.removeItem("geminiKey");
  if (cc) localStorage.setItem("cloudConvertKey", cc);
  else localStorage.removeItem("cloudConvertKey");
  saveStatus.classList.remove("hidden");
  setTimeout(() => saveStatus.classList.add("hidden"), 2500);
});

// ── File Upload ──
function handleFile(file) {
  if (!file) return;
  const name = file.name.toLowerCase();
  const isMP3 = name.endsWith(".mp3") || file.type === "audio/mpeg";
  
  if (!isMP3) {
    showError("Please select a valid .mp3 file.");
    return;
  }
  selectedFile = file;
  deepgramArea.value = "";
  outputArea.value = "";
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  fileInfo.classList.remove("hidden");
  fileInfo.classList.add("flex");
  processBtn.disabled = false;
  errorCard.classList.add("hidden");
}

function clearFile() {
  selectedFile = null;
  fileInput.value = "";
  fileInfo.classList.add("hidden");
  fileInfo.classList.remove("flex");
  processBtn.disabled = true;
  deepgramArea.value = "";
  outputArea.value = "";
}

fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
removeFileBtn.addEventListener("click", clearFile);

// Drag & Drop
["dragenter", "dragover"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
});
["dragleave", "drop"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
  });
});
dropZone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  handleFile(file);
});
dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

// ── Status UI ──
function resetStatus() {
  statusCard.classList.add("hidden");
  errorCard.classList.add("hidden");
  outputCard.classList.add("hidden");
  progressBar.style.width = "0%";
  steps.forEach((s) => {
    s.className = "process-step";
  });
  statusSpinner.classList.add("hidden");
  statusCheck.classList.add("hidden");
  statusError.classList.add("hidden");
  deepgramArea.value = "";
  outputArea.value = "";
}

function showStatus(msg, percent, currentStep) {
  statusCard.classList.remove("hidden");
  statusText.textContent = msg;
  statusSpinner.classList.remove("hidden");
  statusCheck.classList.add("hidden");
  statusError.classList.add("hidden");
  progressBar.style.width = percent + "%";
  steps.forEach((s, i) => {
    if (i < currentStep || currentStep >= steps.length) {
      s.className = "process-step is-complete";
    } else if (i === currentStep) {
      s.className = "process-step is-active";
    } else {
      s.className = "process-step";
    }
  });
}

function showDone() {
  statusSpinner.classList.add("hidden");
  statusCheck.classList.remove("hidden");
  statusText.textContent = "Ready when you are";
  progressBar.style.width = "100%";
  steps.forEach((s) => {
    s.className = "process-step is-complete";
  });
}

function showError(msg) {
  errorCard.classList.remove("hidden");
  errorText.textContent = msg;
  statusSpinner.classList.add("hidden");
  statusError.classList.remove("hidden");
}

// ── Copy to Clipboard (reusable) ──
function setupCopyBtn(btn, textarea) {
  btn.addEventListener("click", async () => {
    const icon = btn.querySelector(".copy-icon");
    const check = btn.querySelector(".copied-icon");
    const label = btn.querySelector(".copy-label");
    try {
      await navigator.clipboard.writeText(textarea.value);
    } catch {
      textarea.select();
      document.execCommand("copy");
    }
    icon.classList.add("hidden");
    check.classList.remove("hidden");
    label.textContent = "Copied!";
    setTimeout(() => {
      icon.classList.remove("hidden");
      check.classList.add("hidden");
      label.textContent = "Copy";
    }, 2000);
  });
}
setupCopyBtn(copyDgBtn, deepgramArea);
setupCopyBtn(copyGmBtn, outputArea);

// ── Network helper ──
// fetch() rejects with a bare "Failed to fetch" that names no service, which makes
// a dropped connection impossible to attribute. Wrap every call so the error says
// which API broke.
async function fetchOr(label, url, opts) {
  try {
    return await fetch(url, opts);
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new Error(
      `Could not reach ${label}. Check your internet connection, or whether a browser extension or proxy is blocking the request. (${err.message})`
    );
  }
}

// ── MP3 frame parsing (ISO/IEC 11172-3 + 13818-3) ──
// Used to cut a large mp3 into smaller valid mp3s WITHOUT decoding it. Decoding a
// 3-hour file via decodeAudioData would allocate gigabytes of Float32 PCM and kill
// the tab; slicing at frame boundaries is a pure byte operation.
const MPEG_V25 = 0, MPEG_RESERVED = 1, MPEG_V2 = 2, MPEG_V1 = 3;
const LAYER_RESERVED = 0, LAYER_III = 1, LAYER_II = 2, LAYER_I = 3;

const MP3_BITRATE = [];
MP3_BITRATE[MPEG_V1] = [];
MP3_BITRATE[MPEG_V1][LAYER_I] = [0,32,64,96,128,160,192,224,256,288,320,352,384,416,448,-1];
MP3_BITRATE[MPEG_V1][LAYER_II] = [0,32,48,56,64,80,96,112,128,160,192,224,256,320,384,-1];
MP3_BITRATE[MPEG_V1][LAYER_III] = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,-1];
MP3_BITRATE[MPEG_V2] = [];
MP3_BITRATE[MPEG_V2][LAYER_I] = [0,32,48,56,64,80,96,112,128,144,160,176,192,224,256,-1];
MP3_BITRATE[MPEG_V2][LAYER_II] = [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,-1];
MP3_BITRATE[MPEG_V2][LAYER_III] = MP3_BITRATE[MPEG_V2][LAYER_II];
MP3_BITRATE[MPEG_V25] = MP3_BITRATE[MPEG_V2];

const MP3_SRATE = [];
MP3_SRATE[MPEG_V1] = [44100, 48000, 32000];
MP3_SRATE[MPEG_V2] = [22050, 24000, 16000];
MP3_SRATE[MPEG_V25] = [11025, 12000, 8000];

function parseFrameHeader(u8, p) {
  if (p + 4 > u8.length) return null;
  const b2 = u8[p + 1], b3 = u8[p + 2], b4 = u8[p + 3];
  if (u8[p] !== 0xff || (b2 & 0xe0) !== 0xe0) return null; // 11-bit frame sync

  const version = (b2 >> 3) & 3, layer = (b2 >> 1) & 3;
  if (version === MPEG_RESERVED || layer === LAYER_RESERVED) return null;

  const bIdx = (b3 >> 4) & 15, sIdx = (b3 >> 2) & 3, padding = (b3 >> 1) & 1;
  if (bIdx === 0 || bIdx === 15 || sIdx === 3) return null; // free / bad / reserved

  const kbps = MP3_BITRATE[version][layer][bIdx], sampleRate = MP3_SRATE[version][sIdx];
  if (!kbps || kbps < 0 || !sampleRate) return null;
  const bitrate = kbps * 1000;

  const spf = layer === LAYER_I ? 384
    : layer === LAYER_II ? 1152
    : (version === MPEG_V1 ? 1152 : 576);

  const frameLength = layer === LAYER_I
    ? (Math.floor(12 * bitrate / sampleRate) + padding) * 4
    : Math.floor(spf / 8 * bitrate / sampleRate) + padding;
  if (frameLength < 21) return null;

  return {
    frameLength, version, layer, sampleRate, samplesPerFrame: spf,
    channelMode: (b4 >> 6) & 3, durationSec: spf / sampleRate,
  };
}

// ID3v2 tag at the head: "ID3", flags byte 5 (0x10 = v2.4 footer), synchsafe size 6..9
function id3v2Size(u8) {
  if (u8.length < 10) return 0;
  if (u8[0] !== 0x49 || u8[1] !== 0x44 || u8[2] !== 0x33) return 0;
  if (u8[3] >= 0xff || u8[4] === 0xff) return 0;
  if ((u8[6] | u8[7] | u8[8] | u8[9]) & 0x80) return 0;
  return 10 + ((u8[6] << 21) | (u8[7] << 14) | (u8[8] << 7) | u8[9]) + ((u8[5] & 0x10) ? 10 : 0);
}

// Xing / Info / VBRI ghost frame — metadata only, decodes to silence. Skip it.
function isXingFrame(u8, p, hdr) {
  if (p + 40 <= u8.length &&
      u8[p+36] === 0x56 && u8[p+37] === 0x42 && u8[p+38] === 0x52 && u8[p+39] === 0x49) return true;
  const mono = hdr.channelMode === 3;
  const sideInfo = hdr.version === MPEG_V1 ? (mono ? 17 : 32) : (mono ? 9 : 17);
  const q = p + 4 + sideInfo;
  if (q + 4 > u8.length) return false;
  const a = u8[q], b = u8[q+1], c = u8[q+2], d = u8[q+3];
  return (a === 0x58 && b === 0x69 && c === 0x6e && d === 0x67)  // "Xing"
      || (a === 0x49 && b === 0x6e && c === 0x66 && d === 0x6f); // "Info"
}

// Stream the file, index every frame, then cut on frame boundaries. Each chunk is a
// standalone mp3. A small overlap lets the merge step re-anchor speaker identity.
const FRAME_CARRY = 1 << 16;

async function splitMp3ByFrames(file, {
  maxBytes = 40 * 1024 * 1024, maxSeconds = 600, overlapSeconds = 8, onProgress = null,
} = {}) {
  let cap = 1 << 16, n = 0;
  let offsets = new Float64Array(cap), times = new Float64Array(cap);
  const push = (off, t) => {
    if (n === cap) {
      cap *= 2;
      const o = new Float64Array(cap); o.set(offsets); offsets = o;
      const s = new Float64Array(cap); s.set(times); times = s;
    }
    offsets[n] = off; times[n] = t; n++;
  };

  const reader = file.stream().getReader();
  let carry = new Uint8Array(0), carryBase = 0;
  let cursor = 0, lastFrameEnd = 0, elapsed = 0;
  let started = false, eof = false;

  while (!eof) {
    const { value, done } = await reader.read();
    eof = done;
    if (value?.length) {
      const m = new Uint8Array(carry.length + value.length);
      m.set(carry, 0); m.set(value, carry.length); carry = m;
    }
    if (!carry.length) break;
    if (!started) { cursor = Math.max(cursor, carryBase + id3v2Size(carry)); started = true; }

    for (;;) {
      const rel = cursor - carryBase;
      if (rel < 0) { cursor = carryBase; continue; }
      if (rel + 4 > carry.length) break;

      const midTag = id3v2Size(carry.subarray(rel)); // mid-stream tag in stitched files
      if (midTag > 0) {
        if (rel + midTag > carry.length && !eof) break;
        cursor += midTag; continue;
      }

      const hdr = parseFrameHeader(carry, rel);
      if (!hdr) { // resync: scan for a sync word confirmed by the following frame
        let found = -1;
        for (let i = rel; i <= carry.length - 4; i++) {
          if (carry[i] !== 0xff) continue;
          const h = parseFrameHeader(carry, i);
          if (!h) continue;
          const nx = i + h.frameLength;
          if (nx + 4 <= carry.length) {
            const h2 = parseFrameHeader(carry, nx);
            if (!h2 || h2.sampleRate !== h.sampleRate || h2.layer !== h.layer) continue;
          } else if (!eof) break;
          found = i; break;
        }
        if (found < 0) { cursor = Math.max(cursor, carryBase + carry.length - 3); break; }
        cursor = carryBase + found; continue;
      }
      if (rel + hdr.frameLength > carry.length) {
        if (eof) cursor = carryBase + carry.length;
        break;
      }
      if (isXingFrame(carry, rel, hdr)) {
        cursor += hdr.frameLength; lastFrameEnd = cursor; continue;
      }

      push(cursor, elapsed);
      elapsed += hdr.durationSec;
      cursor += hdr.frameLength;
      lastFrameEnd = cursor;
    }

    // Clamp to what is actually buffered. A leading ID3v2 tag (cover art routinely
    // pushes this past 128 KB) can put `cursor` beyond `carry`, and advancing
    // carryBase by more than we can drop would desync it from the real file offset
    // permanently — silently shifting every frame offset and timestamp after it.
    const keepFrom = Math.max(0, cursor - carryBase - FRAME_CARRY);
    const drop = Math.min(keepFrom, carry.length);
    if (drop > 0) { carry = carry.slice(drop); carryBase += drop; }
    onProgress?.(Math.min(1, cursor / file.size));
  }
  reader.releaseLock?.();
  if (n === 0) throw new Error("No MPEG audio frames found — this does not look like a usable MP3.");
  push(lastFrameEnd, elapsed); // sentinel, excludes trailing ID3v1/APEv2 junk

  const chunks = [];
  let i = 0;
  const last = n - 1;
  while (i < last) {
    let j = i + 1;
    while (j < last && offsets[j+1] - offsets[i] <= maxBytes
                    && times[j+1] - times[i] <= maxSeconds) j++;
    let head = i;
    if (overlapSeconds > 0 && i > 0) {
      const target = times[i] - overlapSeconds;
      while (head > 0 && times[head-1] >= target) head--;
    }
    chunks.push({
      index: chunks.length,
      blob: file.slice(offsets[head], offsets[j], "audio/mpeg"), // lazy view, no copy
      byteStart: offsets[head], byteEnd: offsets[j],
      offsetSec: times[head],        // add to every Deepgram timestamp
      contentStartSec: times[i],     // where non-overlapping audio begins
      endSec: times[j],
    });
    i = j;
  }
  // Fold a tail chunk that is mostly overlap back into its predecessor.
  if (chunks.length > 1) {
    const tail = chunks[chunks.length - 1];
    if (tail.endSec - tail.contentStartSec < Math.max(30, overlapSeconds * 2)) {
      chunks.pop();
      const prev = chunks[chunks.length - 1];
      prev.byteEnd = tail.byteEnd;
      prev.endSec = tail.endSec;
      prev.blob = file.slice(prev.byteStart, prev.byteEnd, "audio/mpeg");
    }
  }
  return { chunks, totalDuration: times[last] };
}

// ── Deepgram (chunked) ──
// Deepgram returns 504 for any pre-recorded request that takes over 10 minutes to
// process. One 3-hour upload blows straight through that, and the connection dies
// mid-body — which surfaces as "Failed to fetch" on response.json(), not as an
// HTTP error. Keeping every request to ~10 minutes of audio avoids the wall entirely.
const DG_URL = "https://api.deepgram.com/v1/listen?model=nova-3&language=multi"
  + "&smart_format=true&diarize=true&paragraphs=true&mip_opt_out=true";

async function postDeepgramChunk(chunk, apiKey, { timeoutMs = 240000, retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetchOr("Deepgram", DG_URL, {
        method: "POST",
        headers: { Authorization: "Token " + apiKey, "Content-Type": "audio/mpeg" },
        body: chunk.blob,
        signal: ac.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          throw new Error(`transient ${res.status}`);
        }
        throw Object.assign(
          new Error(`Deepgram API error (${res.status}): ${body.slice(0, 300)}`),
          { fatal: true }
        );
      }
      // Body read stays inside the try: a dropped connection lands here.
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (err.fatal || attempt === retries) break;
      await new Promise((r) => setTimeout(r, Math.min(30000, 1500 * 2 ** attempt)));
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastErr?.fatal) throw lastErr;
  throw new Error(`Audio part ${chunk.index + 1} failed after retries: ${lastErr?.message}`);
}

async function transcribeChunked(chunks, apiKey, { concurrency = 3, onProgress } = {}) {
  const out = new Array(chunks.length);
  let next = 0, done = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, chunks.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= chunks.length) return;
        out[i] = { chunk: chunks[i], json: await postDeepgramChunk(chunks[i], apiKey) };
        onProgress?.(++done / chunks.length, done, chunks.length);
      }
    })
  );
  return out;
}

// Re-base timestamps and re-anchor speaker ids. Deepgram diarizes each request
// independently, so "Speaker 0" in one chunk is not the same person as in the next;
// the overlap window is used to stitch identities back together.
const normText = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

function mergeChunkedTranscripts(results, { dedupeMarginSec = 0.4 } = {}) {
  const out = [];
  let nextGlobal = 0;

  for (const { chunk, json } of results) {
    const alt = json?.results?.channels?.[0]?.alternatives?.[0];
    let paras = alt?.paragraphs?.paragraphs || [];
    // Fall back to the flat transcript rather than discarding a good result.
    if (!paras.length && alt?.transcript?.trim()) {
      paras = [{ start: 0, end: chunk.endSec - chunk.offsetSec,
                 sentences: [{ text: alt.transcript.trim() }] }];
    }
    if (!paras.length) continue;

    const off = chunk.offsetSec;
    const seam = chunk.contentStartSec - off;
    const map = new Map();

    if (chunk.index > 0 && seam > 0) {
      for (const p of paras) {
        if (p.start >= seam) break;
        if (p.speaker === undefined || map.has(p.speaker)) continue;
        const mid = off + (p.start + Math.min(p.end, seam)) / 2;
        let prior = null;
        for (let q = out.length - 1; q >= 0; q--) {
          if (out[q].start <= mid && out[q].end >= mid) { prior = out[q]; break; }
          if (out[q].end <= mid && !prior) prior = out[q];
        }
        // Only anchor to a real speaker, and never map two local ids onto the same
        // global one — that would merge two people into a single speaker downstream.
        if (prior && prior.speaker !== undefined && ![...map.values()].includes(prior.speaker)) {
          map.set(p.speaker, prior.speaker);
        }
      }
      // Two-speaker case only: one unmapped local id + one unused global id => same
      // person. With 3+ voices this is a counting coincidence, not evidence — it
      // would happily fuse a brand-new guest onto someone who just went quiet.
      const locals = [...new Set(paras.map((p) => p.speaker).filter((s) => s !== undefined))];
      const unmapped = locals.filter((l) => !map.has(l));
      const used = new Set(map.values());
      const free = [];
      for (let g = 0; g < nextGlobal; g++) if (!used.has(g)) free.push(g);
      // Requires map.size > 0: the gap-fill is only justified once the overlap has
      // actually anchored someone. With no anchor at all it is a pure guess, and it
      // would silently rename a different person into an existing speaker.
      if (map.size > 0 && unmapped.length === 1 && free.length === 1
          && locals.length <= 2 && nextGlobal <= 2) {
        map.set(unmapped[0], free[0]);
      }
    }

    const globalOf = (l) => {
      if (l === undefined) return undefined;
      if (!map.has(l)) map.set(l, nextGlobal++);
      const g = map.get(l);
      if (g >= nextGlobal) nextGlobal = g + 1;
      return g;
    };

    for (const p of paras) {
      let sentences = p.sentences || [];
      let startRel = p.start;

      // The previous chunk already transcribed everything before the seam. Drop only
      // the sentences that fall inside it: a paragraph straddling the seam is the
      // normal case (paragraphs run 15-40s, the seam is 8s), so discarding it whole
      // would lose real speech, and keeping it whole repeats what was already emitted.
      if (chunk.index > 0 && seam > 0 && p.start < seam) {
        sentences = sentences.filter((s) => (s.end ?? p.end) > seam + dedupeMarginSec);
        startRel = Math.max(p.start, seam);
      }

      const text = sentences.map((s) => s.text).join(" ").trim();
      if (!text) { globalOf(p.speaker); continue; }

      const abs = {
        start: startRel + off, end: p.end + off,
        speaker: globalOf(p.speaker), text, chunkIndex: chunk.index,
      };
      const prev = out[out.length - 1];
      // Only treat this as a seam duplicate if it is the same speaker saying the same
      // thing at essentially the same moment — otherwise a genuine "haan" from the
      // other speaker seconds later gets deleted.
      if (prev && prev.chunkIndex !== abs.chunkIndex && prev.speaker === abs.speaker
          && Math.abs(abs.start - prev.start) < 2.5
          && normText(prev.text) === normText(abs.text)) continue;
      out.push(abs);
    }
  }
  return out;
}

// ── Gemini (Interactions API, chunked) ──
// A 3-hour transcript cannot be transliterated in one call: the output is as long as
// the input and would blow the output-token ceiling. Chunking on speaker-turn
// boundaries keeps each request well inside the limit.
const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MAX_CHUNK_CHARS = 8000;

class TruncatedError extends Error {}

function chunkTranscript(text, maxChars = MAX_CHUNK_CHARS) {
  // A single speaker turn can exceed maxChars on its own — the flat-transcript
  // fallback emits a whole part as one line. Splitting only on blank lines would
  // return it unchanged, so the truncation-recovery halving below could never
  // shrink it and would just re-send identical input until it gave up.
  const turns = [];
  for (const turn of text.split(/\n\s*\n/)) {
    if (turn.length <= maxChars) { turns.push(turn); continue; }
    let rest = turn;
    while (rest.length > maxChars) {
      let cut = rest.lastIndexOf(" ", maxChars);
      if (cut < maxChars * 0.5) cut = maxChars; // no space to break on
      turns.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    if (rest) turns.push(rest);
  }

  const chunks = [];
  let buf = "";
  for (const turn of turns) {
    const merged = buf ? buf + "\n\n" + turn : turn;
    if (merged.length > maxChars && buf) { chunks.push(buf); buf = turn; }
    else buf = merged;
  }
  if (buf.trim()) chunks.push(buf);
  return chunks;
}

// steps[] is the source of truth; output_text is an SDK convenience that the raw REST
// body does not always carry. Filtering to model_output also drops thinking steps, so
// the model's reasoning can never leak into the transcript.
function extractInteractionText(it) {
  if (typeof it?.output_text === "string" && it.output_text.trim()) return it.output_text;
  return (Array.isArray(it?.steps) ? it.steps : [])
    .filter((s) => s?.type === "model_output")
    .flatMap((s) => (Array.isArray(s?.content) ? s.content : []))
    .filter((c) => c?.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("");
}

async function callInteractions(chunk, key, systemPrompt, onRetryWait) {
  const body = JSON.stringify({
    model: GEMINI_MODEL,
    input: chunk,
    system_instruction: systemPrompt,
    generation_config: {
      thinking_level: "minimal", // 3.6-flash defaults to "medium"; thinking eats the output budget
      max_output_tokens: 32768,
      seed: 7, // the Interactions API has no temperature
    },
  });

  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 180000);
    try {
      const res = await fetchOr("Gemini", GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
        signal: ac.signal,
      });

      if (res.status === 429 || res.status >= 500) {
        // Honour the server's own RetryInfo — a free-tier quota window is usually
        // far longer than a short exponential backoff would wait out.
        let waitSec = Math.min(15, 2 ** attempt);
        if (res.status === 429) {
          try {
            const errJson = await res.clone().json();
            const retryInfo = errJson?.error?.details?.find((d) =>
              d["@type"]?.includes("RetryInfo")
            );
            if (retryInfo?.retryDelay) {
              waitSec = Math.min(60, Math.ceil(parseFloat(retryInfo.retryDelay.replace("s", ""))) || waitSec);
            }
          } catch { /* keep the backoff default */ }
        }
        throw Object.assign(new Error(`Gemini ${res.status}`), { retryable: true, status: res.status, waitSec });
      }
      if (!res.ok) {
        throw Object.assign(
          new Error(`Gemini API error (${res.status}): ${(await res.text()).slice(0, 300)}`),
          { fatal: true }
        );
      }

      const it = await res.json();
      if (it.status === "incomplete") throw new TruncatedError();
      if (it.status === "failed" || it.status === "cancelled") {
        throw Object.assign(new Error(`Gemini interaction ${it.status}.`), { fatal: true });
      }

      const text = extractInteractionText(it).trim();
      if (!text) {
        throw Object.assign(new Error("Gemini returned no text"), { retryable: true, waitSec: 2 ** attempt });
      }
      return text;
    } catch (err) {
      if (err instanceof TruncatedError || err.fatal) throw err;
      if (attempt === MAX_ATTEMPTS) {
        // Never surface an internal retry marker — say what actually went wrong.
        if (err.status === 429) {
          throw new Error(
            "Gemini rate limit reached and it did not clear after several retries. Please wait a minute and try again."
          );
        }
        if (err.name === "AbortError") throw new Error("Gemini timed out after several attempts.");
        if (err.retryable) {
          throw new Error(
            "Gemini kept returning an empty or unavailable response. Please check your API key and try again."
          );
        }
        throw err;
      }
      const waitSec = err.waitSec ?? Math.min(15, 2 ** attempt);
      onRetryWait?.(waitSec);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
    } finally {
      clearTimeout(timer);
    }
  }
}

// On a truncated response, halve the chunk and retry rather than dead-ending.
async function transliterateChunk(chunk, key, systemPrompt, onRetryWait, depth = 0) {
  try {
    return await callInteractions(chunk, key, systemPrompt, onRetryWait);
  } catch (err) {
    if (!(err instanceof TruncatedError) || depth >= 3) {
      if (err instanceof TruncatedError) {
        throw new Error("Gemini kept truncating this section even after splitting it down.");
      }
      throw err;
    }
    const halves = chunkTranscript(chunk, Math.max(500, Math.floor(chunk.length / 2)));
    const parts = [];
    for (const h of halves) {
      parts.push(await transliterateChunk(h, key, systemPrompt, onRetryWait, depth + 1));
    }
    return parts.join("\n\n");
  }
}

async function transliterateAll(transcript, key, systemPrompt, { onProgress, onRetryWait } = {}) {
  const chunks = chunkTranscript(transcript);
  const out = new Array(chunks.length);
  let next = 0, done = 0, aborted = false;
  // Without this, a failure in one worker leaves the others firing requests against
  // the same key long after the UI has reported failure and re-enabled the button.
  const worker = async () => {
    for (;;) {
      if (aborted) return;
      const i = next++;
      if (i >= chunks.length) return;
      try {
        out[i] = await transliterateChunk(chunks[i], key, systemPrompt, onRetryWait);
      } catch (err) {
        aborted = true;
        throw err;
      }
      onProgress?.(++done, chunks.length);
    }
  };
  const pool = Math.min(3, chunks.length);
  await Promise.all(Array.from({ length: pool }, worker));
  return out.join("\n\n");
}

// ── Main Pipeline ──
processBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  const deepgramKey = localStorage.getItem("deepgramKey");
  const geminiKey = localStorage.getItem("geminiKey");

  if (!deepgramKey || !geminiKey) {
    showError(
      "API keys are missing. Please open Settings and add both your Deepgram and Gemini API keys."
    );
    openModal();
    return;
  }

  resetStatus();
  processBtn.disabled = true;

  try {
    let uploadBody = selectedFile;
    let stepIndex = 0;
    let prepBase = 10; // where "Preparing the audio" has already reached

    const cloudConvertKey = localStorage.getItem("cloudConvertKey");
    if (cloudConvertKey) {
      showStatus("Preparing the audio…", 5, stepIndex);

      const ccPayload = {
        "tasks": {
          "import": { "operation": "import/upload" },
          "compress": {
            "operation": "compress",
            "input": "import",
            "input_format": "mp3",
            "output_format": "mp3",
            "options": {
              "compression_method": "percentage",
              "target_size_percentage": 40
            }
          },
          "export-url": {
            "operation": "export/url",
            "input": ["compress"]
          }
        }
      };

      const jobRes = await fetchOr("CloudConvert", "https://api.cloudconvert.com/v2/jobs", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + cloudConvertKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(ccPayload)
      });

      if (!jobRes.ok) {
        throw new Error(`CloudConvert API error (${jobRes.status}): ${await jobRes.text()}`);
      }
      const jobData = await jobRes.json();
      const importTask = jobData.data.tasks.find(t => t.name === "import");

      showStatus("Preparing the audio…", 10, stepIndex);
      const formData = new FormData();
      for (const [key, value] of Object.entries(importTask.result.form.parameters)) {
        formData.append(key, value);
      }
      formData.append("file", selectedFile);

      const uploadRes = await fetchOr("CloudConvert", importTask.result.form.url, {
        method: "POST",
        body: formData
      });
      if (!uploadRes.ok) throw new Error("CloudConvert upload failed.");

      showStatus("Preparing the audio…", 20, stepIndex);
      const waitRes = await fetchOr("CloudConvert", `https://api.cloudconvert.com/v2/jobs/${jobData.data.id}/wait`, {
        headers: { "Authorization": "Bearer " + cloudConvertKey }
      });
      if (!waitRes.ok) throw new Error("CloudConvert wait failed.");
      const waitData = await waitRes.json();

      if (waitData.data.status === "error") {
        throw new Error("CloudConvert encountered an error during compression.");
      }

      const exportTask = waitData.data.tasks.find(t => t.name === "export-url");
      const fileUrl = exportTask.result.files[0].url;

      showStatus("Preparing the audio…", 30, stepIndex);
      prepBase = 30;
      const fileRes = await fetchOr("CloudConvert", fileUrl);
      if (!fileRes.ok) {
        throw new Error(
          `CloudConvert download failed (${fileRes.status}). The compressed file link may have expired — try again, or remove your CloudConvert key to upload the original audio.`
        );
      }
      uploadBody = await fileRes.blob();
    } else {
      showStatus("Preparing the audio…", 10, stepIndex);
    }

    // Split into frame-aligned parts so no single request can hit Deepgram's
    // 10-minute processing limit.
    const { chunks } = await splitMp3ByFrames(uploadBody, {
      maxBytes: 40 * 1024 * 1024,
      maxSeconds: 600,
      overlapSeconds: 8,
      onProgress: (p) =>
        showStatus(`Preparing the audio… ${Math.round(p * 100)}%`, prepBase + p * 8, stepIndex),
    });

    stepIndex++;

    // ── Step 2: Upload to Deepgram ──
    showStatus(
      chunks.length > 1
        ? `Understanding the conversation… (0/${chunks.length} parts)`
        : "Understanding the conversation…",
      20,
      stepIndex
    );

    const dgResults = await transcribeChunked(chunks, deepgramKey, {
      concurrency: 3,
      onProgress: (frac, done, total) =>
        showStatus(
          total > 1
            ? `Understanding the conversation… (${done}/${total} parts)`
            : "Understanding the conversation…",
          20 + frac * 35,
          stepIndex
        ),
    });

    // ── Step 3: Merge the parts into one transcript ──
    stepIndex++;
    showStatus("Writing the transcript…", 60, stepIndex);

    const merged = mergeChunkedTranscripts(dgResults);

    if (!merged.length) {
      throw new Error(
        "Deepgram returned no speech for this audio. It may be silent, too short, or in an unsupported format."
      );
    }

    const constructedTranscript = merged
      .map((p) => `${formatTime(p.start)} Speaker ${p.speaker ?? "?"}: ${p.text}`)
      .join("\n\n")
      .trim();

    if (!constructedTranscript) {
      throw new Error(
        "Could not construct a transcript from the Deepgram response. The audio may not contain recognisable speech."
      );
    }

    // Show raw Deepgram transcript immediately
    deepgramArea.value = constructedTranscript;
    outputCard.classList.remove("hidden");

    // ── Step 4: Send to Gemini (with retry for 429) ──
    stepIndex++;
    showStatus("Shaping your words into Hinglish…", 75, stepIndex);

    const systemPrompt = `You are a strict Hindi-to-Hinglish transliterator. I am giving you a raw transcript of a podcast in Hindi (Devanagari script) with speaker labels (Speaker 0, Speaker 1, etc.).

Your ONLY job is to convert the Devanagari Hindi text into Roman script (Hinglish) — i.e. write the same Hindi words using English letters, exactly as an Indian would type them casually.

STRICT RULES YOU MUST FOLLOW:
1. DO NOT add any extra words, filler words, or ending particles that are not in the original (e.g. do not add "tha", "hai", "na", "yaar" etc. if they are not in the original).
2. DO NOT remove any words from the original.
3. DO NOT translate Hindi words into English. For example: "दूसरे" must be written as "doosre" NOT "second". "पहला" must be "pehla" NOT "first". "तीसरे" must be "teesre" NOT "third".
4. If the original transcript already has English words mixed in (like "podcast", "super", "train"), keep them as-is in English.
5. Maintain the EXACT timestamp and speaker labels (e.g., "[00:14] Speaker 0:", "[01:05] Speaker 1:", etc.). Do not alter or remove the timestamps.
6. Preserve the original sentence structure and word order exactly.
7. Use natural Hinglish spellings that urban Indians commonly use (e.g. "bahut" for "बहुत", "aapka" for "आपका", "saubhagya" for "सौभाग्य").
8. Keep paragraph breaks between different speaker turns.

This is a TRANSLITERATION task, NOT a translation or paraphrasing task. The output must be a faithful Roman-script mirror of the input.`;

    const hinglishText = (
      await transliterateAll(constructedTranscript, geminiKey, systemPrompt, {
        onProgress: (done, total) =>
          showStatus(
            total > 1
              ? `Shaping your words into Hinglish… (${done}/${total} sections)`
              : "Shaping your words into Hinglish…",
            75 + (done / total) * 20,
            stepIndex
          ),
        onRetryWait: (sec) =>
          showStatus(`Taking a brief pause, retrying in ${sec}s…`, 75, stepIndex),
      })
    ).trim();

    if (!hinglishText) {
      throw new Error(
        "Gemini returned an empty or unexpected response. Please check your API key and try again."
      );
    }

    // ── Step 5: Display Output ──
    stepIndex++;
    showStatus("Adding the final touches…", 95, stepIndex);

    outputArea.value = hinglishText;

    showDone();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err) : String(err));
    showError(errorMsg || "An unknown error occurred.");
    statusSpinner.classList.add("hidden");
    statusError.classList.remove("hidden");
    statusText.textContent = "Process failed";
    console.error("Pipeline error:", err);
  } finally {
    processBtn.disabled = !selectedFile;
  }
});

// ── Keyboard: Escape closes modal ──
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && settingsModal.style.display === "flex")
    closeModal();
});
