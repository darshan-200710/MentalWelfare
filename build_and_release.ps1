Write-Host "Building Next.js frontend..."
cd d:\SIH\MentalWelfare\frontend
npx next build

Write-Host "Preparing standalone folder..."
cd d:\SIH\MentalWelfare
Copy-Item -Path "d:\SIH\MentalWelfare\frontend\.next\static" -Destination "d:\SIH\MentalWelfare\frontend\.next\standalone\.next\static" -Recurse -Force
Copy-Item -Path "d:\SIH\MentalWelfare\frontend\public" -Destination "d:\SIH\MentalWelfare\frontend\.next\standalone\public" -Recurse -Force
Remove-Item -Path "d:\SIH\MentalWelfare\standalone" -Recurse -Force -ErrorAction SilentlyContinue
Move-Item -Path "d:\SIH\MentalWelfare\frontend\.next\standalone" -Destination "d:\SIH\MentalWelfare\standalone" -Force

Write-Host "Running PyInstaller..."
py -m PyInstaller MentalWelfare.spec --noconfirm

Write-Host "Uploading Release to GitHub..."
gh release create v1.0.3 dist/MentalWelfare.exe --title "CRPF Mental Health Support v1.0.3 (OAuth Hotfix + Uncompressed + LFS Models)" --notes "Final Release! Includes the Google OAuth `0.0.0.0` redirect hotfix, the fully uncompressed binary, and the complete 135M parameter LLM and Semantic Router models."
Write-Host "Finished entirely!"
