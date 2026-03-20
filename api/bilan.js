// api/bilan.js
// Vercel Function — Synthèse bilan interne coach

const SYSTEM_PROMPT = `Tu es l'assistant IA du coach Jonathan (BE ACTIV). Tu analyses les données du bilan coach et produis une synthèse professionnelle.
IMPORTANT : Tu reçois un résumé compact des données — pas les données brutes complètes (optimisation des tokens).
Tu DOIS répondre UNIQUEMENT avec du JSON valide, sans backticks, sans texte avant/après. Langue : français.`;

const buildUserPrompt = (bilanData, prequalifSummary) => {
  // Contexte pré-bilan (résumé court pour économiser les tokens)
  const pqCtx = prequalifSummary
    ? `CONTEXTE PRÉ-BILAN : Profil ${prequalifSummary.profilTypeCode} (${prequalifSummary.profilTypeLabel}) — Closing estimé ${prequalifSummary.closingPotential}% — Vigilances : ${prequalifSummary.pointsDeVigilance || 'aucune'} — Approche : ${prequalifSummary.approcheCoachingRecommandee || 'NC'}`
    : 'Pré-bilan non effectué';

  const b = bilanData;
  const imc = b.poids && b.taille
    ? (parseFloat(b.poids) / (parseFloat(b.taille) / 100) ** 2).toFixed(1)
    : 'NC';

  return `${pqCtx}

DONNÉES BILAN :
Client : ${b.prenom || '?'} ${b.nom || '?'}, ${b.age || '?'} ans, ${b.ville || 'NC'} — ${b.profession || 'NC'}
Source : ${b.source || 'NC'} | RDV : ${b.rdvType || 'NC'} ${b.rdvStatut || ''}
Profil coach : ${b.profilTypeCode || 'NC'}

MORPHO : ${b.poids || '?'}kg ${b.taille || '?'}cm IMC=${imc} | TT=${b.tourTaille || '?'} TH=${b.tourHanches || '?'}

ENTRAÎNEMENT : ${(b.notesTrain || '').slice(0, 120)}
Dispo : ${b.dispoJours || 'NC'} | Relation : ${b.relationTrain || 'NC'} | Faille : ${b.failleTrain || 'NC'} | Matériel : ${b.materiel || 'NC'}

NEAT : ${b.pas || '?'} pas/j | Faille : ${b.failleNeat || 'NC'}

ALIMENTATION : ${(b.notesAlim || '').slice(0, 100)}
Relation : ${b.relationAlim || 'NC'} | Intolérances : ${b.intolerances || 'NC'}

MODE DE VIE : ${(b.notesVie || '').slice(0, 100)}
Relation : ${b.relationVie || 'NC'} | Faille : ${b.failleVie || 'NC'}

POINT B — VISION 6 MOIS : ${(b.vision6m || '').slice(0, 180)}
BLOCAGES : ${(b.blocages || '').slice(0, 120)}
ATTENTE COACHING : ${(b.attenteCoach || '').slice(0, 120)}

OFFRE PROPOSÉE : ${b.offres || 'NC'} | PRÊT À PAYER : ${b.pretPayer || 'NC'} | MONTANT : ${b.montant || '?'}€

Génère EXACTEMENT ce JSON :
{
  "syntheseBilan": "synthèse complète 3-4 phrases",
  "hypotheseCoach": "hypothèse principale sur le profil",
  "facteursLimitants": "freins concrets identifiés",
  "facteursLeviers": "leviers à exploiter",
  "incoherencesOuVigilances": "incohérences ou points d'attention, null si aucun",
  "prioritesCoaching": "3 priorités concrètes séparées par /",
  "profilTypeCodeUpdated": "P1..P12",
  "profilTypeLabelUpdated": "libellé exact",
  "profileEvolutionNote": "évolution vs pré-bilan ou null",
  "closingPotentialUpdated": 75,
  "recommandationSuiteRDV": "Démarrer maintenant|Envoyer offre|Relancer dans 1 semaine|Ne pas continuer",
  "offreRecommandee": "nom de l'offre la plus adaptée"
}`;
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { bilanData, prequalifSummary } = req.body;
  if (!bilanData) return res.status(400).json({ error: 'Données bilan manquantes' });

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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1300,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(bilanData, prequalifSummary) }],
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
    console.error('[bilan]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
