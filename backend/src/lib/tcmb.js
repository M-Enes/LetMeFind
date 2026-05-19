const TCMB_XML_URL = 'https://www.tcmb.gov.tr/kurlar/today.xml';
const EXCHANGERATE_HOST_API = 'https://api.exchangerate.host/latest?base=USD&symbols=TRY,EUR';

async function fetchExchangeRates() {
  try {
    // Try Exchangerate.host first (no auth required, real-time data)
    const response = await fetch(EXCHANGERATE_HOST_API, {
      headers: {
        'User-Agent': 'LetMeFind/1.0',
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.rates && data.rates.TRY) {
        return {
          usdTry: Number(data.rates.TRY) || 1,
          eurTry: Number(data.rates.EUR) || 1,
          source: 'exchangerate.host',
        };
      }
    }

    // Fallback to TCMB if exchangerate.host fails
    return await fetchTCMBRates();
  } catch (error) {
    console.warn('Exchange rate fetch failed, using defaults:', error.message);
    return {
      usdTry: 1,
      eurTry: 1,
      source: 'fallback',
    };
  }
}

async function fetchTCMBRates() {
  try {
    const response = await fetch(TCMB_XML_URL, {
      headers: {
        'User-Agent': 'LetMeFind/1.0',
        Accept: 'application/xml,text/xml,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`TCMB request failed: ${response.status}`);
    }

    const xml = await response.text();
    const usdTry = extractRate(xml, 'USD');
    const eurTry = extractRate(xml, 'EUR');

    return {
      usdTry: usdTry || 1,
      eurTry: eurTry || 1,
      source: 'tcmb',
    };
  } catch (error) {
    console.warn('TCMB fetch failed:', error.message);
    return {
      usdTry: 1,
      eurTry: 1,
      source: 'fallback',
    };
  }
}

function extractRate(xml, code) {
  const currencyBlock = xml.match(new RegExp(`<Currency[^>]*CurrencyCode="${code}"[\\s\\S]*?<\\/Currency>`, 'i'));
  if (!currencyBlock) return null;

  const block = currencyBlock[0];
  const forexBuying = block.match(/<ForexBuying>([^<]+)<\/ForexBuying>/i)?.[1];
  const banknoteSelling = block.match(/<BanknoteSelling>([^<]+)<\/BanknoteSelling>/i)?.[1];
  const chosen = forexBuying || banknoteSelling;
  const rate = Number(String(chosen || '').replace(',', '.'));
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

module.exports = {
  fetchExchangeRates,
};
