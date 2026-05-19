# LetMeFind Technical Architecture

## System Overview

LetMeFind is a **4-stage progressive disclosure UI** with a backend API layer for data aggregation and AI chat proxy.

```
┌─────────────────────────────────────────────┐
│         Frontend (Vanilla JS)               │
├────────────────────────────────────────────┤
│  discovery.html  (Stage 1: Search)         │
│  thinking.html   (Stage 2: Analysis)       │
│  results.html    (Stage 3: Products)       │
│  comparison.html (Stage 4: Comparison)     │
└──────────────────┬──────────────────────────┘
                   │ fetch /api/search
                   │ fetch /api/chat
┌──────────────────▼──────────────────────────┐
│     Backend (Node.js Express-like)          │
├────────────────────────────────────────────┤
│ /api/search  → Orchestrate data sources    │
│ /api/chat    → Proxy to Gemini API        │
│ /api/health  → System status              │
└──────────────────┬──────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼────┐  ┌──────▼──────┐  ┌────▼─────┐
│DummyJSON│  │exchangerate │  │  Gemini  │
│Products │  │    .host    │  │   API    │
├─────────┤  │  + TCMB     │  └──────────┘
│Furniture│  │  Exchange   │
│Category │  │    Rates    │
└─────────┘  └─────────────┘
```

## Layers

### 1. Frontend (Browser)

**Files:**
- `index.html` - Root redirect
- `discovery.html` - Stage 1 (Search UI)
- `thinking.html` - Stage 2 (Analysis loading)
- `results.html` - Stage 3 (Product grid)
- `comparison.html` - Stage 4 (Comparison table)
- `stage.js` - Shared controller (~650 lines)

**Key Functions:**
```javascript
renderStage1()              // Search input + suggestion chips
renderStage2(payload)       // Analysis display, auto-advance timer
renderStage3(payload)       // Product grid (3 items), filter panel
renderStage4(payload)       // Comparison table, Gemini overlay button
fetchPayload(query)         // Calls GET /api/search
openGeminiPanel()           // Creates fixed chat overlay
saveContext(data)           // Stores to sessionStorage
loadContext()               // Retrieves from sessionStorage
```

**State Management:**
- Uses `sessionStorage` for cross-page persistence
- Key: `letmefind_context`
- Contains: `{ query, items, exchange, analysis, comparison, summary }`
- Persists between stage navigation
- Clears on page refresh (by design)

**Responsive Breakpoints:**
- 320px: Mobile (1 column)
- 768px: Tablet (2 columns)
- 1024px: Laptop (3 columns)
- 1280px: Desktop (3 columns + sidebar)

### 2. Backend API Layer

**File:** `backend/src/server.js`

**Endpoints:**

#### GET /api/search?q=furniture

Orchestrates data from multiple sources into a single response.

**Implementation:**
```javascript
// 1. Fetch products from DummyJSON
// 2. Fetch exchange rates (exchangerate.host or TCMB fallback)
// 3. Build analysis (tokens, chips, summary)
// 4. Build comparison (side-by-side product data)
// 5. Return combined payload
```

**Response:**
```json
{
  "query": "furniture",
  "items": [
    {
      "id": 1,
      "name": "Furniture Co. Bedside Table African Cherry",
      "price": "$299.99",
      "usdPrice": 299.99,
      "rating": 2.9,
      "category": "furniture",
      "description": "...",
      "image": "...",
      "source": "DummyJSON"
    }
  ],
  "exchange": {
    "usdTry": 45.45,
    "eurTry": 52.88,
    "source": "exchangerate.host"
  },
  "analysis": { "chips": [...], "summary": "..." },
  "comparison": [...],
  "summary": "AI-generated insights"
}
```

#### POST /api/chat

Proxy to Google Gemini API with conversation history support.

**Request:**
```json
{
  "message": "Should I buy this table?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response:**
```json
{
  "response": "Based on your search...",
  "role": "assistant"
}
```

#### GET /api/health

System health check.

**Response:**
```json
{
  "status": "ok",
  "service": "letmefind-backend",
  "geminiEnabled": true,
  "uptime": 1234.56
}
```

### 3. Data Source Layer

#### Product Source: `backend/src/lib/product-sources.js`

**Function:** `fetchProductMatches(query)`

**Logic:**
1. Detect if query is furniture-related (regex: "sofa|table|desk|furniture|...")
2. If furniture → fetch from `https://dummyjson.com/products/category/furniture`
3. Else → search `https://dummyjson.com/products/search?q={query}`
4. Return first 3 items or fallback to featured products
5. Normalize to common format:
   ```javascript
   {
     id, name, price, usdPrice, rating, category,
     description, image, source, url
   }
   ```

**Features:**
- Furniture category prioritization
- Query matching (full text search on name + description)
- Fallback to featured products if < 3 results
- Deduplication by product ID

#### Exchange Rates: `backend/src/lib/tcmb.js`

**Function:** `fetchExchangeRates()`

**Primary Source:** exchangerate.host
```
https://api.exchangerate.host/latest?base=USD&symbols=TRY,EUR
```

**Fallback Source:** TCMB XML
```
https://www.tcmb.gov.tr/kurlar/today.xml
```

**Logic:**
1. Try exchangerate.host first (real-time, no auth)
2. Parse JSON, extract USD/TRY and EUR/TRY rates
3. If fails, fallback to TCMB XML parsing
4. If both fail, return 1.0 (neutral rate)

**Rate Conversion Example:**
```
Product: $299.99
USD/TRY: 45.45
= 299.99 × 45.45 = ₺13,634 TRY
```

#### AI Chat: `backend/src/lib/gemini.js`

**Function:** `callGemini(message, history, apiKey)`

**Implementation:**
- Uses Google Generative AI client library
- Requires `GEMINI_API_KEY` from `.env`
- Sends conversation history for context
- Returns assistant's response

**Fallback:** If no API key, returns generic message:
```
"Gemini integration requires API key configuration."
```

### 4. Data Transformation

**File:** `backend/src/lib/services.js`

**Functions:**

#### buildSearchPayload(query)
Orchestrates all data sources:
```javascript
1. Fetch products via fetchProductMatches()
2. Fetch exchange rates via fetchExchangeRates()
3. Build analysis via buildAnalysis()
4. Build comparison via buildComparison()
5. Generate summary (AI-generated text)
6. Return combined payload
```

#### buildAnalysis(query, items, exchange)
Extracts query insights:
```javascript
{
  chips: [
    "category: ürün",
    "width: esnek",
    "color: nötr"
  ],
  tokens: ["furniture", "table", "modern"],
  summary: "Query indicates product search with size constraints..."
}
```

#### buildComparison(items, exchange)
Prepares side-by-side comparison:
```javascript
[
  {
    name: "Mono-X 70",
    price: "₺12.400,00",
    rating: 5,
    features: ["Durable", "Industrial"],
    deliveryTime: "2-4 Weeks"
  },
  ...
]
```

## Data Flow Diagram

```
User Search Input (discovery.html)
            ↓
    [Send button clicked]
            ↓
    stage.js: fetchPayload()
            ↓
    fetch POST /api/search?q=furniture
            ↓
    backend/src/server.js
            ├─→ product-sources.js: fetchProductMatches()
            │        └─→ DummyJSON API (furniture category)
            │
            ├─→ tcmb.js: fetchExchangeRates()
            │        ├─→ exchangerate.host (primary)
            │        └─→ TCMB XML (fallback)
            │
            ├─→ services.js: buildAnalysis()
            │        └─→ Parse query, extract tokens
            │
            ├─→ services.js: buildComparison()
            │        └─→ Transform items for comparison table
            │
            └─→ Return combined JSON payload
                        ↓
    stage.js: saveContext(payload)
            ↓
    sessionStorage.setItem('letmefind_context', JSON.stringify(payload))
            ↓
    window.location.href = 'thinking.html'
            ↓
    [Stage 2: Shows analysis for 1.6s]
            ↓
    Auto-advance to results.html
            ↓
    [Stage 3: Load context, render product grid]
            ↓
    User clicks "KARŞILAŞTIRMAYA GEÇ"
            ↓
    window.location.href = 'comparison.html'
            ↓
    [Stage 4: Comparison table + Gemini button]
```

## Chat Flow (Optional)

```
User clicks "SEÇİMİ TAMAMLA"
            ↓
    openGeminiPanel()
            ↓
    [Chat overlay appears, input focused]
            ↓
    User types message + sends
            ↓
    fetch POST /api/chat
            ├─ body: { message, history }
            ↓
    backend/src/gemini.js: callGemini()
            ├─→ Google Generative AI client
            ├─→ Send message + conversation history
            └─→ Receive response
                        ↓
    Display assistant message in overlay
            ↓
    [User can continue conversation]
```

## Error Handling

### Frontend (stage.js)
```javascript
try {
  const payload = await fetchPayload(query);
  saveContext(payload);
  window.location.href = 'thinking.html';
} catch (error) {
  console.error('Search failed:', error);
  // Show error toast/modal to user
}
```

### Backend
- HTTP 500 on unexpected errors
- HTTP 400 on invalid parameters
- Graceful fallbacks for external API failures
- Logging to console/stderr

### API Timeouts
- DummyJSON fetch: 10s timeout
- TCMB fetch: 10s timeout
- Gemini fetch: 30s timeout
- Fallback to defaults on timeout

## Performance Considerations

### Frontend Optimization
- Lazy-load product images (Stage 3)
- Debounce filter changes
- Cache sessionStorage context
- Minimize DOM repaints

### Backend Optimization
- Parallel API requests (Promise.all)
- HTTP response caching headers
- Connection pooling for external APIs
- Gzip compression for responses

### Network
- Average response time: 800ms (3 parallel API calls)
- Stage 2 loading time: 1.6s (by design)
- Stage 3 render time: <100ms (local DOM rendering)

## Security

### Frontend
- No sensitive data in JavaScript
- SessionStorage (not localStorage)
- Escape user input in DOM rendering
- No eval() or dynamic script injection

### Backend
- API key in environment variables (not code)
- Rate limiting on `/api/chat` (future)
- Input validation on all endpoints
- CORS headers (configurable)
- HTTPS in production (enforce via reverse proxy)

## Monitoring & Debugging

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Test Search
```bash
curl "http://localhost:3000/api/search?q=furniture" | jq .
```

### Backend Logs
```bash
tail -f /tmp/backend.log
```

### Browser DevTools
- Network tab: API response timing
- Console tab: JavaScript errors
- Application tab: sessionStorage contents
- Performance tab: page load metrics

## Deployment Checklist

- [ ] Replace Tailwind CDN with CLI
- [ ] Add rate limiting middleware
- [ ] Configure CORS for production domain
- [ ] Set GEMINI_API_KEY securely (CI/CD secrets)
- [ ] Enable gzip compression
- [ ] Add error tracking (Sentry, LogRocket)
- [ ] Configure CDN for static assets
- [ ] Set up monitoring (Datadog, New Relic)
- [ ] Test all endpoints with production data
- [ ] Load test at 100 req/s

---

**Architecture Version:** 1.0.0  
**Tech Stack:** Node.js, Vanilla JS, Tailwind CSS, DummyJSON, Gemini API  
**Last Updated:** May 19, 2026

## Neden Bu Yapı

- İlk ekranı ağırlaştırmaz.
- Gerçek API'leri tek view model altında toplar.
- Daha sonra veritabanı, indexleme ve kullanıcı oturumu eklemeye uygundur.
