// server.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { processImageToData } = require('./ocr_processing/processor.js');
const { extractFactorsWithAi, riskClassificationwithAi, getRecommendationsWithAi } = require('./analysis/analyzer.js');
const dotenv = require('dotenv');
dotenv.config();


const app = express();
const port = 3000;

// --- Multer Configuration for File Uploads ---
// This sets up a temporary storage location for uploaded images.
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: uploadDir });

app.use(express.json());

// --- API Endpoint ---
// Listens for POST requests at http://localhost:3000/analyze
app.post('/analyze', upload.single('surveyImage'), async (req, res) => {
    console.log('Received request for /analyze');
    
    if (!req.file && !req.body) {
        return res.status(400).json({ error: 'No image file uploaded. Please use the "surveyImage" field.' });
    }

    
    let imagePath = req.file ? req.file.path : null;
    let surveyData;
    try {
        // --- STAGE 1: OCR ---
       if(imagePath)
         surveyData  =   await processImageToData(imagePath);
        else 
            surveyData = req.body;
// console.log(surveyData);
      let MissingFieldsCount =0;
      let MissingFields = [];
      for (const [key, value] of Object.entries(surveyData)) {
        if (value === null || value === undefined || value.toString().trim() === '') {
            MissingFieldsCount++;
            MissingFields.push(key);
        }
      }
      if(MissingFieldsCount){
        console.log("The missing fields are:")
               for(let field of MissingFields){
                     console.log(`- ${field}`);
               }
     }
    if(MissingFieldsCount>3){
        console.log("Warning: More than 3 expected fields are missing from the OCR text. The extracted data may be incomplete or inaccurate.");
         res.json(400, { error: 'OCR text is missing multiple expected fields.' });
         return {};
    } 

        if (!surveyData || Object.keys(surveyData).length === 0) {
            return res.status(500).json({ error: 'OCR failed to extract data from the image.' });
        }
         
        
        
        // --- STAGE 2: AI Factor Extraction ---
        const riskFactors = await extractFactorsWithAi(surveyData);
        if (!riskFactors || riskFactors.length === 0) {
            return res.status(500).json({ error: 'AI analysis did not return any risk factors.' });
        }


        //--- RISK CLASSIFICATION ---
        const riskClassificationFactors = await riskClassificationwithAi(riskFactors);
        if(!riskClassificationFactors || riskClassificationFactors.length === 0){
            return res.status(500).json({ error: 'AI analysis did not return any risk classification.' });
        }

        // --- STAGE 3: AI Recommendation Generation ---
        const recommendations = await getRecommendationsWithAi(riskFactors);
        console.log(recommendations);
        if (!recommendations || Object.keys(recommendations).length === 0) {
            return res.status(500).json({ error: 'AI analysis did not return any recommendations.' });
        }

        // --- FINAL REPORT ---
        const finalReport = {
            analyzedData: surveyData,
            identifiedFactors: riskFactors,
            factorsOfrisk: riskClassificationFactors, 
            personalizedRecommendations: recommendations
        };

        res.status(200).json(finalReport);

    } catch (error) {
        console.error("An error occurred in the /analyze endpoint:", error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    } finally {
        // Cleanup: Delete the temporary uploaded file
        if(imagePath){
        fs.unlink(imagePath, (err) => {
            if (err) console.error("Error deleting temp file:", err);
        });
    }
    }
});


app.listen(port, () => {
    console.log(`✅ Health profiler server is running at http://localhost:${port}`);
    console.log('To test, send a POST request with a file upload to http://localhost:3000/analyze');
});

    
