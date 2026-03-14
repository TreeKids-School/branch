const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { VertexAI } = require('@google-cloud/vertexai');
const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.database();

// Initialize Vertex AI
const project = 'octopus-5735b';
const location = 'us-central1';
const vertexAI = new VertexAI({ project: project, location: location });

// Try standard model IDs
const PRIMARY_MODEL = 'gemini-1.5-flash';
const FALLBACK_MODEL = 'gemini-1.5-pro';

// ========== Encryption Helpers ==========

/**
 * Encrypt child name using AES-256-GCM
 * @param {string} plaintext - The plain text to encrypt
 * @returns {string} - Encrypted string in format "enc:v1:iv:authTag:ciphertext"
 */
function encryptChildName(plaintext) {
    const key = process.env.CHILD_NAME_ENCRYPTION_KEY;
    if (!key) {
        throw new Error('CHILD_NAME_ENCRYPTION_KEY not set');
    }
    
    // Convert key to buffer (assuming it's a hex string)
    const keyBuffer = Buffer.from(key, 'hex');
    
    // Generate random IV
    const iv = crypto.randomBytes(12); // 12 bytes for GCM
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get auth tag
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Return format: enc:v1:iv:authTag:ciphertext
    return `enc:v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt child name
 * @param {string} ciphertext - Encrypted string in format "enc:v1:iv:authTag:ciphertext"
 * @returns {string} - Decrypted plain text
 */
function decryptChildName(ciphertext) {
    const key = process.env.CHILD_NAME_ENCRYPTION_KEY;
    if (!key) {
        throw new Error('CHILD_NAME_ENCRYPTION_KEY not set');
    }
    
    // Check if it's encrypted
    if (!ciphertext.startsWith('enc:v1:')) {
        // Not encrypted, return as-is (for backward compatibility)
        return ciphertext;
    }
    
    // Parse the encrypted string
    const parts = ciphertext.split(':');
    if (parts.length !== 5) {
        throw new Error('Invalid encrypted format');
    }
    
    const [, version, ivHex, authTagHex, encryptedHex] = parts;
    
    if (version !== 'v1') {
        throw new Error('Unsupported encryption version');
    }
    
    // Convert key to buffer
    const keyBuffer = Buffer.from(key, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

// ========== Storage API ==========

exports.storageApi = onRequest({ cors: true, timeoutSeconds: 60 }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const { action, data, childId, date } = req.body;

        switch (action) {
            case "getChildren": {
                const snapshot = await db.ref('children').once('value');
                const encryptedChildren = snapshot.val() || [];
                
                // Decrypt child names before returning
                const decryptedChildren = encryptedChildren.map(child => ({
                    ...child,
                    name: decryptChildName(child.name)
                }));
                
                res.json(decryptedChildren);
                break;
            }

            case "setChildren": {
                // Encrypt child names before saving
                const encryptedChildren = data.map(child => ({
                    ...child,
                    name: encryptChildName(child.name)
                }));
                
                await db.ref('children').set(encryptedChildren);
                res.json({ status: "OK" });
                break;
            }

            case "getMessages": {
                const snapshot = await db.ref(`messages/${childId}`).once('value');
                res.json(snapshot.val() || []);
                break;
            }

            case "saveMessages": {
                await db.ref(`messages/${childId}`).set(data);
                res.json({ status: "OK" });
                break;
            }

            case "getReport": {
                const snapshot = await db.ref(`reports/${date}`).once('value');
                const report = snapshot.val();
                
                if (report && report.children) {
                    // Decrypt child names in the report
                    report.children = report.children.map(child => ({
                        ...child,
                        name: decryptChildName(child.name)
                    }));
                }
                
                res.json(report || null);
                break;
            }

            case "saveReport": {
                // Encrypt child names in the report before saving
                const reportToSave = { ...data };
                if (reportToSave.children) {
                    reportToSave.children = reportToSave.children.map(child => ({
                        ...child,
                        name: encryptChildName(child.name)
                    }));
                }
                
                await db.ref(`reports/${date}`).set(reportToSave);
                
                // Update index
                const indexSnapshot = await db.ref('reports_index').once('value');
                let index = indexSnapshot.val() || [];
                if (!Array.isArray(index)) index = [];
                if (!index.includes(date)) {
                    index.push(date);
                    await db.ref('reports_index').set(index);
                }
                
                // Also save to child-specific paths for easier querying
                if (reportToSave.children) {
                    for (const child of reportToSave.children) {
                        await db.ref(`child_reports/${child.id}/${date}`).set(reportToSave);
                        
                        // Update child's report dates index
                        const childDatesSnapshot = await db.ref(`child_report_dates/${child.id}`).once('value');
                        let childDates = childDatesSnapshot.val() || [];
                        if (!Array.isArray(childDates)) childDates = [];
                        if (!childDates.includes(date)) {
                            childDates.push(date);
                            await db.ref(`child_report_dates/${child.id}`).set(childDates);
                        }
                    }
                }
                
                res.json({ status: "OK" });
                break;
            }

            case "getReportIndex": {
                const snapshot = await db.ref('reports_index').once('value');
                res.json(snapshot.val() || []);
                break;
            }

            default:
                res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        logger.error('Storage API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== PII API ==========

exports.piiApi = onRequest({ cors: true, timeoutSeconds: 60 }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        // Verify authentication
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
            return;
        }

        const idToken = authHeader.split('Bearer ')[1];
        let decodedToken;
        
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (error) {
            res.status(401).json({ error: 'Unauthorized: Invalid token' });
            return;
        }

        const { action, childId, childData } = req.body;

        // Check permissions based on action
        const isReader = decodedToken.piiReader === true;
        const isWriter = decodedToken.piiWriter === true;

        if (action === 'listPiiChildren' || action === 'getPiiChild') {
            if (!isReader && !isWriter) {
                res.status(403).json({ error: 'Forbidden: Requires piiReader or piiWriter role' });
                return;
            }
        } else if (action === 'upsertPiiChild') {
            if (!isWriter) {
                res.status(403).json({ error: 'Forbidden: Requires piiWriter role' });
                return;
            }
        }

        // Log audit entry
        const auditLog = {
            timestamp: new Date().toISOString(),
            userId: decodedToken.uid,
            email: decodedToken.email || 'unknown',
            action: action,
            childId: childId || null,
            success: true
        };

        switch (action) {
            case "listPiiChildren": {
                const snapshot = await db.ref('children').once('value');
                const encryptedChildren = snapshot.val() || [];
                
                // Return with decrypted names
                const decryptedChildren = encryptedChildren.map(child => ({
                    ...child,
                    name: decryptChildName(child.name)
                }));
                
                await db.ref('audit_logs/pii_access').push(auditLog);
                res.json(decryptedChildren);
                break;
            }

            case "getPiiChild": {
                if (!childId) {
                    res.status(400).json({ error: 'childId is required' });
                    return;
                }

                const snapshot = await db.ref('children').once('value');
                const encryptedChildren = snapshot.val() || [];
                const child = encryptedChildren.find(c => c.id === childId);
                
                if (!child) {
                    res.status(404).json({ error: 'Child not found' });
                    return;
                }

                const decryptedChild = {
                    ...child,
                    name: decryptChildName(child.name)
                };
                
                await db.ref('audit_logs/pii_access').push(auditLog);
                res.json(decryptedChild);
                break;
            }

            case "upsertPiiChild": {
                if (!childData || !childData.id) {
                    res.status(400).json({ error: 'childData with id is required' });
                    return;
                }

                const snapshot = await db.ref('children').once('value');
                let children = snapshot.val() || [];
                
                // Encrypt the name
                const encryptedChild = {
                    ...childData,
                    name: encryptChildName(childData.name)
                };

                // Find and update or add new
                const index = children.findIndex(c => c.id === childData.id);
                if (index >= 0) {
                    children[index] = encryptedChild;
                } else {
                    children.push(encryptedChild);
                }

                await db.ref('children').set(children);
                await db.ref('audit_logs/pii_access').push(auditLog);
                
                res.json({ status: "OK", child: childData });
                break;
            }

            default:
                res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        logger.error('PII API Error:', error);
        
        // Log failed audit entry
        try {
            await db.ref('audit_logs/pii_access').push({
                timestamp: new Date().toISOString(),
                action: req.body.action,
                success: false,
                error: error.message
            });
        } catch (auditError) {
            logger.error('Failed to log audit entry:', auditError);
        }
        
        res.status(500).json({ error: error.message });
    }
});

// ========== Gemini API (existing) ==========

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
