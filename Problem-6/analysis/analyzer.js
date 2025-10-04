
const { getRiskFactors, riskClassification, getRecommendations } = require('../clients/geminiClient.js');

/**
 * Analyzes survey data by using the Gemini client to extract risk factors.
 * @param {object} surveyData - The structured survey data from OCR.
 * @returns {Promise<string[]>} - A list of identified risk factors.
 */
async function extractFactorsWithAi(surveyData) {
    // The complex logic (prompt, schema, API call) is handled by the client.
    return getRiskFactors(surveyData);
}

/**
 * Generates recommendations by using the Gemini client.
 * @param {string[]} riskFactors - A list of risk factors.
 * @returns {Promise<object>} - An object mapping factors to recommendations.
 */
async function getRecommendationsWithAi(riskFactors) {
    return getRecommendations(riskFactors);
}

async function riskClassificationwithAi(riskFactors){
    return riskClassification(riskFactors);
} 

module.exports = {
    extractFactorsWithAi,
    riskClassificationwithAi,
    getRecommendationsWithAi,
};
