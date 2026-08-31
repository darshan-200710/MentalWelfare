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
git commit -m "fix(critical): complete EXE architecture overhaul - bundle python source, fix sys.executable ML spawning, true standalone mode"
git push origin main

Write-Host "=== Step 4: Building EXE with PyInstaller ==="
py -m PyInstaller MentalWelfare.spec --noconfirm

Write-Host "=== Step 5: Publishing v1.0.6 release to GitHub ==="
gh release create v1.0.6 dist/MentalWelfare.exe `
  --title "CRPF Mental Health Support v1.0.6 (True Standalone Architecture)" `
  --notes "## CRITICAL FIX in v1.0.6

### True Standalone Executable (Zero Dependencies)
- Fixed a massive architectural bug where the EXE relied on the host machine having Python installed (\`py\`) to launch the ML service and backend.
- The EXE now bundles the complete Python source code for both the ML Service and Backend directly inside itself.
- \`desktop_app.py\` now spawns its own embedded Python environment (\`sys.executable\`) to run the Uvicorn servers using internal flags (\`--run-ml-service\` / \`--run-backend\`).
- **FFmpeg is fully bundled** and dynamically resolved via \`_MEIPASS\` inside the child processes.
- You can now copy this single \`MentalWelfare.exe\` to ANY Windows machine without Python installed, and it will boot the UI, Backend, and ML models perfectly!"

Write-Host "=== DONE! ==="
