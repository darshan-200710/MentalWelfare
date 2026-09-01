Write-Host "=== Step 1: Committing source changes to GitHub ==="
git add .
git commit -m "feat(ai): optimize LLM system prompt to consolidate thoughts and ask fewer questions"
git push origin main

Write-Host "=== Step 2: Building EXE with PyInstaller ==="
py -m PyInstaller MentalWelfare.spec --noconfirm

Write-Host "=== Step 3: Publishing v1.1.1 release to GitHub ==="
gh release create v1.1.1 dist/MentalWelfare_v1.1.0.exe `
  --title "CRPF Mental Health Support v1.1.1" `
  --notes "## What's New in v1.1.1
- **AI Behavior Update**: Overhauled the LLM's core system prompt. The AI will now consolidate its thoughts, act as a supportive listener, and ask significantly fewer probing questions."
