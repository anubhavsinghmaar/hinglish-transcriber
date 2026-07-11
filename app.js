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
    let contentType = "audio/mpeg";
    let stepIndex = 0;

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

      const jobRes = await fetch("https://api.cloudconvert.com/v2/jobs", {
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

      const uploadRes = await fetch(importTask.result.form.url, {
        method: "POST",
        body: formData
      });
      if (!uploadRes.ok) throw new Error("CloudConvert upload failed.");

      showStatus("Preparing the audio…", 20, stepIndex);
      const waitRes = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobData.data.id}/wait`, {
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
      const fileRes = await fetch(fileUrl);
      uploadBody = await fileRes.blob();
    } else {
      showStatus("Preparing the audio…", 10, stepIndex);
    }

    stepIndex++;

    // ── Step 2: Upload to Deepgram ──
    showStatus("Understanding the conversation…", 40, stepIndex);

    const dgResponse = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-3&language=hi&smart_format=true&diarize=true&paragraphs=true&mip_opt_out=true",
      {
        method: "POST",
        headers: {
          Authorization: "Token " + deepgramKey,
          "Content-Type": contentType,
        },
        body: uploadBody,
      }
    );

    if (!dgResponse.ok) {
      const errBody = await dgResponse.text();
      throw new Error(
        `Deepgram API error (${dgResponse.status}): ${errBody}`
      );
    }

    // ── Step 3: Parse Deepgram Response ──
    stepIndex++;
    showStatus("Writing the transcript…", 60, stepIndex);

    const dgData = await dgResponse.json();

    // Construct speaker-labelled transcript
    const paragraphs =
      dgData?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs
        ?.paragraphs;

    if (!paragraphs || paragraphs.length === 0) {
      throw new Error(
        "Deepgram returned no paragraph data. The audio may be too short, silent, or in an unsupported format."
      );
    }

    let constructedTranscript = "";
    for (const para of paragraphs) {
      const speaker = para.speaker !== undefined ? para.speaker : "?";
      const timeStr = formatTime(para.start);
      const sentences = (para.sentences || []).map((s) => s.text).join(" ").trim();
      constructedTranscript += `${timeStr} Speaker ${speaker}: ${sentences}\n\n`;
    }

    constructedTranscript = constructedTranscript.trim();

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

    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              text: systemPrompt + "\n\n" + constructedTranscript,
            },
          ],
        },
      ],
    };

    const GEMINI_MODEL = "gemini-3.5-flash";
    const MAX_RETRIES = 3;
    let gmData = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const gmResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiPayload),
        }
      );

      if (gmResponse.ok) {
        gmData = await gmResponse.json();
        break;
      }

      if (gmResponse.status === 429 && attempt < MAX_RETRIES) {
        // Parse retry delay from response, default to 30s
        let waitSec = 30;
        try {
          const errJson = await gmResponse.json();
          const retryInfo = errJson?.error?.details?.find((d) =>
            d["@type"]?.includes("RetryInfo")
          );
          if (retryInfo?.retryDelay) {
            waitSec = Math.ceil(
              parseFloat(retryInfo.retryDelay.replace("s", ""))
            );
          }
        } catch {
          /* use default */
        }

        // Countdown in the UI
        for (let s = waitSec; s > 0; s--) {
          showStatus(
            `Taking a brief pause, retrying in ${s}s…`,
            75,
            stepIndex
          );
          await new Promise((r) => setTimeout(r, 1000));
        }
        showStatus(
          `Shaping your words into Hinglish…`,
          80,
          stepIndex
        );
        continue;
      }

      // Non-retryable error
      const errBody = await gmResponse.text();
      throw new Error(
        `Gemini API error (${gmResponse.status}): ${errBody}`
      );
    }

    if (!gmData) {
      throw new Error(
        "Gemini API rate limit exceeded after multiple retries. Please wait a minute and try again."
      );
    }

    const candidate = gmData?.candidates?.[0];
    const hinglishText = (candidate?.content?.parts || [])
      .map((p) => p.text)
      .filter(Boolean)
      .join("")
      .trim();

    if (!hinglishText) {
      const finishReason = candidate?.finishReason;
      if (finishReason === "MAX_TOKENS") {
        throw new Error(
          "The transcript was too long for Gemini to process in a single pass. Please try a shorter audio file."
        );
      }
      if (finishReason && finishReason !== "STOP") {
        throw new Error(
          `Gemini stopped without returning any text (reason: ${finishReason}). Please try again.`
        );
      }
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
