# RAG System Setup Guide

## ✅ Current Status
- Vector store: **Initialized**
- Transaction indexing: **Working**
- Gemini API: **Needs configuration**

## 🔧 How to Setup RAG Features

### Step 1: Add RAG-Specific Gemini API Key
Add to your `.env.local` file:
```
GEMINI_API_KEY_RAG=AIzaSyAPPGAcIOCkgRny9NX_U4Tf4HohNl9RjQs
```

**Note:** This key is used ONLY for RAG features:
- Transaction search & indexing
- RAG chat interface
- Financial insights generation

Your main `GEMINI_API_KEY` remains separate and unchanged.

### Step 2: Restart Development Server
```bash
npm run dev
```

### Step 3: Test RAG
1. Go to Advisor page → Smart Transaction Analysis
2. Ask a question like "Show my spending"
3. Check browser console for logs

## 📊 API Key Usage

| Feature | API Key Used | Status |
|---------|-------------|--------|
| **RAG Features** | `GEMINI_API_KEY_RAG` | ✅ Configured |
| **Other AI Features** | `GEMINI_API_KEY` | ✅ Preserved |

The system will automatically use `GEMINI_API_KEY_RAG` for all RAG operations, keeping your original key separate.

## 🐛 Debugging

### Check if RAG is working:
```bash
GET /api/RythmIQ-ai/index
```

Response should show:
```json
{
  "success": true,
  "status": "ready",
  "transactionCount": 10,
  "message": "10 transactions available for RAG"
}
```

### Check server logs:
Look for:
- ✅ "Vector store initialized (using GEMINI_API_KEY_RAG)" - RAG key working
- ✅ "Indexed X transactions" - Transactions indexed
- ✅ "Using Gemini API for RAG" - API operational

## 💡 RAG Features

- 🔍 **Smart Search** - Natural language transaction search
- 💬 **RAG Chat** - Ask questions about your finances
- 📈 **Insights** - AI-generated spending insights
- 🎯 **Context-aware** - Uses your actual transaction history

## ⚡ Free API Limits (Gemini)
- 15 requests per minute (free tier)
- 1,500 requests per day
- Perfect for personal finance management

**Note:** Rate limiting is enforced on the backend to prevent exceeding quotas.

