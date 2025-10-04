
const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const path = require('path');

/**
 * A helper function to clean an image for better OCR results.
 * @param {string} imagePath - The path to the image file.
 * @returns {Promise<Buffer>} - A buffer of the processed image.
 */
async function _preprocessForOcr(imagePath) {
    const image = await Jimp.read(imagePath);
    
    // Upscale, convert to grayscale, and apply contrast
    image
        .scale(2, Jimp.RESIZE_BICUBIC)
        .greyscale()
        .contrast(0.5);
    
    return image.getBufferAsync(Jimp.MIME_PNG);
}

/**
 * A helper function to parse raw text into a structured object.
 * @param {string} text - The raw text from Tesseract.
 * @returns {object} - The structured survey data.
 */
function _parseTextToObject(text) {
    const parsedData = {};
    const patterns = {
        age: /(?:age|years)\s*:\s*(\d+)/i,
        smoker: /smoker\s*:\s*(yes|no|true|false)/i,
        exercise: /exercise\s*:\s*(.*)/i,
        alcohol: /alcohol\s*:\s*(.*)/i,
        diet: /diet\s*:\s*(.*)/i,
        sleep: /sleep\s*:\s*(.*)/i,
    };
     

 for (const [key, pattern] of Object.entries(patterns)) {
        const match = text.match(pattern);

        // Check if the field was found AND has a non-empty value
        if (match && match[1] && match[1].trim().length > 0) {
            const value = match[1].trim().toLowerCase();
            if (key === 'age') {
                parsedData[key] = parseInt(value, 10);
            } else if (key === 'smoker') {
                parsedData[key] = (value === 'yes' || value === 'true');
            } else {
                parsedData[key] = value;
            }
        } 
    }
     
    return parsedData;
}

/**
 * Main function for this module. Takes an image path and returns a
 * structured object of the survey answers.
 * @param {string} imagePath - The full path to the image.
 * @returns {Promise<object>} - The structured survey data.
 */
async function processImageToData(imagePath) {
    console.log(`-> Starting OCR process for: ${path.basename(imagePath)}`);
    
    try {
        const processedImageBuffer = await _preprocessForOcr(imagePath);

        const { data: { text } } = await Tesseract.recognize(
            processedImageBuffer,
            'eng',
            { logger: m => { if(m.status === 'recognizing text') { process.stdout.write(`\r   Recognizing... ${Math.round(m.progress * 100)}%`); } } }
        );
        process.stdout.write('\r   Recognition complete.              \n'); // Clear the line

        if (!text || !text.trim()) {
            console.log("Warning: OCR did not detect any text.");
            return {};
        }

        console.log("-> OCR successful. Parsing text...");
        const structuredData = _parseTextToObject(text);
        console.log("-> Parsing complete.");
        return structuredData;

    } catch (error) {
        console.error("An unexpected error occurred during OCR processing:", error);
        return {};
    }
}

module.exports = { processImageToData };
