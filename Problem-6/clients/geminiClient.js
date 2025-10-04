
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') }); // Load .env file from the root

const API_KEY = process.env.GOOGLE_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;


async function _callGeminiApi(systemPrompt, userInput, jsonSchema) {

    if (!API_KEY) {
        console.error("ERROR: GOOGLE_API_KEY not found. Please check your .env file.");
        return null;
    }

    const payload = {
        contents: [{ parts: [{ text: userInput }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: jsonSchema,
        },
    };
    const headers = { "Content-Type": "application/json" };

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                if (response.status >= 500) { throw new Error(`Server Error: ${response.status}`); }
                const errorBody = await response.json();
                console.error("API Call Failed (Client Error):", errorBody);
                return null;
            }
            
            const responseData = await response.json();
            const content = responseData.candidates[0].content.parts[0].text;
            return JSON.parse(content);

        } catch (error) {
            if (attempt < 2) {
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`API Error: ${error.message}. Retrying in ${waitTime / 1000}s...`);
                await new Promise(res => setTimeout(res, waitTime));
            } else {
                console.error("API Call Failed after multiple retries:", error);
                return null;
            }
        }
    }
}

/**
 * Calls the AI to get a comprehensive summary of every factor.
 */
async function getRiskFactors(surveyData) {
    console.log("--- [AI Client] Preparing to get lifestyle summary... ---");

    // --- PROMPT ---
    const systemPrompt = "You are a health data summarizer. For each lifestyle habit provided, identify the key factor and describe it in a clear, professional phrase (e.g., 'High sugar intake', 'Lack of physical activity', 'Moderate alcohol consumption'). You must summarize every category provided. Your response MUST be a single, valid JSON object with a single key, 'risk_factors', which is a list of these summary strings.";
    
    const jsonSchema = {
        type: "OBJECT",
        properties: { risk_factors: { type: "ARRAY", items: { type: "STRING" } } },
        required: ["risk_factors"],
    };
    const userInputText = Object.entries(surveyData).map(([key, value]) => `${key}: ${value}`).join('\n');

    const responseJson = await _callGeminiApi(systemPrompt, userInputText, jsonSchema);
    
    if (responseJson) {
        console.log("--- [AI Client] Successfully received factors! ---");
        return responseJson.risk_factors || [];
    }
    console.log("--- [AI Client] Failed to get factors. ---");
    return [];
}


async function getRecommendations(riskFactors) {
    console.log("\n--- [AI Client] Preparing to get recommendations... ---");
 const systemPrompt = "You are an expert health analyst. Your task is to analyze a user's survey responses. Based on the data, you must: " +
        "1. Determine an overall `risk_level` (categorized as 'low', 'medium', or 'high'). " +
        "2. List the key `factors` that contributed to this assessment as an array of short strings. " +
        "3. Provide a simple, actionable `recommendation` for each factor, as an array of strings. The order of recommendations must correspond to the order of factors. " +
        "4. Set a `status` field to 'ok'. " +
        "Your response MUST be a single, valid JSON object with the keys `risk_level`, `factors`, `recommendations`, and `status`.";

    const jsonSchema = {
        type: "OBJECT",
        properties: {
            risk_level: { type: "STRING" },
            factors: { type: "ARRAY", items: { type: "STRING" } },
            recommendations: { type: "ARRAY", items: { type: "STRING" } },
            status: { type: "STRING" }
        },
        required: ["risk_level", "factors", "recommendations", "status"],
    };
    
        const userInputText = `Please generate a report for the following lifestyle factors: ${riskFactors.join(', ')}`;
    
    const responseJson = await _callGeminiApi(systemPrompt, userInputText, jsonSchema);

    if (responseJson) {
        console.log("--- [AI Client] Successfully received comprehensive report! ---");
        return responseJson;
    }

    console.log("--- [AI Client] Failed to get comprehensive report. ---");
    return null;
}


async function riskClassification(riskFactors) {
    console.log("\n--- [AI Client] Preparing for risk classification... ---");

     const systemPrompt = "You are a health risk classification engine. Your task is to analyze a list of lifestyle factors provided by a user. Based on these factors, you must perform the following actions:" +
        "1. Calculate a numerical `score` between 0 and 95, where a higher score indicates greater risk. Assign higher points to more severe factors like smoking." +
        "2. Determine an overall `risk_level` based on the score (categorized as 'low' for scores 0-30, 'medium' for 31-60, and 'high' for 61-95)." +
        "3. Provide a `rationale`, which is a list of the specific lifestyle factors that were the primary contributors to the risk score." +
        "Your response MUST be a single, valid JSON object with the keys `risk_level`, `score`, and `rationale`. Do not add any explanation, markdown, or introductory text.";

   
    // This schema of the 'score' and 'rationale' fields.
    const jsonSchema = {
        type: "OBJECT",
        properties: {
            risk_level: { type: "STRING" },
            score: { type: "NUMBER" },
            rationale: { type: "ARRAY", items: { type: "STRING" } }
        },
        required: ["risk_level", "score", "rationale"],
    };

    const userInputText = `Please generate a report for the following lifestyle factors: ${riskFactors.join(', ')}`;

    const responseJson = await _callGeminiApi(systemPrompt, userInputText, jsonSchema);

    if (responseJson) {
        console.log("--- [AI Client] Successfully received risk classification! ---");
               return responseJson;
    }

    console.log("--- [AI Client] Failed to get risk classification. ---");
    return null;
}


module.exports = { getRiskFactors,riskClassification, getRecommendations };

    