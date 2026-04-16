// api/prequalif.js
// Vercel Function — Analyse pré-qualif depuis les réponses Calendly

const PROFIL_GRID = `P1=Je sais mais je n'y arrive pas|P2=Besoin d'être guidé(e)|P3=Motivé(e) mais instable|P4=Déconnecté(e) de son corps|P5=Mental fort / corps bloqué|P6=Multi-problèmes / désorganisé(e)|P7=Corps en résistance|P8=Hyper-actif(ve)|P9=Image corporelle abîmée|P10=Performant(e) pro / chaos perso|P11=Non compatible BE ACTIV|P12=Cas médical / clinique`;

const BE_ACTIV_CONTEXT = `
IDENTITÉ COACH : Jonathan, 30 ans, Grenoble/Lyon. Coach Transformation & Énergie. BE ACTIV.
MISSION : Aider les adultes 25-45 ans (femmes + hommes) à retrouver leur énergie et perdre du gras sans se détruire à l'effort, via une recomposition corporelle durable adaptée à la vraie vie.

LOI CENTRALE BE ACTIV : La perte de gras est la CONSÉQUENCE naturelle d'une vie active — pas un objectif en soi. On ne court pas après la perte de poids, on construit les conditions pour qu'elle se produise. Consciemment. Méthodiquement. Sans se détruire.

PROCESSUS : ANCRER (identité avant tout) → SIMPLIFIER (cadre sans friction) → RÉPÉTER (agir régulièrement même imparfaitement) → AJUSTER (corriger selon le corps et la vie) → LÂCHER PRISE (agir sur ce qu'on contrôle, accepter le reste)

4 LEVIERS QUOTIDIENS : BOUGER (musculation structurée + NEAT quotidien) | MANGER (nourrir sans punir, pas de restriction, assiettes cohérentes) | RÉCUPÉRER (sommeil = où les résultats se consolident) | RÉGULER (stress, hormones, cycle menstruel — ces paramètres invisibles décident autant que l'entraînement)

3 PHASES DU PARCOURS BE ACTIV :
- RESET : Reprendre le contrôle, brûler du gras, stabiliser le rythme, arrêter le yo-yo
- SCULPT : Construire, dessiner, corriger (construction musculaire, recomposition)
- HEALTH : Entretenir la version durable de soi-même, performer

OFFRES DISPONIBLES :
- ACTIV RESET Online (600-900€, 3 mois) ou Hybride (1200-1800€, 3 mois) — Transformation complète
- JM PASS (260€/mois, 720€/3 mois) ou Séance seule (70€) — Mode Action
- Cardio Mouv (45-90€/mois) / Activ Training (10€/séance) — Collectif

AVATAR IDÉAL : Adulte 25-45 ans, salarié/entrepreneur/parent, Grenoble/Lyon, fatigue chronique, manque de structure, multiples tentatives échouées, prêt à investir 150€+/mois.

CE QUE NOUS NE FAISONS JAMAIS : restrictions sévères, comptage calorique obsessionnel, hacks nutritionnels (citron le matin, jeûne intermittent, compléments) avant d'avoir posé les fondations.

STYLE JONATHAN : court, direct, impactant, bienveillant, jamais condescendant. On crée un cadre interne adapté à la vraie vie de chacun.
`;

const SYSTEM_PROMPT = `Tu es l'assistant IA de Jonathan (BE ACTIV). Tu analyses les réponses du questionnaire Calendly pré-RDV pour classer le profil prospect.

${BE_ACTIV_CONTEXT}

GRILLE PROFILS BE ACTIV : ${PROFIL_GRID}

RÈGLES STRICTES :
- 1 profil principal OBLIGATOIRE (P1..P12)
- 1 profil secondaire OPTIONNEL (null si non pertinent)
- Justifie ton choix dans le contexte de la méthode BE ACTIV (RESET/SCULPT/HEALTH)
- Ne jamais inventer de pathologie médicale
- Si doute médical sérieux → orienter P12
- Si infos insuffisantes → rester prudent
- L'approche recommandée doit être cohérente avec la philosophie BE ACTIV (pas de restriction, pose les fondations d'abord)
Tu DOIS répondre UNIQUEMENT avec du JSON valide, sans backticks, sans texte avant/après.`;

const buildUserPrompt = (raw) => `Voici les réponses brutes du questionnaire Calendly (pré-RDV) :
---
${raw.slice(0, 3500)}
---
Génère EXACTEMENT ce JSON (toutes les clés obligatoires) :
{
  "resumeProfil": "2-3 phrases résumant le profil dans le contexte BE ACTIV",
  "objectifPrincipal": "objectif en une phrase courte",
  "freinsProbables": "freins identifiés (comportementaux, structurels, mentaux)",
  "motivationsDominantes": "leviers motivationnels principaux",
  "pointsDeVigilance": "points d'attention pour Jonathan en tant que coach BE ACTIV",
  "niveauUrgence": "Faible|Moyen|Élevé|Critique",
  "profilTypeCode": "P1..P12",
  "profilTypeLabel": "libellé exact de la grille",
  "profilTypeCodeSecondaire": "P1..P12 ou null",
  "profilTypeLabelSecondaire": "libellé ou null",
  "profilTypeReason": "justification du choix en lien avec la méthode BE ACTIV",
  "approcheCoachingRecommandee": "approche recommandée cohérente avec la philosophie BE ACTIV",
  "phaseRecommandee": "RESET|SCULPT|HEALTH — phase la plus adaptée à ce profil",
  "offreRecommandee": "ACTIV RESET Online|ACTIV RESET Hybride|JM PASS|Cardio Mouv|Activ Training|Séance seule",
  "closingPotential": 75,
  "closingStatusSuggestion": "Chaud|Tiède|Froid|À qualifier"
}`;

// ─── Handler ───────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // Support both field names (raw = nouveau, tallyRaw = ancien)
  const raw = req.body.raw || req.body.tallyRaw;

  if (!raw || raw.trim().length < 20) {
    return res.status(400).json({ error: 'Réponses trop courtes ou vides' });
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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1400,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(raw) }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `Anthropic HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';
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
      return res.status(500).json({ error: 'La réponse IA n\'est pas du JSON valide', raw: rawText.slice(0, 200) });
    }

    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    console.error('[prequalif] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
