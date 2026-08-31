Write-Host "=== Step 1: Building Next.js frontend ==="
cd d:\SIH\MentalWelfare\frontend
npx next build

Write-Host "=== Step 2: Preparing standalone folder ==="
cd d:\SIH\MentalWelfare
Copy-Item -Path "frontend\.next\static" -Destination "frontend\.next\standalone\.next\static" -Recurse -Force
Copy-Item -Path "frontend\public" -Destination "frontend\.next\standalone\public" -Recurse -Force
Remove-Item -Path "standalone" -Recurse -Force -ErrorAction SilentlyContinue
Move-Item -Path "frontend\.next\standalone" -Destination "standalone" -Force

Write-Host "=== Step 3: Committing all source changes to GitHub ==="
git add .
git commit -m "fix: TTS/STT broken (ffmpeg path + MediaRecorder mimeType), AI system prompt enrichment, performance optimizations, dual ffmpeg embed in spec"
git push origin main

Write-Host "=== Step 4: Building EXE with PyInstaller ==="
py -m PyInstaller MentalWelfare.spec --noconfirm

Write-Host "=== Step 5: Publishing v1.0.5 release to GitHub ==="
gh release create v1.0.5 dist/MentalWelfare.exe `
  --title "CRPF Mental Health Support v1.0.5 (Full Fix: TTS/STT + AI Context + Performance)" `
  --notes "## What's Fixed in v1.0.5

### Voice Output (TTS) Fixed
- ffmpeg.exe now bundled in BOTH root and ml-service/ inside the EXE so voice_handler.py always finds it
- Added pyttsx3 offline TTS fallback if edge_tts fails (no internet required)
- Added 10-second timeout on TTS calls to prevent hanging

### Audio Transcription (STT) Fixed
- Fixed critical MediaRecorder bug: browser now records in the correct MIME format that it declares to the server
- ffmpeg pre-converts audio to 16kHz WAV before Whisper for reliable transcription
- Added 30-second timeout on STT calls

### AI Companion Intelligence Enhanced
- User profile (name, rank, unit), latest wellbeing assessment level + domain scores, and last 3 journal moods now injected into every AI system prompt
- Per-user session tracking (no more shared session_id='default')

### Performance
- Removed extra GET request after every chat message (optimistic sidebar update)
- Parallelized DB side-effects (audit logs, risk flags) so they don't block the response
- Pre-imported ZAI SDK at module level (eliminates cold-import latency)"

Write-Host "=== DONE! ==="
