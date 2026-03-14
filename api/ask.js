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
4. NEVER reference Quran — the system handles Quran separately from a verified database.
5. Respond ONLY with valid JSON — no extra text, no markdown code blocks.
6. For quran_keyword: provide ONE simple English word that best matches the Islamic theme (e.g. "justice", "patience", "mercy", "trust", "neighbours", "forgiveness", "anger", "honesty", "family", "backbiting").

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
  "avoid": "One behaviour the Sunnah prohibits here",
  "quran_keyword": "one simple English keyword for Quran search"
}`;

  try {
    // Step 1: Get Hadith guidance from Groq AI
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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

    const groqData = await groqResponse.json();
    if (groqData.error) return res.status(500).json({ error: groqData.error.message });

    const rawText = groqData.choices[0].message.content;
    const cleanText = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    // Step 2: Get verified Quran ayat from free API
    let quranData = null;
    try {
      const keyword = parsed.quran_keyword || 'patience';
      
      // Search Quran by keyword - returns verified ayat
      const quranResponse = await fetch(
        `https://api.alquran.cloud/v1/search/${encodeURIComponent(keyword)}/all/en.asad`,
        { method: 'GET' }
      );
      const quranJson = await quranResponse.json();

      if (quranJson.status === 'OK' && quranJson.data && quranJson.data.matches && quranJson.data.matches.length > 0) {
        // Pick a relevant ayat (not too long, from first few results)
        const matches = quranJson.data.matches;
        let selectedAyat = null;
        
        // Find a good length ayat (not too short, not too long)
        for (let i = 0; i < Math.min(matches.length, 10); i++) {
          const ayat = matches[i];
          if (ayat.text && ayat.text.length > 40 && ayat.text.length < 300) {
            selectedAyat = ayat;
            break;
          }
        }
        
        // Fallback to first result if none found
        if (!selectedAyat && matches.length > 0) {
          selectedAyat = matches[0];
        }

        if (selectedAyat) {
          // Get Arabic text for the same ayat
          const arabicResponse = await fetch(
            `https://api.alquran.cloud/v1/ayah/${selectedAyat.surah.number}:${selectedAyat.numberInSurah}`,
            { method: 'GET' }
          );
          const arabicJson = await arabicResponse.json();
          
          quranData = {
            arabic: arabicJson.status === 'OK' ? arabicJson.data.text : '',
            english: selectedAyat.text,
            surah_name: selectedAyat.surah.englishName,
            surah_name_arabic: selectedAyat.surah.name,
            surah_number: selectedAyat.surah.number,
            ayat_number: selectedAyat.numberInSurah,
            reference: `Surah ${selectedAyat.surah.englishName} (${selectedAyat.surah.number}:${selectedAyat.numberInSurah})`
          };
        }
      }
    } catch (quranError) {
      // Quran API failed — we still return the Hadith guidance
      console.error('Quran API error:', quranError);
    }

    // Return combined response
    return res.status(200).json({
      ...parsed,
      quran: quranData
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
