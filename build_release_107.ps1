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
git commit -m "fix(ai): resolve looping fallback response, fix uvicorn PyInstaller crash, add multi-turn history memory"
git push origin main

Write-Host "=== Step 4: Building EXE with PyInstaller ==="
py -m PyInstaller MentalWelfare.spec --noconfirm

Write-Host "=== Step 5: Publishing v1.0.7 release to GitHub ==="
gh release create v1.0.7 dist/MentalWelfare.exe `
  --title "CRPF Mental Health Support v1.0.7 (AI Memory & Uvicorn Fix)" `
  --notes "## What's Fixed in v1.0.7

### AI Response Looping Fixed
- Fixed an issue where the ML service lacked conversation history and the frontend failed to send it. The AI now receives the **full conversation history** transcript, giving it actual multi-turn memory instead of statelessly responding to only the last message.
- Fixed a PyInstaller crash (\`ModuleNotFoundError: No module named 'fastapi.middleware'\`) that was causing the ML service to silently abort on startup.
- The ML Service failure was forcing the UI to fall back to a hardcoded \"mock\" responder, which would run out of pre-written replies and endlessly loop the phrase *'It sounds like you've been carrying a lot...'*. This is now fully resolved.

### Uvicorn Standalone Fixes
- Hardened the embedded Uvicorn server startup to bypass dynamic string-imports which are incompatible with PyInstaller.
- Added \`ml_crash.log\` and \`backend_crash.log\` output in the same directory as the EXE in case of future silent startup failures."

Write-Host "=== DONE! ==="
