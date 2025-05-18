// GeminiService.js - Service for handling Gemini API calls

// Base URL for the Gemini API - Updated to use the latest supported version and model
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent";

/**
 * Send a message to the Gemini API and get a response
 * @param {string} apiKey - Your Gemini API key
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} systemContext - Optional system context/instructions
 * @returns {Promise<string>} - The assistant response
 */
export const sendMessageToGemini = async (apiKey, userMessage, systemContext = null) => {
  try {
    if (!apiKey) {
      throw new Error("API key is required");
    }

    // Format the request payload
    const payload = {
      contents: []
    };

    // Add system context if provided
    if (systemContext) {
      payload.contents.push({
        role: "user",
        parts: [{ text: `${systemContext}\n\nUsuario: ${userMessage}` }]
      });
    } else {
      payload.contents.push({
        role: "user",
        parts: [{ text: userMessage }]
      });
    }

    console.log("Sending to Gemini API:", payload);

    // Make the API request
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    console.log("Gemini API response:", data);

    if (!response.ok) {
      console.error("Gemini API error:", data);
      throw new Error(`Gemini API error: ${data.error?.message || JSON.stringify(data.error)}`);
    }

    // Extract the response text from the Gemini API response
    if (data.candidates && data.candidates[0]?.content?.parts && data.candidates[0].content.parts[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Unexpected response format from Gemini API");
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
};

export default {
  sendMessageToGemini
}; 