// api/push-client.js
// Vercel Function — Synchro CRM → Business (Supabase)
// Pousse uniquement les données de fiche client (pas de données financières)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Variables Supabase non configurées' });
  }

  const { prospect } = req.body;

  if (!prospect || !prospect.name || !prospect.user_id) {
    return res.status(400).json({ error: 'Champs obligatoires manquants : name, user_id' });
  }

  // Contrat volontairement minimal :
  // BILAN envoie uniquement la fiche client utile au nommage/rattachement.
  const statusRaw = String(prospect.statut || '').trim().toUpperCase();
  const status =
    statusRaw === 'ARCHIVÉ' || statusRaw === 'ANCIEN CLIENT'
      ? 'ANCIEN_CLIENT'
      : statusRaw === 'PROSPECT'
        ? 'PROSPECT'
        : 'CLIENT_ACTIF';
  const payload = {
    user_id:                prospect.user_id,
    external_ref:           prospect.id,
    full_name:              prospect.name,
    status,
    person_kind:            prospect.person_kind || 'PARTICULIER',
    is_active:              status === 'CLIENT_ACTIF',
    phone:                  prospect.contact        || null,
    source_app:             'BILAN_CRM',
    offer_name:             prospect.offre          || null,
    amount:                 prospect.montant        || null,
    notes:                  prospect.notes          || null,
    profile:                prospect.profile        || null,
    sap_enabled:            prospect.sap_enabled    ?? false,
    group_id:               prospect.group_id       ?? null,
    group_name:             prospect.group_name     ?? null,
    is_group_leader:        prospect.is_group_leader ?? false,
  };

  try {
    // CRM writes ONLY in unified crm_people_v1.
    // Upsert by external_ref, fallback to (user_id,name,contact) when needed.
    const upsertRes = await fetch(
      `${supabaseUrl}/rest/v1/crm_people_v1`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!upsertRes.ok) {
      const err = await upsertRes.text();
      throw new Error(`Supabase upsert échoué : ${upsertRes.status} — ${err}`);
    }

    return res.status(200).json({ success: true, action: 'upserted', id: payload.external_ref });

  } catch (err) {
    console.error('[push-client]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
