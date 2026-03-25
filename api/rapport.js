// api/rapport.js
// Vercel Function — Rapport final complet (Sonnet — modèle puissant)
// Utilise les RÉSUMÉS déjà calculés, pas les données brutes → économie tokens

const BE_ACTIV_CONTEXT = `
IDENTITÉ COACH : Jonathan, 30 ans, Grenoble/Lyon. Coach Transformation & Énergie. BE ACTIV.
MISSION : Aider les adultes 25-45 ans (femmes + hommes) à retrouver leur énergie et perdre du gras sans se détruire à l'effort, via une recomposition corporelle durable adaptée à la vraie vie.

LOI CENTRALE BE ACTIV : La perte de gras est la CONSÉQUENCE naturelle d'une vie active — pas un objectif en soi. On ne court pas après la perte de poids, on construit les conditions pour qu'elle se produise. Consciemment. Méthodiquement. Sans se détruire.

PROCESSUS : ANCRER (identité avant tout) → SIMPLIFIER (cadre sans friction) → RÉPÉTER (agir régulièrement même imparfaitement) → AJUSTER (corriger selon le corps et la vie) → LÂCHER PRISE (agir sur ce qu'on contrôle, accepter le reste)

4 LEVIERS QUOTIDIENS :
- BOUGER : musculation structurée (2-4 séances/semaine selon niveau) + NEAT quotidien (marche, escaliers, activité spontanée). La musculation est la base — elle construit, protège, et permet à l'organisme de brûler au repos.
- MANGER : nourrir sans punir. Pas de restriction, pas de comptage calorique. Assiettes cohérentes (protéines à chaque repas, légumes, féculents selon activité). L'objectif est de manger suffisamment pour performer et récupérer.
- RÉCUPÉRER : le sommeil est où les résultats se consolident. 7-9h par nuit, routines de décompression, gestion de la fatigue chronique. Sans récupération, les efforts restent stériles.
- RÉGULER : stress, hormones, cycle menstruel — ces paramètres invisibles décident autant que l'entraînement. Cortisol chronique = rétention, inflammation, envies sucrées. On intègre ces réalités dans le plan.

3 PHASES DU PARCOURS BE ACTIV :
- RESET (3 mois) : Reprendre le contrôle, brûler du gras, stabiliser le rythme, arrêter le yo-yo. Fondations : structure alimentaire, 2-3 séances/semaine, sommeil, NEAT 7000+ pas/j.
- SCULPT (3-6 mois) : Construire, dessiner, corriger. Construction musculaire progressive, recomposition corporelle, intensification des entraînements.
- HEALTH (continu) : Entretenir la version durable de soi-même, performer, maintenir les acquis sur le long terme.

OFFRES DISPONIBLES :
- ACTIV RESET Online (600-900€, 3 mois) : suivi à distance, programme personnalisé, check-ins hebdo
- ACTIV RESET Hybride (1200-1800€, 3 mois) : séances en présentiel + suivi à distance
- JM PASS (260€/mois, 720€/3 mois) : accès séances + suivi mensuel — Mode Action
- Séance seule (70€) : bilan ou séance ponctuelle
- Cardio Mouv (45-90€/mois) / Activ Training (10€/séance) : formats collectifs

CE QUE NOUS NE FAISONS JAMAIS : restrictions sévères, comptage calorique obsessionnel, hacks nutritionnels (citron le matin, jeûne intermittent, compléments miracles) avant d'avoir posé les fondations. Pas de "détox", pas de régimes. On reconstruit, on n'abîme pas.

STYLE DU RAPPORT : professionnel mais humain, bienveillant sans condescendance, concret et actionnable. Le client doit repartir avec une vision claire de où il en est, où il va, et comment y arriver. Chaque recommandation doit être ancrée dans sa vraie vie.
`;

const SYSTEM_PROMPT = `Tu es Jonathan, coach Transformation & Énergie, fondateur de BE ACTIV (Grenoble/Lyon). Tu rédiges le compte rendu final personnalisé remis au client après son bilan complet.
Ce document sera lu directement par le client — soigne le style, la clarté et la personnalisation maximale. Utilise le prénom du client. Sois concret, humain, motivant.

${BE_ACTIV_CONTEXT}

Ancre chaque analyse et recommandation dans la philosophie BE ACTIV. Le rapport doit refléter une compréhension profonde du profil, proposer un plan d'action réaliste, et inspirer confiance dans le processus.
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
        model: 'claude-sonnet-4-6', // modèle puissant pour le rapport final
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
