// api/rapport.js
// Vercel Function — Rapport final complet (Sonnet — modèle puissant)
// Utilise les RÉSUMÉS déjà calculés, pas les données brutes → économie tokens

const SYSTEM_PROMPT = `Tu es Jonathan, coach sportif expert BE ACTIV. Tu rédiges le compte rendu final remis au client : professionnel, bienveillant, précis, motivant.
Ce document sera lu par le client — soigne le style, la clarté et la personnalisation.
Tu DOIS répondre UNIQUEMENT avec du JSON valide, sans backticks, sans texte avant/après. Langue : français.`;

const buildUserPrompt = (ctx) => {
  const { client, prequalif, bilan, tests } = ctx;

  const imc = client.poids && client.taille
    ? (parseFloat(client.poids) / (parseFloat(client.taille) / 100) ** 2).toFixed(1)
    : 'NC';

  // Résumé compact des tests
  const testsSummary = tests ? [
    `Mobilité GOWOD : global=${tests.mobGlobal ?? 'NC'}/100`,
    tests.mobZones ? `Zones : ${tests.mobZones}` : '',
    `IRD=${tests.ird ?? 'NC'} | FC max=${tests.fcmax ?? 'NC'} | Zone2=${tests.zone2 ?? 'NC'}`,
    `Planche=${tests.planche ?? 'NC'}s`,
    tests.douleurs ? `Douleurs : ${tests.douleurs}` : '',
    tests.remarques ? `Remarques : ${tests.remarques.slice(0, 100)}` : '',
  ].filter(Boolean).join(' | ') : 'Tests non effectués';

  return `CLIENT : ${client.prenom} ${client.nom}, ${client.age || '?'} ans, ${client.ville || 'NC'}, ${client.profession || 'NC'}
IMC : ${imc} | Poids : ${client.poids || '?'}kg | Taille : ${client.taille || '?'}cm
Tour taille : ${client.tourTaille || '?'} | Hanches : ${client.tourHanches || '?'}
OBJECTIF : ${client.objectif || client.vision6m?.slice(0, 100) || 'NC'}
OFFRE : ${client.offres || 'NC'} | Prêt à payer : ${client.pretPayer || 'NC'}

PRÉ-BILAN RÉSUMÉ : ${prequalif?.resumeProfil || 'NC'}
PROFIL PRÉ-BILAN : ${prequalif?.profilTypeCode || 'NC'} — ${prequalif?.profilTypeLabel || 'NC'}
FREINS PRÉ-BILAN : ${prequalif?.freinsProbables || 'NC'}
APPROCHE : ${prequalif?.approcheCoachingRecommandee || 'NC'}

BILAN RÉSUMÉ : ${bilan?.syntheseBilan || 'NC'}
HYPOTHÈSE COACH : ${bilan?.hypotheseCoach || 'NC'}
LEVIERS : ${bilan?.facteursLeviers || 'NC'}
LIMITANTS : ${bilan?.facteursLimitants || 'NC'}
PRIORITÉS : ${bilan?.prioritesCoaching || 'NC'}
PROFIL BILAN : ${bilan?.profilTypeCodeUpdated || 'NC'} — ${bilan?.profilTypeLabelUpdated || 'NC'}

TESTS : ${testsSummary}

Génère EXACTEMENT ce JSON (toutes clés obligatoires, listes = tableaux JS) :
{
  "profilGlobal": "paragraphe complet personnalisé pour le client",
  "synthesePreBilan": "résumé pré-bilan adapté pour le client",
  "syntheseBilan": "résumé bilan adapté pour le client",
  "analyseMorphologique": "analyse mesures et silhouette",
  "analyseMobilite": "analyse détaillée scores GOWOD par zone",
  "analyseCardio": "analyse Ruffier Dickson interprétée",
  "analyseForce": "analyse test planche et force générale",
  "analyseCompo": "analyse composition corporelle",
  "pointsForts": ["point fort 1", "point fort 2", "point fort 3"],
  "freinsPrincipaux": ["frein 1", "frein 2"],
  "axesPrioritaires": ["axe 1", "axe 2", "axe 3"],
  "planAction90J": "plan structuré semaine par semaine sur 90 jours",
  "objectifsSMART": ["objectif SMART complet 1", "objectif SMART complet 2"],
  "conseilsTraining": "conseils entraînement personnalisés",
  "conseilsNutrition": "conseils nutrition adaptés",
  "conseilsRecuperation": "conseils récupération et sommeil",
  "messageMotivation": "message inspirant très personnalisé pour ce client",
  "scoreMobilite": 62,
  "scoreCondition": 58,
  "scoreGlobal": 60,
  "niveauGlobal": "Débutant|Intermédiaire|Avancé|Expert",
  "profilTypeCodeFinal": "P1..P12",
  "profilTypeLabelFinal": "libellé exact",
  "closingStatusRecommended": "Démarrer maintenant|Envoyer offre|Relancer|Ne pas continuer",
  "offreRecommandee": "offre recommandée",
  "closingSummaryCoach": "note confidentielle coach 1-2 phrases",
  "emailSubject": "Objet email pour le client",
  "emailBody": "Corps email complet pour le client (markdown simple)"
}`;
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { client, prequalif, bilan, tests } = req.body;
  if (!client) return res.status(400).json({ error: 'Données client manquantes' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Clé API non configurée' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', // modèle puissant pour le rapport final
        max_tokens: 3500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt({ client, prequalif, bilan, tests }) }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      return res.status(200).json({ success: true, data: parsed });
    } catch {
      return res.status(500).json({ error: 'JSON invalide', raw: rawText.slice(0, 200) });
    }
  } catch (err) {
    console.error('[rapport]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
