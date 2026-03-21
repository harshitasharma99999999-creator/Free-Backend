# EIOR Backend Deployment Script (PowerShell)
# This script helps deploy your EIOR backend with OpenAI compatibility

Write-Host "🚀 EIOR Backend Deployment Script" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "backend/package.json")) {
    Write-Host "❌ Error: Please run this script from the project root directory" -ForegroundColor Red
    Write-Host "   Expected structure: ./backend/package.json" -ForegroundColor Red
    exit 1
}

# Check if required tools are installed
try {
    node --version | Out-Null
    npm --version | Out-Null
    Write-Host "✅ Node.js and npm are installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js and npm are required but not installed. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Navigate to backend directory
Set-Location backend

Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "🧪 Running tests..." -ForegroundColor Yellow
npm test

Write-Host "🔍 Testing EIOR OpenAI endpoints..." -ForegroundColor Yellow
if ($env:EIOR_API_KEY) {
    npm run test:eior-openai
} else {
    Write-Host "⚠️  EIOR_API_KEY not set, skipping endpoint tests" -ForegroundColor Yellow
    Write-Host "   Set EIOR_API_KEY environment variable to test endpoints" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 Choose deployment platform:" -ForegroundColor Cyan
Write-Host "1) Vercel (Recommended)" -ForegroundColor White
Write-Host "2) Railway" -ForegroundColor White
Write-Host "3) Render" -ForegroundColor White
Write-Host "4) Manual setup only" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter your choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host "🔧 Setting up Vercel deployment..." -ForegroundColor Yellow
        
        # Check if Vercel CLI is installed
        try {
            vercel --version | Out-Null
        } catch {
            Write-Host "📥 Installing Vercel CLI..." -ForegroundColor Yellow
            npm install -g vercel
        }
        
        Write-Host "🚀 Deploying to Vercel..." -ForegroundColor Green
        Write-Host "   Note: You'll need to set environment variables in Vercel dashboard" -ForegroundColor Yellow
        Write-Host "   Required: MONGODB_URI, JWT_SECRET, FIREBASE_PROJECT_ID, etc." -ForegroundColor Yellow
        
        vercel --prod
        
        Write-Host ""
        Write-Host "✅ Deployment initiated!" -ForegroundColor Green
        Write-Host "🔗 Don't forget to:" -ForegroundColor Cyan
        Write-Host "   1. Set environment variables in Vercel dashboard" -ForegroundColor White
        Write-Host "   2. Update EIOR-OPENCLAW-INTEGRATION.md with your domain" -ForegroundColor White
        Write-Host "   3. Test the deployed endpoints" -ForegroundColor White
    }
    
    "2" {
        Write-Host "🔧 Setting up Railway deployment..." -ForegroundColor Yellow
        
        # Check if Railway CLI is installed
        try {
            railway --version | Out-Null
        } catch {
            Write-Host "📥 Installing Railway CLI..." -ForegroundColor Yellow
            npm install -g @railway/cli
        }
        
        Write-Host "🚀 Deploying to Railway..." -ForegroundColor Green
        railway login
        railway init
        railway up
        
        Write-Host ""
        Write-Host "✅ Deployment initiated!" -ForegroundColor Green
        Write-Host "🔗 Set environment variables with:" -ForegroundColor Cyan
        Write-Host "   railway variables set MONGODB_URI=`"your-mongodb-uri`"" -ForegroundColor White
        Write-Host "   railway variables set JWT_SECRET=`"your-jwt-secret`"" -ForegroundColor White
    }
    
    "3" {
        Write-Host "🔧 Render deployment setup..." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "📋 Manual steps for Render:" -ForegroundColor Cyan
        Write-Host "1. Go to https://render.com" -ForegroundColor White
        Write-Host "2. Connect your GitHub repository" -ForegroundColor White
        Write-Host "3. Select 'backend' folder as root directory" -ForegroundColor White
        Write-Host "4. Set build command: npm install" -ForegroundColor White
        Write-Host "5. Set start command: npm start" -ForegroundColor White
        Write-Host "6. Add environment variables in Render dashboard" -ForegroundColor White
        Write-Host ""
        Write-Host "📄 See DEPLOYMENT-GUIDE.md for detailed instructions" -ForegroundColor Yellow
    }
    
    "4" {
        Write-Host "📋 Manual setup completed!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🔗 Next steps:" -ForegroundColor Cyan
        Write-Host "1. Choose your deployment platform" -ForegroundColor White
        Write-Host "2. Follow DEPLOYMENT-GUIDE.md for detailed instructions" -ForegroundColor White
        Write-Host "3. Set required environment variables" -ForegroundColor White
        Write-Host "4. Deploy your application" -ForegroundColor White
    }
    
    default {
        Write-Host "❌ Invalid choice. Please run the script again." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "📚 Documentation created:" -ForegroundColor Cyan
Write-Host "   - DEPLOYMENT-GUIDE.md (detailed deployment instructions)" -ForegroundColor White
Write-Host "   - EIOR-OPENCLAW-INTEGRATION.md (user integration guide)" -ForegroundColor White
Write-Host "   - EIOR-INTEGRATION-SUMMARY.md (implementation overview)" -ForegroundColor White
Write-Host ""
Write-Host "🧪 Test your deployment:" -ForegroundColor Cyan
Write-Host "   npm run test:eior-openai" -ForegroundColor White
Write-Host ""
Write-Host "🎉 Your EIOR backend is ready for OpenClaw integration!" -ForegroundColor Green

Set-Location ..