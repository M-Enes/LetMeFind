async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 10000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LetMeFind/1.0',
        Accept: 'application/json,text/plain,*/*',
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

async function fetchDummyJsonProducts(query) {
  // Try furniture category first for home goods queries
  const isFurnitureQuery = /sofa|table|chair|desk|cabinet|shelf|bed|wardrobe|furniture|mobilya|masa|koltuk|karyola/i.test(query);
  let endpoint;
  
  if (isFurnitureQuery) {
    // Get furniture category with search
    const categoryPayload = await fetchJson('https://dummyjson.com/products/category/furniture?limit=10');
    const categoryProducts = (categoryPayload.products || []).map(normalizeDummyProduct);
    
    // If query is more specific, prioritize matching items
    const queryLower = query.toLowerCase();
    const matched = categoryProducts.filter(p => 
      p.name.toLowerCase().includes(queryLower) || 
      p.description.toLowerCase().includes(queryLower)
    );
    
    return matched.length > 0 ? matched : categoryProducts;
  } else {
    // Default search for other categories
    endpoint = `https://dummyjson.com/products/search?q=${encodeURIComponent(query || 'product')}`;
    const payload = await fetchJson(endpoint);
    return (payload.products || []).map(normalizeDummyProduct);
  }
}

async function fetchFeaturedProducts(query) {
  // Return featured products based on query category
  const isFurnitureQuery = /sofa|table|chair|desk|cabinet|shelf|bed|wardrobe|furniture|mobilya|masa|koltuk|karyola/i.test(query);
  const categoryMap = {
    furniture: 'furniture',
    laptops: 'laptops',
    phones: 'smartphones',
    beauty: 'beauty',
    fragrances: 'fragrances',
    groceries: 'groceries',
    skin_care: 'skin-care',
  };

  // Try to detect category from query
  let category = 'smartphones'; // Default fallback category
  if (isFurnitureQuery) {
    category = 'furniture';
  } else if (/laptop|computer|notebook/i.test(query)) {
    category = 'laptops';
  } else if (/phone|mobile|iphone|samsung/i.test(query)) {
    category = 'smartphones';
  } else if (/deodorant|perfume|fragrances|cologne|aftershave/i.test(query)) {
    category = 'fragrances';
  } else if (/beauty|makeup|cosmetic|lipstick|mascara/i.test(query)) {
    category = 'beauty';
  }

  try {
    const payload = await fetchJson(`https://dummyjson.com/products/category/${category}?limit=3`);
    return (payload.products || []).map(normalizeDummyProduct);
  } catch {
    // Fallback to search if category fails
    return [];
  }
}

async function fetchProductMatches(query) {
  const searchResults = await fetchDummyJsonProducts(query);
  const featured = searchResults.length >= 3 ? [] : await fetchFeaturedProducts(query);
  const merged = [...searchResults, ...featured].filter((product, index, array) => {
    return array.findIndex((candidate) => candidate.id === product.id) === index;
  });

  const fallback = merged.length
    ? merged
    : [
        {
          id: 0,
          name: 'Demo Product',
          price: '$0',
          usdPrice: 0,
          rating: 0,
          ratingLabel: 'Puan 0.0',
          category: 'Demo',
          description: 'Kaynak boş olduğunda gösterilen örnek ürün.',
          source: 'DummyJSON',
          image: '',
          url: 'https://dummyjson.com',
        },
      ];

  return Object.assign(fallback, { sources: ['DummyJSON', 'TCMB Daily Exchange Rates'] });
}

module.exports = {
  fetchProductMatches,
};
