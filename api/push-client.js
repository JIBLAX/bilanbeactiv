// api/push-client.js
// Vercel Function — Synchro CRM → Business (Supabase)
// Pousse un prospect closé depuis BE ACTIV BILAN vers BE ACTIV BUSINESS
// Règle : ne jamais écraser les champs financiers gérés par Business

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

  // Champs autorisés à pousser (identité + origine uniquement)
  // Business gère en autonomie : prix_reel, sap_enabled, réductions, TVA, finance_entries
  const payload = {
    id: prospect.id,
    user_id: prospect.user_id,
    name: prospect.name,
    sex: prospect.sex || null,
    age: prospect.age || null,
    contact: prospect.contact || null,
    source: prospect.source || null,
    statut: prospect.statut || 'CLIENT',
    closing: 'OUI',
    offre: prospect.offre || null,
    date: prospect.date || new Date().toISOString().split('T')[0],
    objectif: prospect.objectif || null,
    notes: prospect.notes || null,
    profile: prospect.profile || null,
  };

  try {
    // Anti-doublon : vérifier si un prospect existe déjà par name + contact
    // (cas : client créé manuellement dans Business avant le closing CRM)
    if (prospect.contact) {
      const checkRes = await fetch(
        `${supabaseUrl}/rest/v1/prospects?user_id=eq.${prospect.user_id}&name=eq.${encodeURIComponent(prospect.name)}&contact=eq.${encodeURIComponent(prospect.contact)}&select=id&limit=1`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );

      if (checkRes.ok) {
        const existing = await checkRes.json();
        if (existing.length > 0 && !existing[0].id.startsWith('bcrm_')) {
          // Client existe déjà dans Business (créé manuellement) — on met juste à jour closing + offre
          const existingId = existing[0].id;
          await fetch(
            `${supabaseUrl}/rest/v1/prospects?id=eq.${existingId}`,
            {
              method: 'PATCH',
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
              body: JSON.stringify({
                closing: 'OUI',
                offre: payload.offre,
                profile: payload.profile,
                statut: payload.statut,
              }),
            }
          );
          return res.status(200).json({ success: true, action: 'updated_existing', id: existingId });
        }
      }
    }

    // Upsert — merge-duplicates préserve les champs non envoyés (financiers)
    const upsertRes = await fetch(
      `${supabaseUrl}/rest/v1/prospects`,
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

    return res.status(200).json({ success: true, action: 'upserted', id: payload.id });

  } catch (err) {
    console.error('[push-client]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
