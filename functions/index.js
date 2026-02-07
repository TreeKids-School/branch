const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { VertexAI } = require('@google-cloud/vertexai');

// Initialize Vertex AI
const project = 'octopus-5735b';
const location = 'us-central1'; // Reverted to US for stability
const vertexAI = new VertexAI({ project: project, location: location });

// Try standard model IDs
const PRIMARY_MODEL = 'gemini-1.5-flash';
const FALLBACK_MODEL = 'gemini-1.5-pro'; // Fallback to pro model if flash fails

exports.callGemini = onRequest({ cors: false, timeoutSeconds: 60 }, async (req, res) => {
    // Manual CORS
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    let prompt = '';
    let isJson = false;
    try {
        const body = req.body;
        prompt = body.prompt || '';
        isJson = !!body.isJson;
    } catch (_) { }

    if (!prompt) {
        res.status(400).json({ error: 'prompt is required' });
        return;
    }

    // Function to generate content with a specific model
    const generate = async (modelName) => {
        const generativeModel = vertexAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.7,
            },
        });
        const request = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        };
        const result = await generativeModel.generateContent(request);
        const response = await result.response;
        return response.candidates[0].content.parts[0].text;
    };

    try {
        // Attempt with primary model
        logger.info(`Attempting generation with ${PRIMARY_MODEL}`);
        let text = '';
        try {
            text = await generate(PRIMARY_MODEL);
        } catch (primaryError) {
            logger.warn(`Primary model ${PRIMARY_MODEL} failed: ${primaryError.message}. Retrying with fallback ${FALLBACK_MODEL}`);
            // Retry with fallback
            text = await generate(FALLBACK_MODEL);
        }

        let parsed = null;
        if (isJson && text) {
            try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
            } catch (_) {
                parsed = null;
            }
        }

        res.status(200).json({ text, parsed });
    } catch (err) {
        logger.error('Vertex AI Error (Both models failed):', err);
        // Return a more user-friendly error including the Project ID/Location context
        res.status(500).json({
            error: err.message || 'Unknown error',
            details: `Project: ${project}, Location: ${location}`
        });
    }
});
