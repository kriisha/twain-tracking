/**
 * Gedeelde hulpfuncties voor de Twain Tracking API (Vercel serverless)
 */

const TOKEN = process.env.HUBSPOT_TOKEN;

// ── HubSpot helpers ───────────────────────────────────────────

async function findContact(email) {
  const resp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
      properties: ['email', 'onboarding_status', 'onboarding_stap_index',
                   'onboarding_laatste_vraag_id', 'onboarding_antwoorden_json',
                   'onboarding_deel', 'onboarding_voortgang_pct'],
      limit: 1,
    }),
  });
  const data = await resp.json();
  return data.results?.[0] ?? null;
}

async function createContact(props) {
  const resp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: props }),
  });
  return await resp.json();
}

async function updateContact(contactId, props) {
  const resp = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: props }),
  });
  return await resp.json();
}

// ── Stap → deel mapping ───────────────────────────────────────

const STAP_DEEL = {
  intro_belegging: 1, doel: 1, invest: 1, horizon: 1, opnemen: 1, werkwijze: 1, themas: 1,
  intro_risico: 2, verplichtingen: 2, reserve: 2, risico: 2, stelling: 2,
  duurzaam: 2, duurz_eu: 2, duurz_pai_combined: 2, duurz_toepassing: 2, risicoscore: 2,
  intro_kennis: 3, ervaring: 3, quiz_video: 3, quiz1: 3, quiz2: 3, quiz3: 3,
  intro_persoon: 4, burgerstaat: 4, mifid: 4, beroep: 4,
  inkomen_aard: 4, inkomen_maand: 4, bankform: 4, overzicht: 4, detail: 4,
};

const TOTAAL_ECHTE_STAPPEN = 24;

function berekenStatus(stapId, isVoltooid, isUitgestapt) {
  if (isVoltooid)    return 'volledig';
  if (isUitgestapt)  return 'deel3_exit';
  const deel = STAP_DEEL[stapId] || 1;
  if (deel === 1)    return 'bezig';
  if (deel === 2)    return 'deel1_voltooid';
  return 'deel2_voltooid';
}

// HubSpot date-properties verwachten Unix ms als getal (midnight UTC)
function toHubSpotDate(isoString) {
  const d = new Date(isoString);
  // Zet naar midnight UTC van die dag
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return String(midnight);
}

// ── CORS helper ───────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://www.twain.eu',
  'https://twain.eu',
  'http://localhost',
  'http://127.0.0.1',
  'null', // file:// openen in browser geeft origin 'null'
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.some(o => origin === o || origin.startsWith(o));
  if (allowed || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = {
  TOKEN, findContact, createContact, updateContact,
  STAP_DEEL, TOTAAL_ECHTE_STAPPEN, berekenStatus, toHubSpotDate, setCorsHeaders,
};
