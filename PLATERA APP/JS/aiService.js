// js/aiService.js

/**
 * The core helper function to call the Gemini API.
 * @param {string} prompt The user prompt to send to the AI.
 * @param {object | null} generationConfig The configuration for the API call, e.g., for JSON output.
 * @returns {Promise<string>} The text response from the API.
 */
async function callGemini(prompt, generationConfig = null) {
    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }]
    };
    
    if (generationConfig) {
        payload.generationConfig = generationConfig;
    }

    // IMPORTANT: Never expose your API key in client-side code in a real production app.
    // This should be handled by a backend server.
    const apiKey = "AIzaSyC1YnEkfXgutNHssXOWO1BqParPdkOGQ-M"; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API request failed: ${errorBody}`);
    }

    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text;
}

/**
 * Generates recipe ideas based on a list of ingredients.
 * @param {string} ingredientsText The ingredients provided by the user.
 * @returns {Promise<Array>} A promise that resolves to an array of recipe objects.
 */
export async function generateRecipes(ingredientsText) {
    const prompt = `Based on the following ingredients, generate 3 diverse recipe ideas. Provide a creative, appealing name for each recipe, a list of the ingredients required, and step-by-step instructions. Ingredients: ${ingredientsText}`;
    const generationConfig = {
        responseMimeType: "application/json",
        responseSchema: {
            type: "OBJECT",
            properties: {
                recipes: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            name: { type: "STRING" },
                            ingredients: { type: "ARRAY", items: { type: "STRING" } },
                            instructions: { type: "ARRAY", items: { type: "STRING" } }
                        },
                        required: ["name", "ingredients", "instructions"]
                    }
                }
            }
        }
    };
    
    const jsonText = await callGemini(prompt, generationConfig);
    const parsedJson = JSON.parse(jsonText);
    return parsedJson.recipes || [];
}

/**
 * Suggests substitutes for a given ingredient.
 * @param {string} ingredient The ingredient to find substitutes for.
 * @returns {Promise<string>} A promise that resolves to a formatted text of suggestions.
 */
export async function suggestSubstitutions(ingredient) {
    const prompt = `What are some good substitutes for ${ingredient} in a recipe? List 3-4 options with brief explanations.`;
    const resultText = await callGemini(prompt);
    return resultText.replace(/\n/g, '<br>'); // Simple formatting
}

/**
 * Suggests wine pairings for a given recipe.
 * @param {string} recipeName The name of the dish.
 * @param {Array<string>} ingredients The list of main ingredients.
 * @returns {Promise<object>} A promise that resolves to an object with red and white wine pairings.
 */
export async function suggestWinePairing(recipeName, ingredients) {
    const prompt = `I am making a dish called "${recipeName}" with these main ingredients: ${ingredients.join(', ')}. Suggest one red wine and one white wine that would pair well with it. For each, give the wine name and a brief, one-sentence explanation for why it pairs well.`;
    const generationConfig = {
        responseMimeType: "application/json",
        responseSchema: {
            type: "OBJECT",
            properties: {
                red_wine: { 
                    type: "OBJECT", 
                    properties: { name: { type: "STRING" }, reason: { type: "STRING" } }
                },
                white_wine: { 
                    type: "OBJECT", 
                    properties: { name: { type: "STRING" }, reason: { type: "STRING" } }
                }
            }
        }
    };

    const jsonText = await callGemini(prompt, generationConfig);
    return JSON.parse(jsonText);
}