# BX Conversation Trace - package VSIX script
# Run after npm install.

Write-Host "Compiling extension..."
npm run compile

Write-Host "Packaging VSIX..."
npm run package

Write-Host "Done. A .vsix file should exist in the project root."
