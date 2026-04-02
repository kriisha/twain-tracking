/**
 * GET /api/resume?email=...
 *
 * Geeft de opgeslagen voortgang terug zodat de onboarding kan hervatten.
 *
 * Response:
 * {
 *   found: true,
 *   contactId, status, stapIndex, stapId, deel, voortgangPct,
 *   antwoorden: { ... }
 * }
 */

const { TOKEN, findContact, setCorsHeaders } = require('./_helpers');

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed' });
  if (!TOKEN)                   return res.status(500).json({ error: 'HUBSPOT_TOKEN niet ingesteld' });

  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email is verplicht' });

    const contact = await findContact(email);
    if (!contact) return res.status(200).json({ found: false });

    const p = contact.properties || {};

    let antwoorden = {};
    if (p.onboarding_antwoorden_json) {
      try { antwoorden = JSON.parse(p.onboarding_antwoorden_json); }
      catch (_) { antwoorden = {}; }
    }

    return res.status(200).json({
      found:        true,
      contactId:    contact.id,
      status:       p.onboarding_status        || 'niet_gestart',
      stapIndex:    parseInt(p.onboarding_stap_index)     || 0,
      stapId:       p.onboarding_laatste_vraag_id         || '',
      deel:         parseInt(p.onboarding_deel)           || 1,
      voortgangPct: parseInt(p.onboarding_voortgang_pct)  || 0,
      antwoorden,
    });
  } catch (err) {
    console.error('[resume] fout:', err);
    return res.status(500).json({ error: 'Interne fout', detail: err.message });
  }
}
