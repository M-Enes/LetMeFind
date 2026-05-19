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
  // Results: Show live product results with filters
  const currentPayload = payload || loadContext();
  const queryText = currentPayload?.query || query;
  const items = currentPayload?.items || [];

  const title = document.querySelector('main h1');
  if (title) title.textContent = `'${queryText}' için en iyi seçenekler.`;

  const meta = document.querySelector('main p.font-body-lg');
  if (meta) meta.textContent = `Canlı katalogda bulunan ${items.length} ürün arasından 3 sonuç öne çıkarıldı.`;

  const cards = document.querySelectorAll('main .grid.grid-cols-3.gap-gutter.items-stretch > div');
  cards.forEach((card, index) => {
    const item = items[index];
    if (!item) return;
    const image = card.querySelector('img');
    if (image && item.image) image.src = item.image;
    const name = card.querySelector('h2');
    const price = card.querySelector('.font-mono-data');
    if (name) name.textContent = item.name;
    if (price) price.textContent = item.priceTry || item.price;

    const notes = card.querySelectorAll('ul p');
    if (notes[0]) notes[0].innerHTML = `<strong class="font-medium text-on-surface">${escapeHtml(item.category || 'Kategori')}</strong> → canlı veri eşleşmesi`;
    if (notes[1]) notes[1].textContent = item.ratingLabel || 'Puan bilgisi yok';
    if (notes[2]) notes[2].textContent = item.description || 'Açıklama yok';
  });

  const filters = currentPayload?.analysis?.chips || [];
  const filterTitle = document.querySelector('aside h2');
  if (filterTitle) filterTitle.textContent = 'Sana özel filtreler';
  const filterRows = document.querySelectorAll('aside .space-y-12 > div');
  const width = filters[1]?.value || 'esnek';
  const color = filters[2]?.value || 'nötr';
  const usage = filters[3]?.value || 'genel kullanım';

  if (filterRows[0]) filterRows[0].querySelector('p')?.textContent && (filterRows[0].querySelector('p').textContent = `Arama niyetini çözümledik ve en önemli alanları topladık.`);
  const widthLabel = document.querySelector('aside label');
  if (widthLabel) widthLabel.textContent = '1. GENİŞLİK';
  const widthBadge = document.querySelector('aside .font-mono-data');
  if (widthBadge) widthBadge.textContent = width;
  const colorLabel = document.querySelectorAll('aside label')[1];
  if (colorLabel) colorLabel.textContent = '2. RENK';
  const colorButton = document.querySelector('aside .grid.grid-cols-3.gap-gutter.items-stretch button span:last-child');
  if (colorButton) colorButton.textContent = color;
  const usageText = document.querySelector('aside .flex.items-center.justify-between.p-4.bg-surface-container-low.rounded-lg.border.border-zinc-100 span:last-child');
  if (usageText) usageText.textContent = usage;

  const summary = document.querySelector('section.max-w-6xl.mx-auto.mb-xxl p');
  if (summary) summary.textContent = currentPayload?.summary?.body || 'Canlı veriler hazır.';

  const continueButton = document.querySelector('aside button');
  if (continueButton) {
    continueButton.textContent = 'KARŞILAŞTIRMAYA GEÇ';
    continueButton.addEventListener('click', () => {
      window.location.href = `comparison.html?q=${encodeURIComponent(queryText)}`;
    });
  }
}

function renderStage4(payload) {
  // Comparison: Side-by-side analysis with Gemini overlay
  const currentPayload = payload || loadContext();
  const items = currentPayload?.comparison || [];
  const title = document.querySelector('main h1');
  if (title) title.textContent = 'Senin kullanımına göre farklar';

  const intro = document.querySelector('main p.font-body-lg');
  if (intro) intro.textContent = currentPayload?.summary?.body || 'Seçtiğin ürünleri canlı verilerle karşılaştırıyoruz.';

  const labels = document.querySelectorAll('.comparison-grid > div:first-child .space-y-xxl > div span');
  const comparisonLabels = ['Neden bu?', 'Dayanıklılık', 'Alan Verimliliği', 'Fiyat Performans'];
  labels.forEach((label, index) => {
    if (comparisonLabels[index]) label.textContent = comparisonLabels[index];
  });

  const productColumns = document.querySelectorAll('.comparison-grid > div:nth-child(n+2):nth-child(-n+4)');
  productColumns.forEach((column, index) => {
    const item = items[index];
    if (!item) return;
    const name = column.querySelector('h2');
    const price = column.querySelector('.font-mono-data');
    const reason = column.querySelector('.space-y-xxl .pt-lg p');
    const durability = column.querySelector('.space-y-xxl .pt-lg + .pt-lg p');
    const space = column.querySelector('.space-y-xxl .pt-lg + .pt-lg + .pt-lg p');
    const stars = column.querySelectorAll('.material-symbols-outlined');
    if (name) name.textContent = item.name;
    if (price) price.textContent = item.priceTry || item.price;
    if (reason) reason.textContent = item.reason || 'Canlı veri eşleşmesi';
    if (durability) durability.textContent = item.durability || 'Dayanıklılık bilgisi';
    if (space) space.textContent = item.space || 'Alan bilgisi';
    stars.forEach((star, starIndex) => {
      star.style.fontVariationSettings = starIndex < (item.rank + 1) ? "'FILL' 1" : "'FILL' 0";
    });
    const img = column.querySelector('img');
    if (img && currentPayload.items?.[index]?.image) img.src = currentPayload.items[index].image;
  });

  const summaryBox = document.querySelector('section.max-w-6xl.mx-auto.mb-xxl .bg-white.p-xl.rounded-lg.custom-shadow.border.border-zinc-50 p');
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

  const payload = await fetchPayload(query);
  saveContext(payload);

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
