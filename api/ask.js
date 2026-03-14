export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { situation } = req.body;

  if (!situation) {
    return res.status(400).json({ error: 'No situation provided' });
  }

  const systemPrompt = `You are Adab Coach AI — a Sunnah Application Assistant. You help Muslims handle social challenges using Prophetic character (Akhlaq).

STRICT RULES:
1. You are NOT a Mufti. Never issue rulings. Never say something is haram or halal.
2. NEVER fabricate a Hadith. Only reference well-known authentic narrations.
3. Only use narrations graded Sahih or Hasan from: Bukhari, Muslim, Abu Dawud, Tirmidhi.
4. Respond ONLY with valid JSON — no extra text, no markdown code blocks.

Return this exact JSON structure:
{
  "principle": "The Prophetic principle in 1-2 sentences",
  "hadith_text": "The English text of the authentic narration",
  "collection": "e.g. Sahih al-Bukhari",
  "book": "e.g. Book of Good Manners",
  "hadith_number": "e.g. 6015",
  "grade": "Sahih",
  "scholar": "Imam al-Bukhari",
  "stage1": "First gentle direct approach",
  "stage2": "Follow-up if stage 1 fails",
  "stage3": "Final escalation through proper channels",
  "script": "A word-for-word sentence the user can say",
  "avoid": "One behaviour the Sunnah prohibits here"
}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
       model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `My situation: ${situation}` }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const rawText = data.choices[0].message.content;
    const cleanText = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    return res.status(200).json(parsed);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
