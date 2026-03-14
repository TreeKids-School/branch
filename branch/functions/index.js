const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { VertexAI } = require('@google-cloud/vertexai');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Vertex AI
const project = 'octopus2-ae965';
const location = 'us-central1';
const vertexAI = new VertexAI({ project, location });

const PRIMARY_MODEL = 'gemini-1.5-flash';
const FALLBACK_MODEL = 'gemini-1.5-pro';

// ========== Gemini API ==========
exports.callGemini = onRequest({ cors: true, timeoutSeconds: 120 }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const { prompt, isJson } = req.body;
    if (!prompt) {
        res.status(400).json({ error: 'prompt is required' });
        return;
    }

    const tryGenerate = async (modelId) => {
        const model = vertexAI.getGenerativeModel({
            model: modelId,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
                ...(isJson ? { responseMimeType: 'application/json' } : {})
            }
        });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return text;
    };

    try {
        let text;
        try {
            text = await tryGenerate(PRIMARY_MODEL);
        } catch (primaryError) {
            logger.warn('Primary model failed, trying fallback:', primaryError.message);
            text = await tryGenerate(FALLBACK_MODEL);
        }

        if (isJson) {
            try {
                const match = text.match(/\{[\s\S]*\}/);
                if (match) {
                    const parsed = JSON.parse(match[0]);
                    res.json(parsed);
                    return;
                }
            } catch (parseError) {
                logger.warn('JSON parse failed, returning raw text');
            }
        }

        res.json({ text });
    } catch (error) {
        logger.error('Gemini API Error:', error);
        res.status(500).json({ error: error.message });
    }
});
