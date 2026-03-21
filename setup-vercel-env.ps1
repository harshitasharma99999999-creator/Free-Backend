# Vercel Environment Variables Setup Script
Write-Host "🔧 Setting up Vercel Environment Variables" -ForegroundColor Green

# Navigate to backend directory
Set-Location backend

Write-Host "📋 Required Environment Variables:" -ForegroundColor Yellow
Write-Host "1. MONGODB_URI - Your MongoDB connection string"
Write-Host "2. JWT_SECRET - Secret for JWT tokens"  
Write-Host "3. FIREBASE_PROJECT_ID - Your Firebase project ID"
Write-Host "4. FIREBASE_CLIENT_EMAIL - Firebase service account email"
Write-Host "5. FIREBASE_PRIVATE_KEY - Firebase private key"
Write-Host ""

# Set environment variables using Vercel CLI
Write-Host "Setting environment variables..." -ForegroundColor Yellow

# You'll need to replace these with your actual values
$mongoUri = Read-Host "Enter your MONGODB_URI"
$jwtSecret = Read-Host "Enter your JWT_SECRET (or press Enter for auto-generated)"
$firebaseProjectId = Read-Host "Enter your FIREBASE_PROJECT_ID"
$firebaseClientEmail = Read-Host "Enter your FIREBASE_CLIENT_EMAIL"

if ([string]::IsNullOrEmpty($jwtSecret)) {
    $jwtSecret = [System.Web.Security.Membership]::GeneratePassword(32, 0)
    Write-Host "Generated JWT_SECRET: $jwtSecret" -ForegroundColor Green
}

# Set the variables
vercel env add MONGODB_URI production
vercel env add JWT_SECRET production  
vercel env add FIREBASE_PROJECT_ID production
vercel env add FIREBASE_CLIENT_EMAIL production

Write-Host "✅ Environment variables configured!" -ForegroundColor Green
Write-Host "🔄 Redeploying to apply changes..." -ForegroundColor Yellow

vercel --prod

Set-Location ..