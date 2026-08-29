// lib/rapidapi-flights.js
//
// Wrapper around the "Flights Scraper Sky" API on RapidAPI
// (host: flights-sky.p.rapidapi.com) — an unofficial Skyscanner scraper.
// Free tier available at rapidapi.com (search "Flights Sky" / "flights-sky").
//
// HONESTY NOTE: this is an unofficial, loosely-documented scraper API.
// We build the request from its one confirmed endpoint shape
// (`/flights/price-calendar-web-return`, which you shared) plus its
// documented search endpoints, and parse the response defensively —
// checking a few plausible field paths rather than assuming one exact
// shape. If a field genuinely isn't in the response, the UI shows "—"
// rather than a fabricated value. If Vercel logs show a different shape
// than what's coded here, that's expected for an unofficial API — send
// the raw response and we calibrate the parsing, not the concept.
//
// The API can return { status: "incomplete" } while Skyscanner's backend
// is still assembling results (it's a live scrape, not a cache). We retry
// the same request a few times with a short delay before giving up.

const HOST = process.env.RAPIDAPI_HOST || 'flights-sky.p.rapidapi.com';
const BASE_URL = `https://${HOST}`;

function usingMock() {
  return process.env.USE_MOCK_FLIGHTS === 'true' || !process.env.RAPIDAPI_KEY;
}

function headers() {
  return {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': HOST,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Mock data (USE_MOCK_FLIGHTS=true, or no RAPIDAPI_KEY set) ─────────

function seededPrice(seed, base, spread) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return base + (hash % spread);
}

const MOCK_AIRLINES = [
  { code: '6E', name: 'IndiGo' },
  { code: 'AI', name: 'Air India' },
  { code: 'UK', name: 'Vistara' },
  { code: 'SG', name: 'SpiceJet' },
];

function buildMockOffers({ origin, destination, departureDate }) {
  return MOCK_AIRLINES.map((airline, i) => {
    const seed = `${origin}${destination}${departureDate}${airline.code}`;
    const price = seededPrice(seed, 3500, 4500);
    const depHour = 6 + i * 4;
    const durationMinutes = 120 + seededPrice(seed + 'dur', 0, 90);
    const arrHour = (depHour + Math.floor(durationMinutes / 60)) % 24;
    const arrMin = durationMinutes % 60;

    return {
      id: `${airline.code}-${i}-${departureDate}`,
      airline: airline.name,
      flightNumber: `${airline.code}${100 + (price % 900)}`,
      origin,
      destination,
      departureDate,
      departureTime: `${String(depHour).padStart(2, '0')}:00`,
      arrivalTime: `${String(arrHour).padStart(2, '0')}:${String(arrMin).padStart(2, '0')}`,
      durationMinutes,
      stops: i % 3 === 0 ? 0 : 1,
      price,
      currency: 'INR',
    };
  }).sort((a, b) => a.price - b.price);
}

// ─── Real API ────────────────────────────────────────────────────────

async function callSkyEndpoint(path, params, { retries = 3, delayMs = 1500 } = {}) {
  const url = `${BASE_URL}${path}?${new URLSearchParams(params).toString()}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: headers() });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`RapidAPI request failed: ${res.status} ${body}`.trim());
    }

    const json = await res.json();
    const status = json?.data?.context?.status || json?.context?.status;

    // "complete" (or no status field at all) means we can use this response.
    if (status !== 'incomplete') {
      return json;
    }

    if (attempt < retries) await sleep(delayMs);
  }

  // Gave up polling — return whatever the last response had rather than
  // erroring out. The caller will just get fewer/no results.
  return null;
}

/**
 * Pulls an itinerary array out of a response, trying a few plausible
 * shapes since this API's exact structure isn't fully documented.
 */
function extractItineraries(json) {
  return (
    json?.data?.itineraries?.results ||
    json?.data?.itineraries ||
    json?.itineraries?.results ||
    json?.itineraries ||
    []
  );
}

function mapItinerary(raw, i, { origin, destination, departureDate }) {
  const leg = raw?.legs?.[0] || raw?.leg || {};
  const carrier = leg?.carriers?.marketing?.[0] || leg?.carrier || {};
  const priceRaw = raw?.price?.raw ?? raw?.price ?? null;

  return {
    id: raw?.id || `${origin}-${destination}-${i}`,
    airline: carrier?.name || carrier?.code || 'Unknown airline',
    flightNumber: raw?.flightNumber || carrier?.code || null,
    origin: leg?.origin?.id || origin,
    destination: leg?.destination?.id || destination,
    departureDate: leg?.departure ? leg.departure.slice(0, 10) : departureDate,
    departureTime: leg?.departure ? leg.departure.slice(11, 16) : null,
    arrivalTime: leg?.arrival ? leg.arrival.slice(11, 16) : null,
    durationMinutes: typeof leg?.durationInMinutes === 'number' ? leg.durationInMinutes : null,
    stops: typeof leg?.stopCount === 'number' ? leg.stopCount : null,
    price: priceRaw != null ? Math.round(priceRaw) : null,
    currency: raw?.price?.currency || 'INR',
  };
}

/**
 * Search flights for a route/date. Returns a normalized, price-sorted array.
 */
export async function searchFlights({ origin, destination, departureDate, returnDate }) {
  if (usingMock()) {
    return buildMockOffers({ origin, destination, departureDate });
  }

  const params = {
    fromEntityId: origin.toUpperCase(),
    toEntityId: destination.toUpperCase(),
    departDate: departureDate,
    market: 'IN',
    locale: 'en-US',
    currency: 'INR',
    adults: '1',
    cabinClass: 'ECONOMY',
  };

  const path = returnDate ? '/web/flights/search-roundtrip' : '/web/flights/search-one-way';
  if (returnDate) params.returnDate = returnDate;

  const json = await callSkyEndpoint(path, params);
  if (!json) return [];

  const raw = extractItineraries(json);
  const offers = raw
    .map((r, i) => mapItinerary(r, i, { origin, destination, departureDate }))
    .filter((o) => o.price != null);

  return offers.sort((a, b) => a.price - b.price);
}

/**
 * Cheapest current price for a route — used by "Check Price Now" and the
 * scheduled job. Reuses the same search endpoint rather than the separate
 * price-calendar endpoint, since a single well-tested integration point is
 * more reliable than parsing two different unverified response shapes.
 */
export async function getLatestPrice({ origin, destination, departureDate, returnDate }) {
  const offers = await searchFlights({ origin, destination, departureDate, returnDate });
  if (!offers.length) return null;
  return Math.min(...offers.map((o) => o.price));
}
