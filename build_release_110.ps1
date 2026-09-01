Write-Host "=== Step 1: Building EXE with PyInstaller ==="
py -m PyInstaller MentalWelfare.spec --noconfirm --clean

Write-Host "=== Step 2: Publishing v1.1.0 release to GitHub ==="
gh release create v1.1.0 dist/MentalWelfare_v1.1.0.exe `
  --title "CRPF Mental Health Support v1.1.0" `
  --notes "## What's New in v1.1.0
- Renamed executable to MentalWelfare_v1.1.0.exe
- Fixed missing DLL and hidden-import warnings during build (tensorboard, tbb, pycparser)"
