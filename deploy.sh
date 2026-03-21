#!/bin/bash

# EIOR Backend Deployment Script
# This script helps deploy your EIOR backend with OpenAI compatibility

set -e

echo "🚀 EIOR Backend Deployment Script"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "backend/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   Expected structure: ./backend/package.json"
    exit 1
fi

# Check if required tools are installed
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting." >&2; exit 1; }

echo "✅ Node.js and npm are installed"

# Navigate to backend directory
cd backend

echo "📦 Installing dependencies..."
npm install

echo "🧪 Running tests..."
npm test

echo "🔍 Testing EIOR OpenAI endpoints..."
if [ -n "$EIOR_API_KEY" ]; then
    npm run test:eior-openai
else
    echo "⚠️  EIOR_API_KEY not set, skipping endpoint tests"
    echo "   Set EIOR_API_KEY environment variable to test endpoints"
fi

echo ""
echo "🎯 Choose deployment platform:"
echo "1) Vercel (Recommended)"
echo "2) Railway"
echo "3) Render"
echo "4) Manual setup only"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "🔧 Setting up Vercel deployment..."
        
        # Check if Vercel CLI is installed
        if ! command -v vercel &> /dev/null; then
            echo "📥 Installing Vercel CLI..."
            npm install -g vercel
        fi
        
        echo "🚀 Deploying to Vercel..."
        echo "   Note: You'll need to set environment variables in Vercel dashboard"
        echo "   Required: MONGODB_URI, JWT_SECRET, FIREBASE_PROJECT_ID, etc."
        
        vercel --prod
        
        echo ""
        echo "✅ Deployment initiated!"
        echo "🔗 Don't forget to:"
        echo "   1. Set environment variables in Vercel dashboard"
        echo "   2. Update EIOR-OPENCLAW-INTEGRATION.md with your domain"
        echo "   3. Test the deployed endpoints"
        ;;
        
    2)
        echo "🔧 Setting up Railway deployment..."
        
        # Check if Railway CLI is installed
        if ! command -v railway &> /dev/null; then
            echo "📥 Installing Railway CLI..."
            npm install -g @railway/cli
        fi
        
        echo "🚀 Deploying to Railway..."
        railway login
        railway init
        railway up
        
        echo ""
        echo "✅ Deployment initiated!"
        echo "🔗 Set environment variables with:"
        echo "   railway variables set MONGODB_URI=\"your-mongodb-uri\""
        echo "   railway variables set JWT_SECRET=\"your-jwt-secret\""
        ;;
        
    3)
        echo "🔧 Render deployment setup..."
        echo ""
        echo "📋 Manual steps for Render:"
        echo "1. Go to https://render.com"
        echo "2. Connect your GitHub repository"
        echo "3. Select 'backend' folder as root directory"
        echo "4. Set build command: npm install"
        echo "5. Set start command: npm start"
        echo "6. Add environment variables in Render dashboard"
        echo ""
        echo "📄 See DEPLOYMENT-GUIDE.md for detailed instructions"
        ;;
        
    4)
        echo "📋 Manual setup completed!"
        echo ""
        echo "🔗 Next steps:"
        echo "1. Choose your deployment platform"
        echo "2. Follow DEPLOYMENT-GUIDE.md for detailed instructions"
        echo "3. Set required environment variables"
        echo "4. Deploy your application"
        ;;
        
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "📚 Documentation created:"
echo "   - DEPLOYMENT-GUIDE.md (detailed deployment instructions)"
echo "   - EIOR-OPENCLAW-INTEGRATION.md (user integration guide)"
echo "   - EIOR-INTEGRATION-SUMMARY.md (implementation overview)"
echo ""
echo "🧪 Test your deployment:"
echo "   npm run test:eior-openai"
echo ""
echo "🎉 Your EIOR backend is ready for OpenClaw integration!"

cd ..