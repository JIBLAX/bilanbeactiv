// api/prequalif.js
// Vercel Function — Analyse pré-bilan depuis les réponses Tally
// Clé Anthropic stockée dans les variables d'environnement Vercel (jamais exposée au frontend)

const PROFIL_GRID = `P1=Je sais mais je n'y arrive pas|P2=Besoin d'être guidé(e)|P3=Motivé(e) mais instable|P4=Déconnecté(e) de son corps|P5=Mental fort / corps bloqué|P6=Multi-problèmes / désorganisé(e)|P7=Corps en résistance|P8=Hyper-actif(ve)|P9=Image corporelle abîmée|P10=Performant(e) pro / chaos perso|P11=Non compatible BE ACTIV|P12=Cas médical / clinique`;

const SYSTEM_PROMPT = `Tu es l'assistant IA du coach Jonathan (BE ACTIV). Tu analyses les réponses d'un formulaire prospect et classes le profil.
GRILLE PROFILS : ${PROFIL_GRID}
RÈGLES STRICTES :
- 1 profil principal OBLIGATOIRE (P1..P12)
- 1 profil secondaire OPTIONNEL (null si non pertinent)
- Justifie ton choix en 1-2 phrases
- Ne jamais inventer de pathologie médicale
- Si doute médical sérieux → orienter P12
- Si infos insuffisantes → rester prudent
Tu DOIS répondre UNIQUEMENT avec du JSON valide, sans backticks, sans texte avant/après.`;

const buildUserPrompt = (tallyRaw) => `Voici les réponses brutes du formulaire prospect :
---
${tallyRaw.slice(0, 3500)}
---
Génère EXACTEMENT ce JSON (toutes les clés obligatoires) :
{
  "resumeProfil": "2-3 phrases résumant le profil",
  "objectifPrincipal": "objectif en une phrase courte",
  "freinsProbables": "freins identifiés",
  "motivationsDominantes": "leviers motivationnels",
  "pointsDeVigilance": "points d'attention coach",
  "niveauUrgence": "Faible|Moyen|Élevé|Critique",
  "profilTypeCode": "P1..P12",
  "profilTypeLabel": "libellé exact de la grille",
  "profilTypeCodeSecondaire": "P1..P12 ou null",
  "profilTypeLabelSecondaire": "libellé ou null",
  "profilTypeReason": "justification du choix en 1-2 phrases",
  "approcheCoachingRecommandee": "approche recommandée",
  "closingPotential": 75,
  "closingStatusSuggestion": "Chaud|Tiède|Froid|À qualifier"
}`;

// ─── Handler ───────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { tallyRaw } = req.body;

  if (!tallyRaw || tallyRaw.trim().length < 20) {
    return res.status(400).json({ error: 'Texte Tally trop court ou vide' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé API Anthropic non configurée côté serveur' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // modèle économique pour synthèse intermédiaire
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(tallyRaw) }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `Anthropic HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    // Nettoyage défensif du JSON
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[prequalif] JSON parse error:', parseErr.message);
      console.error('[prequalif] Raw text:', rawText.slice(0, 300));
      return res.status(500).json({
        error: 'La réponse IA n\'est pas du JSON valide',
        raw: rawText.slice(0, 200),
      });
    }

    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    console.error('[prequalif] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
