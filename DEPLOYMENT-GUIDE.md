# EIOR Backend Deployment Guide

## 🚀 Quick Deployment Steps

### Option 1: Deploy to Vercel (Recommended)

Your backend is already configured for Vercel deployment. Follow these steps:

#### 1. Install Vercel CLI
```bash
npm install -g vercel
```

#### 2. Login to Vercel
```bash
vercel login
```

#### 3. Deploy from Backend Directory
```bash
cd backend
vercel --prod
```

#### 4. Set Environment Variables in Vercel Dashboard
Go to your Vercel project dashboard and add these environment variables:

**Required Variables:**
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/eior-db
JWT_SECRET=your-super-secret-jwt-key-here
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-service-account-email
FIREBASE_PRIVATE_KEY=your-firebase-private-key
```

**Optional Variables:**
```
API_BASE_URL=https://your-vercel-app.vercel.app
CORS_ORIGINS=https://your-frontend-domain.com,http://localhost:3000
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=eior
```

### Option 2: Deploy to Railway

#### 1. Install Railway CLI
```bash
npm install -g @railway/cli
```

#### 2. Login and Deploy
```bash
cd backend
railway login
railway init
railway up
```

#### 3. Set Environment Variables
```bash
railway variables set MONGODB_URI="mongodb+srv://..."
railway variables set JWT_SECRET="your-secret"
# ... add other variables
```

### Option 3: Deploy to Render

#### 1. Connect GitHub Repository
- Go to [render.com](https://render.com)
- Connect your GitHub repository
- Select the `backend` folder as root

#### 2. Configure Build Settings
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: 20

#### 3. Add Environment Variables
Add all the required environment variables in Render dashboard.

## 🔧 Environment Variables Reference

### Required for Basic Functionality
| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/eior` |
| `JWT_SECRET` | Secret for JWT token signing | `your-super-secret-key-change-in-production` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `eior-platform-12345` |

### Required for Authentication
| Variable | Description | Example |
|----------|-------------|---------|
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | `firebase-adminsdk-xyz@project.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | Firebase private key | `-----BEGIN PRIVATE KEY-----\n...` |

### Optional Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4000` |
| `API_BASE_URL` | Base URL for API | `http://localhost:4000` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |
| `RATE_LIMIT_REQUESTS` | Requests per window | `100` |
| `RATE_LIMIT_WINDOW` | Rate limit window (seconds) | `60` |

### Optional Services
| Variable | Description | Default |
|----------|-------------|---------|
| `UPSTASH_REDIS_REST_URL` | Redis URL for rate limiting | None (uses memory) |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token | None |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | Default Ollama model | `eior` |

## 🧪 Test Your Deployment

### 1. Test Health Endpoint
```bash
curl https://your-deployed-url.vercel.app/api
```

Expected response:
```json
{
  "name": "Free API",
  "version": "1.0",
  "status": "running"
}
```

### 2. Test EIOR OpenAI Endpoints
```bash
curl https://your-deployed-url.vercel.app/eior/v1/models \
  -H "Authorization: Bearer fk_your_api_key"
```

### 3. Run Full Test Suite
```bash
export EIOR_BASE_URL="https://your-deployed-url.vercel.app/eior/v1"
export EIOR_API_KEY="fk_your_api_key"
npm run test:eior-openai
```

## 📋 Post-Deployment Checklist

### ✅ Verify All Endpoints Work
- [ ] Health check: `GET /api`
- [ ] Public API: `GET /api/public/v1/health`
- [ ] OpenAI compatible: `GET /v1/models`
- [ ] EIOR OpenAI: `GET /eior/v1/models`
- [ ] Integration config: `GET /api/integration-config`

### ✅ Test Authentication
- [ ] API key authentication works
- [ ] Rate limiting is enforced
- [ ] JWT authentication for protected routes

### ✅ Test EIOR Integration
- [ ] Chat completions work
- [ ] Image generation works
- [ ] Streaming responses work
- [ ] Error handling works properly

### ✅ Update Documentation
- [ ] Update `EIOR-OPENCLAW-INTEGRATION.md` with your actual domain
- [ ] Share integration guide with users
- [ ] Update any hardcoded localhost URLs

## 🔗 Your Deployed URLs

Once deployed, your EIOR API will be available at:

```
Base URL: https://your-app-name.vercel.app

Endpoints:
├── /api                           # Health check
├── /api/integration-config        # Integration configuration
├── /api/public/v1/*              # Public API endpoints
├── /v1/*                         # OpenAI-compatible (Ollama)
└── /eior/v1/*                    # EIOR OpenAI-compatible
    ├── /eior/v1/models           # List EIOR models
    ├── /eior/v1/chat/completions # Chat with EIOR
    └── /eior/v1/images/generations # Generate images
```

## 🎯 OpenClaw Integration URLs

Share these with OpenClaw users:

**Base URL for OpenClaw:**
```
https://your-app-name.vercel.app/eior/v1
```

**Available Models:**
- `eior-v1` - Standard EIOR model
- `eior-advanced` - Advanced reasoning model
- `eior-image-gen` - Image generation model

**Configuration Example:**
```bash
export EIOR_BASE_URL="https://your-app-name.vercel.app/eior/v1"
export EIOR_API_KEY="fk_user_api_key_here"
```

## 🚨 Troubleshooting

### Common Issues

**1. "Database unavailable" errors**
- Check `MONGODB_URI` is set correctly
- Verify MongoDB cluster allows connections from 0.0.0.0/0
- Test connection string locally first

**2. "Firebase authentication failed"**
- Verify `FIREBASE_PROJECT_ID` is correct
- Check `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` are set
- Ensure private key includes `\n` characters properly

**3. "Rate limit errors"**
- Check `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Verify Redis instance is accessible
- Rate limiting falls back to memory if Redis unavailable

**4. CORS errors**
- Update `CORS_ORIGINS` to include your frontend domain
- Check browser developer tools for specific CORS errors
- Verify Origin header is being sent correctly

### Debug Commands

**Check environment variables:**
```bash
vercel env ls
```

**View deployment logs:**
```bash
vercel logs
```

**Test locally:**
```bash
cd backend
npm run dev
```

## 🎉 Success!

Once deployed successfully:

1. **Update integration guide** with your actual URLs
2. **Test with OpenClaw** using the configuration examples
3. **Share with users** - they can now add EIOR to OpenClaw!
4. **Monitor usage** through your deployment platform's dashboard

Your EIOR platform is now live and ready for OpenClaw integration! 🚀
