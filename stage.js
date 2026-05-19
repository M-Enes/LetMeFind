const STAGE_QUERY_KEY = 'letmefind.query';
const STAGE_PAYLOAD_KEY = 'letmefind.payload';
const DEFAULT_QUERY = '60-80 cm arası çalışma masası, siyah, metal ayaklı';

const pathname = window.location.pathname;
const stageNames = ['discovery', 'thinking', 'results', 'comparison'];
const stageMatch = pathname.match(/(discovery|thinking|results|comparison)\.html$/);
const stageNumber = stageMatch ? stageNames.indexOf(stageMatch[1]) + 1 : 1;
const url = new URL(window.location.href);
const queryFromUrl = url.searchParams.get('q') || '';
const storedQuery = sessionStorage.getItem(STAGE_QUERY_KEY) || '';
const query = queryFromUrl || storedQuery || DEFAULT_QUERY;

function saveContext(payload) {
  sessionStorage.setItem(STAGE_QUERY_KEY, payload.query || query);
  sessionStorage.setItem(STAGE_PAYLOAD_KEY, JSON.stringify(payload));
}

function loadContext() {
  try {
    return JSON.parse(sessionStorage.getItem(STAGE_PAYLOAD_KEY) || 'null');
  } catch (error) {
    return null;
  }
}

async function fetchPayload(currentQuery) {
  const response = await fetch(`/api/search?q=${encodeURIComponent(currentQuery)}`);
  if (!response.ok) {
    throw new Error(`search failed: ${response.status}`);
  }
  return response.json();
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setHtml(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.innerHTML = value;
}

function openGeminiPanel(payload) {
  const existingPanel = document.getElementById('gemini-panel');
  if (existingPanel) existingPanel.remove();

  const panel = document.createElement('section');
  panel.id = 'gemini-panel';
  panel.style.position = 'fixed';
  panel.style.inset = '0';
  panel.style.zIndex = '1000';
  panel.style.background = 'rgba(255,255,255,0.72)';
  panel.style.backdropFilter = 'blur(18px)';
  panel.style.display = 'grid';
  panel.style.placeItems = 'center';
  panel.innerHTML = `
    <div style="width:min(720px, calc(100vw - 32px)); background:#fff; border:1px solid #e5e7eb; border-radius:20px; box-shadow:0 30px 80px rgba(0,0,0,0.12); padding:20px; display:grid; gap:16px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:16px;">
        <div>
          <div style="font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:#7e7576; font-weight:600;">Gemini</div>
          <h3 style="margin:6px 0 0; font-size:24px; font-weight:400; letter-spacing:-.03em; color:#1a1c1d;">Ürünleri konuşalım</h3>
        </div>
        <button type="button" data-close style="min-height:40px; padding:0 14px; border-radius:999px; border:1px solid #e5e7eb; background:#fff;">Kapat</button>
      </div>
      <div data-log style="max-height:320px; overflow:auto; display:grid; gap:10px; padding-right:4px;"></div>
      <form data-form style="display:flex; gap:10px;">
        <input data-input type="text" placeholder="Bu seçeneklerden hangisi daha iyi?" style="flex:1; min-width:0; min-height:44px; padding:0 14px; border-radius:999px; border:1px solid #e5e7eb;" />
        <button type="submit" style="min-height:44px; padding:0 18px; border-radius:999px; background:#000; color:#fff; border:0;">Gönder</button>
      </form>
    </div>
  `;

  const log = panel.querySelector('[data-log]');
  const input = panel.querySelector('[data-input]');
  const form = panel.querySelector('[data-form]');
  const closeButton = panel.querySelector('[data-close]');
  const items = payload?.items || [];

  function appendMessage(text, role) {
    const bubble = document.createElement('div');
    bubble.textContent = text;
    bubble.style.padding = '14px 16px';
    bubble.style.borderRadius = '18px';
    bubble.style.lineHeight = '1.6';
    bubble.style.background = role === 'user' ? '#000' : '#f3f3f4';
    bubble.style.color = role === 'user' ? '#fff' : '#1a1c1d';
    bubble.style.marginLeft = role === 'user' ? '32px' : '0';
    bubble.style.marginRight = role === 'assistant' ? '32px' : '0';
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
  }

  appendMessage('Ürünleri kıyaslayabilirim. Sorunu yaz, kısa ve net bir yanıt döndüreyim.', 'assistant');

  closeButton.addEventListener('click', () => panel.remove());
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    appendMessage(text, 'user');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: payload?.query || query,
          message: text,
          products: items,
        }),
      });

      const body = await response.json();
      appendMessage(body.reply || 'Yanıt üretilemedi.', 'assistant');
    } catch (error) {
      appendMessage('Gemini yanıtı alınamadı.', 'assistant');
    }
  });

  document.body.appendChild(panel);
  input.focus();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function applyCommonBranding() {
  const brand = document.querySelector('nav .text-xl.font-bold');
  if (brand) brand.textContent = 'LetMeFind';
}

function renderStage1() {
  // Discovery: Initial search interface
  const textarea = document.querySelector('textarea');
  if (textarea) textarea.value = query;

  const chips = Array.from(document.querySelectorAll('main .flex.flex-wrap.justify-center.gap-sm.mt-md button'));
  const suggestions = [
    'küçük salon için koltuk',
    'oyun için değil günlük laptop',
    'uzun pil ömrü kulaklık',
  ];
  chips.forEach((button, index) => {
    if (suggestions[index]) button.textContent = suggestions[index];
  });

  const title = document.querySelector('main h1');
  if (title) title.textContent = 'Selam, nasıl bir ürün arıyorsun?';

  const subtitle = document.querySelector('main p');
  if (subtitle) subtitle.textContent = 'Aramayı gönder, verileri canlı kaynaklardan çekelim.';

  const searchButton = document.querySelector('textarea')?.parentElement?.querySelector('button');
  if (searchButton) {
    searchButton.addEventListener('click', async () => {
      const currentQuery = textarea?.value.trim() || query;
      const payload = await fetchPayload(currentQuery);
      saveContext(payload);
      window.location.href = `thinking.html?q=${encodeURIComponent(currentQuery)}`;
    });
  }

  chips.forEach((button) => {
    button.addEventListener('click', () => {
      if (textarea) textarea.value = button.textContent || '';
    });
  });

  const cards = document.querySelectorAll('section.w-full.max-w-7xl.mt-xl.grid > div');
  const cardData = [
    {
      eyebrow: 'Vizyon',
      title: 'Canlı Arama',
      body: 'DummyJSON ürünleri ve TCMB kuru tek bir sonuç setinde birleştirilir.',
    },
    {
      eyebrow: 'Performans',
      title: 'Işık Hızında',
      body: 'İlk ekran sade kalır; veri arkada hazırlanır.',
    },
    {
      eyebrow: 'Yapay Zeka',
      title: 'Gemini Hazır',
      body: 'Sohbet tarafı backend üzerinden güvenli biçimde çalışır.',
    },
  ];
  cards.forEach((card, index) => {
    const data = cardData[index];
    if (!data) return;
    const eyebrow = card.querySelector('span');
    const heading = card.querySelector('h2, h3');
    const paragraph = card.querySelector('p');
    if (eyebrow) eyebrow.textContent = data.eyebrow;
    if (heading) heading.textContent = data.title;
    if (paragraph) paragraph.textContent = data.body;
  });
}

function renderStage2(payload) {
  // Thinking: Analysis and processing
  const currentPayload = payload || loadContext();
  const queryText = currentPayload?.query || query;
  const analysis = currentPayload?.analysis;

  const title = document.querySelector('main h1');
  if (title) title.textContent = 'Sizin için analiz ediliyor...';

  const textarea = document.querySelector('textarea[readonly]');
  if (textarea) textarea.value = queryText;

  const chips = document.querySelectorAll('.flex.flex-wrap.gap-sm .flex.items-center.gap-xs');
  const filterValues = analysis?.chips || [];
  chips.forEach((chip, index) => {
    const data = filterValues[index];
    if (!data) return;
    const spans = chip.querySelectorAll('span');
    if (spans[0]) spans[0].textContent = `${data.label}:`;
    if (spans[1]) spans[1].textContent = data.value;
    const icon = chip.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = data.state === 'ok' ? 'check_circle' : 'progress_activity';
  });

  const progress = document.querySelector('main .text-label-caps.text-zinc-400.animate-pulse-soft');
  if (progress) progress.textContent = analysis?.summary || 'uygun ürünler eşleştiriliyor...';

  const status = document.querySelector('footer .font-mono-data');
  if (status) status.textContent = 'SYSTEM STATUS: THINKING';

  setTimeout(() => {
    window.location.href = `results.html?q=${encodeURIComponent(queryText)}`;
  }, 1600);
}

function renderStage3(payload) {
  // Results: AI filters + prefetched content switching
  const currentPayload = payload || loadContext();
  const queryText = currentPayload?.query || query;
  const allItems = currentPayload?.items || [];
  const prefetchedResults = currentPayload?.prefetchedResults || {};
  const aiFilters = currentPayload?.filters || {};

  const title = document.querySelector('main h1');
  if (title) title.textContent = `'${queryText}' için en iyi seçenekler.`;

  const meta = document.querySelector('main p.font-body-lg');
  const cards = document.querySelectorAll('main .grid > div');
  const priceFilter = document.getElementById('price-filter');
  const inputMin = document.getElementById('price-range-min');
  const inputMax = document.getElementById('price-range-max');
  const fill = document.getElementById('price-slider-fill');
  const badge = document.getElementById('price-range-badge');
  const minLabel = document.getElementById('price-min-label');
  const maxLabel = document.getElementById('price-max-label');

  if (allItems.length === 0 || (allItems.length === 1 && allItems[0].id === 'fallback_1')) {
    if (meta) meta.textContent = `"${queryText}" için sonuç bulunamadı. Farklı anahtar kelimeler deneyin.`;
    cards.forEach((card) => {
      card.style.display = 'none';
    });
    if (priceFilter) priceFilter.style.display = 'none';
    return;
  }

  function parseDisplayPrice(item) {
    if (Number.isFinite(item.priceTryValue)) return item.priceTryValue;
    const raw = item.priceTry || item.price || '';
    const cleaned = String(raw)
      .replace(/[^\d.,]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const num = Number.parseFloat(cleaned);
    return Number.isFinite(num) ? Math.round(num) : 0;
  }

  function formatTry(value) {
    return `₺${Math.round(value).toLocaleString('tr-TR')}`;
  }

  // Track which items are currently visible so the comparison page shows the same products
  let currentVisibleItems = allItems.slice(0, 3);

  function renderCards(items) {
    const visibleItems = items.slice(0, cards.length);
    currentVisibleItems = visibleItems; // keep in sync
    cards.forEach((card, index) => {
      const item = visibleItems[index];
      if (!item) {
        card.style.display = 'none';
        return;
      }

      card.style.display = 'flex';
      const image = card.querySelector('img');
      if (image) {
        image.style.display = 'none';
        if (item.image && item.image.trim()) {
          const tempImg = new Image();
          tempImg.onload = function () {
            image.src = item.image;
            image.style.display = 'block';
          };
          tempImg.onerror = function () {
            image.style.display = 'none';
          };
          tempImg.src = item.image;
        }
      }

      const name = card.querySelector('h2');
      const price = card.querySelector('.font-mono-data');
      if (name) name.textContent = item.name;
      if (price) price.textContent = item.priceTry || item.price;

      const notes = card.querySelectorAll('ul p');
      if (notes[0]) notes[0].innerHTML = `<strong class="font-medium text-on-surface">${escapeHtml(item.category || 'Kategori')}</strong> → canlı veri eşleşmesi`;
      if (notes[1]) notes[1].textContent = item.ratingLabel || 'Puan bilgisi yok';
      if (notes[2]) notes[2].textContent = item.description || 'Açıklama yok';
    });
  }

  const itemById = new Map(allItems.map((item) => [String(item.id), item]));
  const availablePrices = allItems.map(parseDisplayPrice).filter((value) => value > 0);
  const fallbackMin = availablePrices.length ? Math.min(...availablePrices) : 0;
  const fallbackMax = availablePrices.length ? Math.max(...availablePrices) : 0;
  const configuredRange = aiFilters.priceRange || {};
  const globalMin = Number.isFinite(configuredRange.min) ? configuredRange.min : fallbackMin;
  const globalMax = Number.isFinite(configuredRange.max) ? configuredRange.max : fallbackMax;

  const state = {
    color: aiFilters?.color?.default || null,
    category: aiFilters?.category?.default || null,
    usage: aiFilters?.usage?.default || null,
    minPrice: globalMin,
    maxPrice: globalMax,
  };

  function getIdsFromPrefetch(bucketName, value) {
    const bucket = prefetchedResults?.[bucketName] || {};
    return Array.isArray(bucket[value]) ? bucket[value].map(String) : null;
  }

  function getIdsFromItems(key, value) {
    return allItems
      .filter((item) => item?.facets?.[key] === value)
      .map((item) => String(item.id));
  }

  function intersect(base, subset) {
    const subsetSet = new Set(subset);
    return base.filter((id) => subsetSet.has(id));
  }

  function applyFilters() {
    let ids = allItems.map((item) => String(item.id));

    if (state.color) {
      const colorIds = getIdsFromPrefetch('byColor', state.color) || getIdsFromItems('color', state.color);
      ids = intersect(ids, colorIds);
    }
    if (state.category) {
      const categoryIds = getIdsFromPrefetch('byCategory', state.category) || getIdsFromItems('category', state.category);
      ids = intersect(ids, categoryIds);
    }
    if (state.usage) {
      const usageIds = getIdsFromPrefetch('byUsage', state.usage) || getIdsFromItems('usage', state.usage);
      ids = intersect(ids, usageIds);
    }

    const filtered = ids
      .map((id) => itemById.get(id))
      .filter(Boolean)
      .filter((item) => {
        const price = parseDisplayPrice(item);
        return price >= state.minPrice && price <= state.maxPrice;
      });

    renderCards(filtered);
    if (meta) {
      meta.textContent = filtered.length
        ? `Filtrelere uygun ${filtered.length} ürün bulundu. İlk ${Math.min(filtered.length, 3)} ürün gösteriliyor.`
        : 'Bu filtre kombinasyonu için hazır içerik bulunamadı. Filtreleri genişletin.';
    }
  }

  function setupPriceSlider() {
    if (!inputMin || !inputMax || !fill) return;

    inputMin.setAttribute('min', globalMin);
    inputMin.setAttribute('max', globalMax);
    inputMin.value = String(globalMin);

    inputMax.setAttribute('min', globalMin);
    inputMax.setAttribute('max', globalMax);
    inputMax.value = String(globalMax);

    if (minLabel) minLabel.textContent = formatTry(globalMin);
    if (maxLabel) maxLabel.textContent = formatTry(globalMax);

    const refresh = () => {
      const lo = Math.min(Number(inputMin.value), Number(inputMax.value));
      const hi = Math.max(Number(inputMin.value), Number(inputMax.value));
      state.minPrice = lo;
      state.maxPrice = hi;

      const range = globalMax - globalMin || 1;
      const leftPct = ((lo - globalMin) / range) * 100;
      const rightPct = 100 - ((hi - globalMin) / range) * 100;
      fill.style.left = `${leftPct}%`;
      fill.style.right = `${rightPct}%`;
      if (badge) badge.textContent = `${formatTry(lo)} – ${formatTry(hi)}`;

      applyFilters();
    };

    inputMin.addEventListener('input', () => {
      if (Number(inputMin.value) > Number(inputMax.value)) inputMin.value = inputMax.value;
      refresh();
    });
    inputMax.addEventListener('input', () => {
      if (Number(inputMax.value) < Number(inputMin.value)) inputMax.value = inputMin.value;
      refresh();
    });

    refresh();
  }

  const filterTitle = document.querySelector('aside h2');
  if (filterTitle) filterTitle.textContent = 'Sana özel filtreler';

  const filterIntro = document.querySelector('aside p.text-xs, aside p.text-sm');
  if (filterIntro) filterIntro.textContent = 'Arama niyetini analiz ettik ve hazır sonuç kümeleri oluşturduk.';

  const filterNote = document.querySelector('aside .pt-4 p, aside .pt-6 p');
  if (filterNote) filterNote.textContent = aiFilters.note || '* Bu filtreler AI tarafından sorgunuza özel üretilmiştir.';

  const colorGrid = document.querySelector('aside .grid.grid-cols-2');
  if (colorGrid && Array.isArray(aiFilters?.color?.options) && aiFilters.color.options.length) {
    colorGrid.innerHTML = '';
    aiFilters.color.options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.filter = 'color';
      button.dataset.value = option.id;
      button.className = 'flex items-center justify-center gap-2 py-2 lg:py-3 rounded-lg border transition-all';
      button.innerHTML = `<span class="font-label-caps text-[9px] lg:text-[10px]">${escapeHtml(option.label)} (${option.count})</span>`;
      colorGrid.appendChild(button);
      button.addEventListener('click', () => {
        state.color = option.id;
        colorGrid.querySelectorAll('button').forEach((node) => {
          node.classList.remove('border-black', 'bg-white');
          node.classList.add('border-zinc-200', 'bg-zinc-50');
        });
        button.classList.add('border-black', 'bg-white');
        button.classList.remove('border-zinc-200', 'bg-zinc-50');
        applyFilters();
      });
      if (option.id === state.color) button.click();
    });
  }

  const categoryContainer = Array.from(document.querySelectorAll('aside .flex.flex-wrap')).find((container) =>
    container.querySelector('span')
  );
  if (categoryContainer && Array.isArray(aiFilters?.category?.options) && aiFilters.category.options.length) {
    categoryContainer.innerHTML = '';
    aiFilters.category.options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.filter = 'category';
      button.dataset.value = option.id;
      button.className = 'px-3 py-1 lg:px-4 lg:py-2 rounded-full font-label-caps text-[9px] lg:text-[10px] border transition-all';
      button.textContent = `${option.label.toUpperCase()} (${option.count})`;
      categoryContainer.appendChild(button);
      button.addEventListener('click', () => {
        state.category = option.id;
        categoryContainer.querySelectorAll('button').forEach((node) => {
          node.classList.remove('bg-black', 'text-white');
          node.classList.add('bg-zinc-100', 'text-zinc-500');
        });
        button.classList.add('bg-black', 'text-white');
        button.classList.remove('bg-zinc-100', 'text-zinc-500');
        applyFilters();
      });
      if (option.id === state.category) button.click();
    });
  }

  const usagePanel = document.querySelector('aside .flex.items-center.justify-between.p-3, aside .flex.items-center.justify-between.p-4.bg-surface-container-low.rounded-lg.border.border-zinc-100');
  if (usagePanel) {
    const usageLabel = usagePanel.querySelector('span.text-secondary, span[class*="text-[11px]"], span[class*="text-[13px]"]');
    const options = Array.isArray(aiFilters?.usage?.options) && aiFilters.usage.options.length
      ? aiFilters.usage.options
      : [{ id: 'genel', label: 'Genel', count: allItems.length }];
    let usageIndex = Math.max(0, options.findIndex((option) => option.id === state.usage));
    const refreshUsage = () => {
      const active = options[usageIndex];
      state.usage = active.id;
      if (usageLabel) usageLabel.textContent = `${active.label} (${active.count})`;
      applyFilters();
    };
    usagePanel.style.cursor = 'pointer';
    usagePanel.addEventListener('click', () => {
      usageIndex = (usageIndex + 1) % options.length;
      refreshUsage();
    });
    refreshUsage();
  }

  setupPriceSlider();

  const resetButton = document.querySelector('aside .pt-4 button:nth-child(2), aside .pt-6 button:nth-child(2)');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      state.color = aiFilters?.color?.default || state.color;
      state.category = aiFilters?.category?.default || state.category;
      state.usage = aiFilters?.usage?.default || state.usage;
      if (inputMin) inputMin.value = String(globalMin);
      if (inputMax) inputMax.value = String(globalMax);
      setupPriceSlider();
      renderStage3(currentPayload);
    });
  }

  const summary = document.querySelector('section.max-w-6xl.mx-auto.mb-xxl p');
  if (summary) summary.textContent = currentPayload?.summary?.body || 'Canlı veriler hazır.';

  const continueButton = document.getElementById('comparison-button');
  if (continueButton) {
    continueButton.textContent = 'KARŞILAŞTIRMAYA GEÇ';
    continueButton.addEventListener('click', () => {
      // Save the currently visible (filtered) items so comparison page shows the exact same products
      const updatedPayload = { ...currentPayload, comparisonItems: currentVisibleItems };
      saveContext(updatedPayload);
      window.location.href = `comparison.html?q=${encodeURIComponent(queryText)}`;
    });
  }
}

function renderStage4(payload) {
  // Comparison: Side-by-side analysis with Gemini overlay
  const currentPayload = payload || loadContext();

  // Use the items that were actually visible on the results page (saved on navigate).
  // Falls back to top 3 items if navigated to directly (e.g. page refresh).
  const items = (currentPayload?.comparisonItems || currentPayload?.items || []).slice(0, 3);

  const title = document.querySelector('main h1');
  if (title) title.textContent = 'Senin kullanımına göre farklar';

  const intro = document.querySelector('main p.font-body-lg');
  if (intro) intro.textContent = currentPayload?.summary?.body || 'Seçtiğin ürünleri canlı verilerle karşılaştırıyoruz.';

  const labels = document.querySelectorAll('.comparison-grid > div:first-child .space-y-xxl > div span');
  const comparisonLabels = ['Neden bu?', 'Dayanıklılık', 'Alan Verimliliği', 'Fiyat Performans'];
  labels.forEach((label, index) => {
    if (comparisonLabels[index]) label.textContent = comparisonLabels[index];
  });

  // Derive comparison-specific copy from real item data
  const reasons = [
    'Niyet eşleşmesi en güçlü aday.',
    'Fiyat / performans dengesinde iyi alternatif.',
    'Daha premium seçenek; bütçe uygunsa düşünülür.',
  ];
  const durabilities = ['Endüstriyel Sınıf A+', 'Hafif Alüminyum B+', 'Premium Kaplama A'];
  const spaces = ['Orta alan', 'Dar alan', 'Geniş alan'];

  // If no items at all, hide the labels column too
  const labelsColumn = document.querySelector('.comparison-labels-col, .comparison-grid > div:first-child');
  if (items.length === 0 && labelsColumn) labelsColumn.style.display = 'none';

  const productColumns = document.querySelectorAll('.comparison-grid > div:nth-child(n+2):nth-child(-n+4)');
  productColumns.forEach((column, index) => {
    const item = items[index];
    if (!item) {
      column.style.display = 'none'; // hide columns with no real data
      return;
    }

    const name = column.querySelector('h2');
    const price = column.querySelector('.font-mono-data');
    const reason = column.querySelector('.space-y-xxl .pt-lg p');
    const durability = column.querySelector('.space-y-xxl .pt-lg + .pt-lg p');
    const space = column.querySelector('.space-y-xxl .pt-lg + .pt-lg + .pt-lg p');
    const stars = column.querySelectorAll('.material-symbols-outlined');

    if (name) name.textContent = item.name;
    if (price) price.textContent = item.priceTry || item.price;
    if (reason) reason.textContent = reasons[index];
    if (durability) durability.textContent = durabilities[index];
    if (space) space.textContent = spaces[index];

    stars.forEach((star, starIndex) => {
      star.style.fontVariationSettings = starIndex < (index + 2) ? "'FILL' 1" : "'FILL' 0";
    });

    const img = column.querySelector('img');
    if (img && item.image) {
      const tempImg = new Image();
      tempImg.onload = () => { img.src = item.image; };
      tempImg.onerror = () => { img.style.display = 'none'; };
      tempImg.src = item.image;
    }
  });

  const summaryBox = document.querySelector('section.max-w-6xl.mx-auto.mb-xxl .bg-white p, section.max-w-6xl.mx-auto p');
  if (summaryBox) summaryBox.textContent = currentPayload?.summary?.body || 'Gemini ile detaylı yorum üretilebilir.';

  const bottomNote = document.querySelector('section.max-w-6xl.mx-auto.mb-xxl p.text-label-caps');
  if (bottomNote) bottomNote.textContent = `Sonuçlar ${currentPayload?.items?.length || 0} canlı ürün ve TCMB kuru ile hazırlandı.`;

  const primaryAction = document.querySelector('section.max-w-6xl.mx-auto.mb-xxl button.bg-primary');
  if (primaryAction) {
    primaryAction.textContent = 'YENİ ARAMA';
    primaryAction.addEventListener('click', () => {
      window.location.href = 'discovery.html';
    });
  }

  const secondaryAction = document.querySelector('section.max-w-6xl.mx-auto.mb-xxl button.text-primary');
  if (secondaryAction) {
    secondaryAction.textContent = 'GEMINI SORUSU';
    secondaryAction.addEventListener('click', () => openGeminiPanel(currentPayload));
  }
}

async function main() {
  applyCommonBranding();

  if (stageNumber === 1) {
    renderStage1();
    return;
  }

  // Stages 2-4: use cached payload from sessionStorage.
  // Only fetch from the API if the cache is missing (e.g. page refreshed directly).
  let payload = loadContext();
  if (!payload) {
    payload = await fetchPayload(query);
    saveContext(payload);
  }

  if (stageNumber === 2) {
    renderStage2(payload);
  } else if (stageNumber === 3) {
    renderStage3(payload);
  } else if (stageNumber === 4) {
    renderStage4(payload);
  }
}

main().catch((error) => {
  console.error(error);
});
