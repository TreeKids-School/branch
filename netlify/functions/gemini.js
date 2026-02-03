// Netlify Function to proxy requests to Gemini API without exposing the key to the client.

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let prompt = '';
  let isJson = false;
  try {
    const body = JSON.parse(event.body || '{}');
    prompt = body.prompt || '';
    isJson = !!body.isJson;
  } catch (_) { }

  if (!prompt) {
    return { statusCode: 400, body: JSON.stringify({ error: 'prompt is required' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.REACT_APP_GEMINI_API_KEY_AI;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  try {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 }
      })
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      const message = data.error?.message || 'Gemini API error';
      console.error('Gemini API Error Detail:', JSON.stringify(data.error, null, 2));
      return { statusCode: res.status || 500, body: JSON.stringify({ error: message }) };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let parsed = null;
    if (isJson && text) {
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
      } catch (_) {
        parsed = null;
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, parsed })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Unknown error' })
    };
  }
};
