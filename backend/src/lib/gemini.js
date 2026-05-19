const { GoogleGenerativeAI } = require('@google/generative-ai');

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

module.exports = {
  generateGeminiReply,
};
