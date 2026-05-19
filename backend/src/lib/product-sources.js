// Real product data sources configuration
const PRODUCT_SOURCES = {
  // RapidAPI Amazon Real-Time Product Search (corrected endpoint)
  amazon: {
    enabled: Boolean(process.env.RAPIDAPI_KEY),
    baseUrl: 'https://real-time-amazon-data.p.rapidapi.com',
    headers: {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com',
      'Content-Type': 'application/json'
    }
  },
  // Free FakeStore API - works without authentication
  fakestore: {
    enabled: true,
    baseUrl: 'https://fakestoreapi.com',
  },
  // Free Platzi API - works without authentication
  platzi: {
    enabled: true,
    baseUrl: 'https://api.escuelajs.co/api/v1',
  },
  // DummyJSON - reliable fallback
  dummy: {
    enabled: true,
    baseUrl: 'https://dummyjson.com/products'
  }
};

console.log('Product Sources Configuration:');
console.log('- Amazon enabled:', PRODUCT_SOURCES.amazon.enabled);
console.log('- FakeStore enabled:', PRODUCT_SOURCES.fakestore.enabled);
console.log('- Platzi enabled:', PRODUCT_SOURCES.platzi.enabled);
console.log('- DummyJSON enabled:', PRODUCT_SOURCES.dummy.enabled);

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 15000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LetMeFind/1.0',
        Accept: 'application/json',
        ...options.headers,
      },
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAmazonProduct(product) {
  return {
    id: product.asin || `amz_${Date.now()}`,
    name: product.product_title || 'Amazon Product',
    price: product.product_price || '$0',
    usdPrice: parseFloat(String(product.product_price || '0').replace(/[^0-9.]/g, '')) || null,
    rating: product.product_star_rating || 0,
    ratingLabel: `Puan ${Number(product.product_star_rating || 0).toFixed(1)}`,
    category: product.product_category || 'General',
    description: product.product_description || 'No description available',
    source: 'Amazon',
    image: product.product_photo || '',
    url: product.product_url || `https://amazon.com/dp/${product.asin}`,
  };
}

function normalizeFakeStoreProduct(product) {
  return {
    id: `fakestore_${product.id}`,
    name: product.title || 'FakeStore Product',
    price: `$${product.price}`,
    usdPrice: Number(product.price) || null,
    rating: product.rating?.rate || 0,
    ratingLabel: `Puan ${Number(product.rating?.rate || 0).toFixed(1)}`,
    category: product.category || 'General',
    description: product.description || 'No description available',
    source: 'FakeStore',
    image: product.image || '',
    url: `https://fakestoreapi.com/products/${product.id}`,
  };
}

function normalizePlatziProduct(product) {
  const rating = Math.random() * 4 + 1; // Random rating between 1-5
  return {
    id: `platzi_${product.id}`,
    name: product.title || 'Platzi Product',
    price: `$${product.price}`,
    usdPrice: Number(product.price) || null,
    rating: rating,
    ratingLabel: `Puan ${rating.toFixed(1)}`,
    category: product.category?.name || 'General',
    description: product.description || 'No description available',
    source: 'Platzi',
    image: product.images?.[0] || '',
    url: `https://api.escuelajs.co/api/v1/products/${product.id}`,
  };
}

function normalizeDummyProduct(product) {
  return {
    id: product.id,
    name: `${product.brand ? `${product.brand} ` : ''}${product.title}`.trim(),
    price: `$${product.price}`,
    usdPrice: Number(product.price) || null,
    rating: product.rating,
    ratingLabel: `Puan ${Number(product.rating || 0).toFixed(1)}`,
    category: product.category,
    description: product.description,
    source: 'DummyJSON',
    image: product.thumbnail,
    url: `https://dummyjson.com/products/${product.id}`,
  };
}

function detectQueryIntent(query) {
  const source = String(query || '').toLowerCase();
  if (/sofa|table|chair|desk|cabinet|shelf|bed|wardrobe|furniture|mobilya|masa|koltuk|karyola/.test(source)) return 'furniture';
  if (/laptop|computer|notebook|bilgisayar/.test(source)) return 'laptops';
  if (/phone|mobile|telefon|iphone|samsung/.test(source)) return 'smartphones';
  if (/deodorant|perfume|fragrance|parfum|koku|cologne|aftershave/.test(source)) return 'fragrances';
  if (/beauty|makeup|cosmetic|guzellik|güzellik|makyaj|lipstick|mascara/.test(source)) return 'beauty';
  if (/book|kitap|novel|roman|edebiyat|safahat/.test(source)) return 'books';
  return null;
}

function splitQueryTokens(query) {
  return String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ\s-]/gi, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function scoreProductMatch(product, queryTokens) {
  const text = `${product.name || ''} ${product.description || ''} ${product.category || ''}`.toLowerCase();
  return queryTokens.reduce((score, token) => (text.includes(token) ? score + 1 : score), 0);
}

function filterByRelevance(products, query) {
  const tokens = splitQueryTokens(query);
  if (!tokens.length) return products;

  const withScores = products
    .map((product) => ({ product, score: scoreProductMatch(product, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return withScores.map((entry) => entry.product);
}

async function fetchDummyJsonByCategory(category) {
  try {
    const payload = await fetchJson(`https://dummyjson.com/products/category/${category}?limit=10`);
    return (payload.products || []).map(normalizeDummyProduct);
  } catch {
    return [];
  }
}

function normalizeOpenLibraryBook(doc, index) {
  const fallbackUsd = 8 + index * 2;
  return {
    id: `book_${doc.key || index}`,
    name: doc.title || 'Book',
    price: `$${fallbackUsd}`,
    usdPrice: fallbackUsd,
    rating: 4.0,
    ratingLabel: 'Puan 4.0',
    category: 'books',
    description: `${(doc.author_name && doc.author_name[0]) || 'Unknown Author'}${doc.first_publish_year ? `, ${doc.first_publish_year}` : ''}`,
    source: 'OpenLibrary',
    image: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '',
    url: doc.key ? `https://openlibrary.org${doc.key}` : 'https://openlibrary.org',
  };
}

async function fetchOpenLibraryBooks(query) {
  try {
    const payload = await fetchJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`);
    const docs = payload.docs || [];
    return docs.slice(0, 10).map(normalizeOpenLibraryBook);
  } catch {
    return [];
  }
}

async function fetchAmazonProducts(query) {
  if (!PRODUCT_SOURCES.amazon.enabled) {
    throw new Error('Amazon API not configured');
  }

  try {
    console.log('Trying Amazon API with correct endpoint...');
    // Use the exact format from RapidAPI example
    const searchUrl = `${PRODUCT_SOURCES.amazon.baseUrl}/search?query=${encodeURIComponent(query)}&page=1&country=TR&sort_by=RELEVANCE&product_condition=ALL&is_prime=false&deals_and_discounts=NONE`;

    const payload = await fetchJson(searchUrl, {
      method: 'GET',
      headers: PRODUCT_SOURCES.amazon.headers,
    });

    console.log('Amazon API response received');
    const products = payload.data?.products || payload.products || [];
    const results = products.slice(0, 10).map(normalizeAmazonProduct);
    console.log(`Amazon returned ${results.length} products`);
    return results;
  } catch (error) {
    console.warn('Amazon API failed:', error.message);
    return [];
  }
}

async function fetchFakeStoreProducts(query) {
  try {
    console.log('Trying FakeStore API...');
    const products = await fetchJson(`${PRODUCT_SOURCES.fakestore.baseUrl}/products`);

    // Filter products based on query
    const queryLower = query.toLowerCase();
    const filtered = products.filter(product =>
      product.title.toLowerCase().includes(queryLower) ||
      product.description.toLowerCase().includes(queryLower) ||
      product.category.toLowerCase().includes(queryLower)
    );

    const results = (filtered.length > 0 ? filtered : products.slice(0, 5))
      .slice(0, 5)
      .map(normalizeFakeStoreProduct);

    console.log(`FakeStore returned ${results.length} products`);
    return results;
  } catch (error) {
    console.warn('FakeStore API failed:', error.message);
    return [];
  }
}

async function fetchPlatziProducts(query) {
  try {
    console.log('Trying Platzi API...');
    const products = await fetchJson(`${PRODUCT_SOURCES.platzi.baseUrl}/products?limit=20`);

    // Filter products based on query
    const queryLower = query.toLowerCase();
    const filtered = products.filter(product =>
      product.title?.toLowerCase().includes(queryLower) ||
      product.description?.toLowerCase().includes(queryLower) ||
      product.category?.name?.toLowerCase().includes(queryLower)
    );

    const results = (filtered.length > 0 ? filtered : products.slice(0, 5))
      .slice(0, 5)
      .map(normalizePlatziProduct);

    console.log(`Platzi returned ${results.length} products`);
    return results;
  } catch (error) {
    console.warn('Platzi API failed:', error.message);
    return [];
  }
}

async function fetchDummyJsonProducts(query) {
  try {
    console.log('Trying DummyJSON...');

    const intent = detectQueryIntent(query);
    const endpoint = intent
      ? `https://dummyjson.com/products/category/${intent}?limit=10`
      : `https://dummyjson.com/products/search?q=${encodeURIComponent(query || 'product')}`;

    const payload = await fetchJson(endpoint);
    const results = (payload.products || []).slice(0, 5).map(normalizeDummyProduct);

    console.log(`DummyJSON returned ${results.length} products`);
    return results;
  } catch (error) {
    console.warn('DummyJSON API failed:', error.message);
    return [];
  }
}

async function fetchProductMatches(query) {
  const results = [];
  const sources = [];

  console.log(`Searching for: "${query}"`);

  // Try Amazon API first if enabled
  if (PRODUCT_SOURCES.amazon.enabled) {
    try {
      const amazonProducts = await fetchAmazonProducts(query);
      results.push(...amazonProducts);
      if (amazonProducts.length > 0) sources.push('Amazon');
    } catch (error) {
      console.warn('Amazon search failed:', error.message);
    }
  } else {
    console.log('Amazon API disabled (no RAPIDAPI_KEY)');
  }

  // Try FakeStore API if we need more results
  if (PRODUCT_SOURCES.fakestore.enabled && results.length < 3) {
    try {
      const fakeStoreProducts = await fetchFakeStoreProducts(query);
      results.push(...fakeStoreProducts);
      if (fakeStoreProducts.length > 0) sources.push('FakeStore');
    } catch (error) {
      console.warn('FakeStore search failed:', error.message);
    }
  }

  // Try Platzi API if we need more results
  if (PRODUCT_SOURCES.platzi.enabled && results.length < 3) {
    try {
      const platziProducts = await fetchPlatziProducts(query);
      results.push(...platziProducts);
      if (platziProducts.length > 0) sources.push('Platzi');
    } catch (error) {
      console.warn('Platzi search failed:', error.message);
    }
  }

  // Fallback to DummyJSON if we still need more results
  if (results.length < 3) {
    try {
      const dummyProducts = await fetchDummyJsonProducts(query);
      results.push(...dummyProducts);
      if (dummyProducts.length > 0) sources.push('DummyJSON');
    } catch (error) {
      console.error('DummyJSON search failed:', error.message);
    }
  }

  console.log(`Total results before deduplication: ${results.length}`);

  // Remove duplicates by ID
  const uniqueResults = results.filter((product, index, array) => {
    return array.findIndex((candidate) => candidate.id === product.id) === index;
  });

  console.log(`Results after deduplication: ${uniqueResults.length}`);

  const relevantResults = filterByRelevance(uniqueResults, query);
  let finalCandidates = relevantResults.length >= 3 ? relevantResults : uniqueResults;

  const intent = detectQueryIntent(query);
  if (intent) {
    const intentMatches = intent === 'books'
      ? await fetchOpenLibraryBooks(query)
      : await fetchDummyJsonByCategory(intent);
    if (intentMatches.length > 0) {
      finalCandidates = [...intentMatches, ...finalCandidates].filter((product, index, array) => {
        return array.findIndex((candidate) => candidate.id === product.id) === index;
      });
      sources.push(intent === 'books' ? 'OpenLibrary' : `DummyJSON(${intent})`);
    }
  }

  // Ensure we have at least some results
  const finalResults = finalCandidates.length > 0 ? finalCandidates : [
    {
      id: 'fallback_1',
      name: 'Hiçbir veri kaynağından sonuç alınamadı',
      price: '$0',
      usdPrice: 0,
      rating: 0,
      ratingLabel: 'Puan 0.0',
      category: 'Error',
      description: 'API anahtarlarını kontrol edin.',
      source: 'Fallback',
      image: '',
      url: '#',
    },
  ];

  console.log(`Final results: ${finalResults.length}, Sources: ${sources.join(', ')}`);

  // Add sources metadata
  return Object.assign(finalResults.slice(0, 10), {
    sources: sources.length > 0 ? sources : ['Fallback']
  });
}

module.exports = {
  fetchProductMatches,
  PRODUCT_SOURCES,
};