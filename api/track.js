/**
 * POST /api/track
 *
 * Ontvangt een tracking-event van de onboarding en werkt het HubSpot-contact bij.
 * Maakt het contact aan als het nog niet bestaat.
 *
 * Body:
 * {
 *   email, voornaam, naam, tel,
 *   event: 'start' | 'step_reached' | 'exit' | 'completed',
 *   stapId, stapLabel, stapIndex, sectie,
 *   antwoorden: { ... }
 * }
 */

const {
  TOKEN, findContact, createContact, updateContact, subscribeContactToMarketing,
  STAP_DEEL, TOTAAL_ECHTE_STAPPEN, berekenStatus, toHubSpotDate, setCorsHeaders,
} = require('./_helpers');

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);

  // Vercel stuurt preflight OPTIONS-verzoeken — meteen beantwoorden
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });
  if (!TOKEN)                   return res.status(500).json({ error: 'HUBSPOT_TOKEN niet ingesteld' });

  try {
    const {
      email, voornaam, naam, tel,
      event, stapId, stapLabel, stapIndex, sectie, antwoorden, consentMarketing, subscriptionTypeId,
    } = req.body;

    if (!email) return res.status(400).json({ error: 'email is verplicht' });

    const deel       = STAP_DEEL[stapId] || 1;
    const isVoltooid = event === 'completed';
    const isExit     = event === 'exit';
    const status     = berekenStatus(stapId, isVoltooid, isExit);
    const pct        = Math.min(Math.round(((stapIndex || 0) / TOTAAL_ECHTE_STAPPEN) * 100), 100);
    const now        = new Date().toISOString();
    const nowMs      = toHubSpotDate(now);

    const props = {
      onboarding_status:              status,
      onboarding_deel:                String(deel),
      onboarding_laatste_vraag_id:    stapId     || '',
      onboarding_laatste_vraag_label: stapLabel  || '',
      onboarding_stap_index:          String(stapIndex ?? 0),
      onboarding_sectie:              sectie     || '',
      onboarding_laatste_activiteit:  nowMs,
      onboarding_voortgang_pct:       String(pct),
    };

    // Houd de contactgegevens synchroon met de laatst ingevulde waarden.
    if (voornaam) props.firstname = voornaam;
    if (naam)     props.lastname  = naam;
    if (tel)      props.phone     = tel;
    if (consentMarketing) {
      props.hs_legal_basis = 'Freely given consent from contact';
      props.hs_email_optout = 'false';
    }

    // Sla antwoorden op voor resume (enkel als er inhoud is)
    if (antwoorden && Object.keys(antwoorden).length > 0) {
      // HubSpot textarea-properties hebben een limiet van ~65.000 tekens
      const json = JSON.stringify(antwoorden);
      if (json.length < 60000) {
        props.onboarding_antwoorden_json = json;
      }
    }

    if (event === 'start')    props.onboarding_gestart_op   = nowMs;
    if (isVoltooid)           props.onboarding_voltooid_op  = nowMs;

    // Contact opzoeken of aanmaken
    const existing = await findContact(email);

    let contactId;
    if (!existing) {
      const created = await createContact({
        email,
        firstname: voornaam || '',
        lastname:  naam     || '',
        phone:     tel      || '',
        ...props,
      });
      contactId = created.id;
    } else {
      contactId = existing.id;
      await updateContact(contactId, props);
    }

    if (consentMarketing) {
      try {
        const subscribeResult = await subscribeContactToMarketing(email, subscriptionTypeId);
        if (subscribeResult?.skipped) {
          console.warn('[track] marketing subscribe overgeslagen:', subscribeResult);
        }
      } catch (subscribeErr) {
        console.error('[track] marketing subscribe fout:', subscribeErr);
      }
    }

    return res.status(200).json({ ok: true, contactId });
  } catch (err) {
    console.error('[track] fout:', err);
    return res.status(500).json({ error: 'Interne fout', detail: err.message });
  }
}
