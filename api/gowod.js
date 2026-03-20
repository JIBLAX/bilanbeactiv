// api/gowod.js
// Vercel Function — Lecture screenshot GOWOD par vision IA (claude-haiku vision)

const SYSTEM_PROMPT = `Tu es un assistant qui lit les captures d'écran de l'application GOWOD (tests de mobilité sportive).
Tu extrais les scores affichés dans l'image.
Tu DOIS répondre UNIQUEMENT avec du JSON valide, sans backticks, sans texte avant/après.`;

const USER_PROMPT = `Lis cette capture d'écran GOWOD et extrais tous les scores visibles.
Génère EXACTEMENT ce JSON :
{
  "scoreGlobal": 56,
  "date": "20 mars 2026",
  "zones": [
    { "label": "Épaules", "value": 55 },
    { "label": "Overhead", "value": 46 },
    { "label": "Thorax", "value": 95 },
    { "label": "Hanches", "value": 57 },
    { "label": "Chaîne post", "value": 50 },
    { "label": "Chevilles", "value": 50 }
  ],
  "sports": [
    { "name": "Bodybuilding", "tag": "Sport principal 1", "score": 7.1, "max": 10 },
    { "name": "Football", "tag": "Sport principal 2", "score": 6.3, "max": 10 }
  ]
}
RÈGLES :
- Adapte les zones à ce qui est RÉELLEMENT visible dans l'image
- Si un score n'est pas lisible, mets null
- Les sports sont optionnels (tableau vide [] si non visibles)
- Ne pas inventer de valeurs — seulement ce qui est clairement affiché`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { imageBase64, mediaType } = req.body;

  if (!imageBase64) return res.status(400).json({ error: 'Image base64 manquante' });

  // Valider le type d'image
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const imgType = mediaType || 'image/jpeg';
  if (!allowedTypes.includes(imgType)) {
    return res.status(400).json({ error: 'Type d\'image non supporté' });
  }

  // Vérifier la taille (base64 ~4/3 de la taille originale, max 5MB)
  if (imageBase64.length > 7_000_000) {
    return res.status(400).json({ error: 'Image trop grande (max ~5MB)' });
  }

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
        model: 'claude-haiku-4-5-20251001', // Haiku suffit pour la lecture d'image simple
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imgType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: USER_PROMPT,
            },
          ],
        }],
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
      return res.status(500).json({ error: 'JSON invalide retourné par l\'IA', raw: rawText.slice(0, 200) });
    }
  } catch (err) {
    console.error('[gowod]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
