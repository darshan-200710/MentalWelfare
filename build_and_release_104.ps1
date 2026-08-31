Write-Host "Building Next.js frontend..."
cd d:\SIH\MentalWelfare\frontend
npx next build

Write-Host "Preparing standalone folder..."
cd d:\SIH\MentalWelfare
Copy-Item -Path "d:\SIH\MentalWelfare\frontend\.next\static" -Destination "d:\SIH\MentalWelfare\frontend\.next\standalone\.next\static" -Recurse -Force
Copy-Item -Path "d:\SIH\MentalWelfare\frontend\public" -Destination "d:\SIH\MentalWelfare\frontend\.next\standalone\public" -Recurse -Force
Remove-Item -Path "d:\SIH\MentalWelfare\standalone" -Recurse -Force -ErrorAction SilentlyContinue
Move-Item -Path "d:\SIH\MentalWelfare\frontend\.next\standalone" -Destination "d:\SIH\MentalWelfare\standalone" -Force

Write-Host "Committing changes to github..."
git add .
git commit -m "fix: replace all localhost references with 127.0.0.1 to bypass open network DNS failures"
git push origin main

Write-Host "Running PyInstaller..."
py -m PyInstaller MentalWelfare.spec --noconfirm

Write-Host "Uploading Release to GitHub..."
gh release create v1.0.4 dist/MentalWelfare.exe --title "CRPF Mental Health Support v1.0.4 (127.0.0.1 Network Hotfix)" --notes "This release replaces all `localhost` references with explicit `127.0.0.1` IPs. This prevents 'Site cannot be reached' errors on open networks or restrictive VPNs that fail to resolve the localhost hostname via DNS."
Write-Host "Finished entirely!"
