const { GoogleGenerativeAI } = require('@google/generative-ai');

// Keyword-based fallback when Gemini is not available
const KEYWORD_MAP = [
  { pattern: /masa|desk|çalışma|table/i,        term: 'desk' },
  { pattern: /koltuk|sofa|kanepe|couch/i,       term: 'sofa' },
  { pattern: /sandalye|chair/i,                 term: 'chair' },
  { pattern: /laptop|notebook|bilgisayar/i,     term: 'laptop' },
  { pattern: /telefon|phone|iphone|samsung/i,   term: 'phone' },
  { pattern: /kulaklık|headphone|headset/i,     term: 'headphones' },
  { pattern: /yatak|bed|karyola/i,              term: 'bed' },
  { pattern: /dolap|wardrobe|cabinet/i,         term: 'wardrobe' },
  { pattern: /raf|shelf|shelving/i,             term: 'shelf' },
  { pattern: /saat|watch/i,                     term: 'watch' },
  { pattern: /çanta|bag|backpack/i,             term: 'bag' },
  { pattern: /ayakkabı|shoe|sneaker/i,          term: 'shoes' },
  { pattern: /parfüm|perfume|deodorant/i,       term: 'perfume' },
  { pattern: /kitap|book/i,                     term: 'book' },
  { pattern: /oyun|game|gaming/i,               term: 'gaming' },
  { pattern: /güzellik|makyaj|beauty|cosmetic/i, term: 'beauty' },
];

function simplifyQueryFallback(query) {
  for (const { pattern, term } of KEYWORD_MAP) {
    if (pattern.test(query)) return term;
  }
  // Last resort: take the longest non-stop word (likely the product noun)
  const words = query
    .replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .sort((a, b) => b.length - a.length);
  return words[0] || query.split(/\s+/)[0] || 'product';
}

function buildPrompt({ query, message, products = [] }) {
  const productLines = products.slice(0, 3).map((product) => {
    return `${product.name} | ${product.priceTry || product.price} | ${product.category} | ${product.description}`;
  });

  return `
Sen LetMeFind için Türkçe konuşan bir alışveriş asistanısın.
Kısa, net, yönlendirici ve somut ol.
Kullanıcı sorgusu: ${query || 'belirtilmedi'}
Kullanıcı mesajı: ${message || 'belirtilmedi'}
Ürünler:
${productLines.join('\n') || 'Ürün yok'}

Yanıtında:
- Gereksiz uzun açıklama yapma.
- En fazla 5 madde veya 1 kısa paragraf kullan.
- Varsa ürünlerden birini öner ve nedenini söyle.
- Eğer Gemini anahtarı yoksa kullanıcıya bunu açıkça söyleme; bunun yerine genel, yararlı bir yönlendirme üret.
`.trim();
}

async function generateGeminiReply(body = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const prompt = buildPrompt(body);

  if (!apiKey) {
    return 'Gemini anahtarı tanımlı değil. Şu an ürünleri kıyaslayabilirim, ama gerçek Gemini yanıtı için GEMINI_API_KEY eklenmeli.';
  }

  try {
    console.log('Initializing Gemini API...');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    console.log('Sending request to Gemini...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Gemini response received successfully');
    return text || 'Yanıt üretilemedi.';
  } catch (error) {
    console.error('Gemini API error:', error.message);
    
    // Fallback to REST API if the library fails
    try {
      console.log('Trying Gemini REST API fallback...');
      return await generateGeminiReplyREST(body);
    } catch (restError) {
      console.error('Gemini REST API also failed:', restError.message);
      return 'Gemini yanıtı alınamadı. API anahtarını kontrol edin.';
    }
  }
}

// Fallback REST API implementation
async function generateGeminiReplyREST(body = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const prompt = buildPrompt(body);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 256,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini REST API error response:', errorText);
    throw new Error(`Gemini request failed: ${response.status}`);
  }

  const payload = await response.json();
  return payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('')?.trim() || 'Yanıt üretilemedi.';
}

/**
 * Uses Gemini to extract a clean, short English search keyword from a
 * natural-language query (which may be long and in Turkish).
 * Falls back to keyword matching if Gemini is unavailable or fails.
 *
 * Example: "60-80 cm arası çalışma masası, siyah, metal ayaklı" → "desk"
 */
async function simplifyQueryForSearch(query) {
  if (!query || query.trim().length === 0) return 'product';

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log('[QuerySimplify] No API key — using keyword fallback');
    return simplifyQueryFallback(query);
  }

  const prompt = `You are a product search keyword extractor.
Extract the core product type from the user query below and return ONLY 1-3 Turkish words suitable for a product API search (e.g. "desk", "gaming laptop", "running shoes").
Do NOT return any explanation, punctuation, or extra text — just the search term.

User query: ${query}`;

  try {
    console.log(`[QuerySimplify] Simplifying query: "${query}"`);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(prompt);
    const simplified = result.response.text().trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

    if (!simplified || simplified.length === 0) {
      throw new Error('Empty response from Gemini');
    }

    console.log(`[QuerySimplify] "${query}" → "${simplified}"`);
    return simplified;
  } catch (error) {
    console.warn('[QuerySimplify] Gemini failed, using keyword fallback:', error.message);
    return simplifyQueryFallback(query);
  }
}

module.exports = {
  generateGeminiReply,
  simplifyQueryForSearch,
};
