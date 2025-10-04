const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { extractDataFromImage } = require('./OCR_PROCESSOR/ocr_processor.js');
// ⬇️ UPDATED this line to import directly from your API file
const { identifyRiskFactors, classifyOverallRisk, generatePersonalizedRecommendations } = require('./API/geminiAPI.js');
const dotenv = require('dotenv');
dotenv.config();


const app = express();
const port = 3000;

// --- Multer Configuration for File Uploads ---
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: uploadDir });

app.use(express.json());

// --- Helper Functions ---

/**
 * Validates the extracted survey data for completeness.
 * @param {object} surveyData - The data from OCR or request body.
 * @returns {{error: string, status: number}|null} An error object if invalid, otherwise null.
 */
function validateSurveyData(surveyData) {
    if (!surveyData || Object.keys(surveyData).length === 0) {
        return { error: 'OCR failed to extract data from the image.', status: 500 };
    }

    const missingFields = Object.entries(surveyData)
        .filter(([key, value]) => value === null || value === undefined || value.toString().trim() === '')
        .map(([key]) => key);

    if (missingFields.length > 0) {
        console.log("The missing fields are:", missingFields.join(', '));
    }

    if (missingFields.length > 3) {
        console.log("Warning: More than 3 expected fields are missing from the OCR text.");
        return { error: 'OCR text is missing multiple expected fields.', status: 400 };
    }

    return null; // Indicates validation passed
}

/**
 * Compiles the final report from all analysis stages.
 * @returns {object} The final structured report.
 */
function buildFinalReport(surveyData, riskFactors, riskClassification, recommendations) {
    return {
        analyzedData: surveyData,
        identifiedFactors: riskFactors,
        factorsOfrisk: riskClassification,
        personalizedRecommendations: recommendations
    };
}


// --- API Endpoint ---
app.post('/analyze', upload.single('surveyImage'), async (req, res) => {
    console.log('Received request for /analyze');
    
    if (!req.file && !req.body) {
        return res.status(400).json({ error: 'No image file or request body provided.' });
    }

    const imagePath = req.file ? req.file.path : null;
    
    try {
        // Determine data source (image upload or direct JSON)
        const surveyData = imagePath 
            ? await extractDataFromImage(imagePath) 
            : req.body;

        // --- STAGE 1: VALIDATION ---
        const validationResult = validateSurveyData(surveyData);
        if (validationResult) {
            return res.status(validationResult.status).json({ error: validationResult.error });
        }
        
        // --- STAGE 2: AI ANALYSIS ---
        const riskFactors = await identifyRiskFactors(surveyData);
        if (!riskFactors || riskFactors.length === 0) {
            return res.status(500).json({ error: 'AI analysis did not return any risk factors.' });
        }

        const riskClassification = await classifyOverallRisk(riskFactors);
        if (!riskClassification || Object.keys(riskClassification).length === 0) {
            return res.status(500).json({ error: 'AI analysis did not return any risk classification.' });
        }

        const recommendations = await generatePersonalizedRecommendations(riskFactors);
        if (!recommendations || Object.keys(recommendations).length === 0) {
            return res.status(500).json({ error: 'AI analysis did not return any recommendations.' });
        }

        // --- STAGE 3: COMPILE AND RESPOND ---
        const finalReport = buildFinalReport(surveyData, riskFactors, riskClassification, recommendations);
        res.status(200).json(finalReport);

    } catch (error) {
        console.error("An error occurred in the /analyze endpoint:", error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    } finally {
        // Cleanup: Delete the temporary uploaded file
        if (imagePath) {
            fs.unlink(imagePath, (err) => {
                if (err) console.error("Error deleting temp file:", err);
            });
        }
    }
});


app.listen(port, () => {
    console.log(`✅ Health profiler server is running at http://localhost:${port}`);
    console.log('To test, send a POST request to http://localhost:3000/analyze');
});