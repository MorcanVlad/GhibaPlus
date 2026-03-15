import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, target } = body;

    // 1. Dacă textul este gol, returnăm direct
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json({ translatedText: text || "" });
    }

    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    
    if (!apiKey) {
      console.error("Lipsește GOOGLE_TRANSLATE_API_KEY din .env.local!");
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 2. SECRETUL AICI ESTE: Preluăm site-ul de unde vine cererea (ex: localhost:3000 sau domeniul tău final)
    const host = request.headers.get('origin') || request.headers.get('referer') || 'http://localhost:3000';

    // 3. Facem cererea către Google, incluzând Referer-ul falsificat/preluat ca să trecem de protecție
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Referer': host // Trimitem originea către Google
      },
      body: JSON.stringify({ q: text, target: target, source: 'ro', format: 'text' })
    });

    const data = await res.json();

    if (data.error) {
      console.error("Eroare de la Google API:", data.error.message);
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    return NextResponse.json({ translatedText: data.data.translations[0].translatedText });
  } catch (error) {
    console.error("Eroare severă API intern:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}