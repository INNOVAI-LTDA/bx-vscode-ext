# BX Conversation Trace - development setup script
# Run from the root folder of this extension project.

Write-Host "Checking Node.js..."
node -v

Write-Host "Checking npm..."
npm -v

Write-Host "Installing dependencies..."
npm install

Write-Host "Compiling TypeScript..."
npm run compile

Write-Host "Done. Open this folder in VS Code and press F5 to run the extension."
