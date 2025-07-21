// js/main.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, onSnapshot, doc, deleteDoc, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { generateRecipes, suggestSubstitutions, suggestWinePairing } from './aiService.js';

// --- DOM Element References ---
const ingredientsInput = document.getElementById('ingredients-input');
const generateBtn = document.getElementById('generate-btn');
const loader = document.getElementById('loader');
const errorDisplay = document.getElementById('error-display');
const authStatus = document.getElementById('auth-status');
// ... (rest of the DOM element references are the same)
const generatedRecipesSection = document.getElementById('generated-recipes-section');
const generatedRecipesContainer = document.getElementById('generated-recipes-container');
const savedRecipesSection = document.getElementById('saved-recipes-section');
const savedRecipesContainer = document.getElementById('saved-recipes-container');
const subModal = document.getElementById('substitution-modal');
const wineModal = document.getElementById('wine-modal');
const closeSubModalBtn = document.getElementById('close-sub-modal');
const closeWineModalBtn = document.getElementById('close-wine-modal');
const ingredientSelect = document.getElementById('ingredient-select');
const getSubsBtn = document.getElementById('get-subs-btn');
const subsResult = document.getElementById('substitutions-result');
const wineResult = document.getElementById('wine-pairing-result');

// --- Predefined Placeholder Images ---
const placeholderImages = [
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=1887&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1981&auto=format&fit=crop',
    // ... (rest of the placeholder images are the same)
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?q=80&w=1980&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1484723051597-63b8a9c88697?q=80&w=1887&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?q=80&w=1910&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1529042410759-befb1204b468?q=80&w=1887&auto=format&fit=crop'
];
let imageIndex = 0;

// --- App State ---
let db, auth, userId, isAuthReady = false;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';


// --- Event Handlers (Orchestrators) ---
async function handleGenerateRecipes() {
    console.log('Generate Recipes button clicked');
    const ingredients = ingredientsInput.value.trim();
    if (!ingredients) {
        // Do nothing if no ingredients entered
        return;
    }
    setLoading(true);
    generatedRecipesSection.style.display = 'none';
    generatedRecipesContainer.innerHTML = '';
    generateBtn.disabled = true;

    try {
        const recipes = await generateRecipes(ingredients);
        if (recipes && recipes.length > 0) {
            const recipesWithImages = recipes.map(recipe => {
                imageIndex = (imageIndex + 1) % placeholderImages.length;
                return { ...recipe, imageUrl: placeholderImages[imageIndex] };
            });
            displayGeneratedRecipes(recipesWithImages);
        } else {
            // Do nothing if no recipes found
        }
    } catch (err) {
        // Silently ignore errors
    } finally {
        setLoading(false);
        generateBtn.disabled = false;
    }
// Attach event listener for Generate New Recipes button
document.addEventListener('DOMContentLoaded', () => {
    const generateNewBtn = document.getElementById('generate-new-btn');
    if (generateNewBtn) {
        generateNewBtn.addEventListener('click', () => {
            ingredientsInput.value = '';
            generatedRecipesSection.style.display = 'none';
            generatedRecipesContainer.innerHTML = '';
            generateBtn.disabled = false;
            ingredientsInput.focus();
        });
    }
});
}

async function handleSuggestSubstitutions() {
    const selectedIngredient = ingredientSelect.value;
    if (!selectedIngredient) return;

    subsResult.innerHTML = `<div class="text-center text-sm text-gray-500">Finding substitutes...</div>`;
    try {
        const suggestionsHtml = await suggestSubstitutions(selectedIngredient);
        subsResult.innerHTML = suggestionsHtml;
    } catch (err) {
        subsResult.innerHTML = `<div class="text-red-500">Could not fetch suggestions.</div>`;
        console.error(err);
    }
}

async function handleSuggestWinePairing(recipeName, ingredients) {
    wineResult.innerHTML = `<div class="text-center text-sm text-gray-500">Consulting the sommelier...</div>`;
    wineModal.style.display = 'flex';
    
    try {
        const pairings = await suggestWinePairing(recipeName, ingredients);
        wineResult.innerHTML = `
            <div class="border-b pb-4">
                <h4 class="font-bold text-lg text-red-800">Red Wine Pairing</h4>
                <p class="font-semibold">${pairings.red_wine.name}</p>
                <p class="text-sm text-stone-600">${pairings.red_wine.reason}</p>
            </div>
            <div>
                <h4 class="font-bold text-lg text-blue-800">White Wine Pairing</h4>
                <p class="font-semibold">${pairings.white_wine.name}</p>
                <p class="text-sm text-stone-600">${pairings.white_wine.reason}</p>
            </div>
        `;
    } catch (err) {
        wineResult.innerHTML = `<div class="text-red-500">Could not fetch pairings.</div>`;
        console.error(err);
    }
}

// --- Firebase Initialization and Actions ---
// NOTE: This entire section (initializeFirebase, listenForSavedRecipes, saveRecipe, deleteRecipe)
// remains IDENTICAL to your previous version.
function initializeFirebase() {
    try {
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        if (Object.keys(firebaseConfig).length === 0) {
            showError("Application is not configured correctly.");
            return;
        }
        
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        setLogLevel('debug');
        
        authStatus.style.display = 'block';
        generateBtn.disabled = true;

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
            } else {
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (authError) {
                    console.error("Error during sign-in:", authError);
                    showError("Could not authenticate the user.");
                }
            }
            
            if (userId) {
                isAuthReady = true;
                authStatus.style.display = 'none';
                generateBtn.disabled = false;
                listenForSavedRecipes();
            }
        });

    } catch (e) {
        console.error("Error initializing Firebase:", e);
        showError("Failed to initialize the application.");
    }
}

function listenForSavedRecipes() {
    if (!db || !userId) return;
    const recipesCollectionPath = `artifacts/${appId}/users/${userId}/recipes`;
    const q = query(collection(db, recipesCollectionPath));

    onSnapshot(q, (querySnapshot) => {
        const recipesData = [];
        querySnapshot.forEach((doc) => {
            recipesData.push({ id: doc.id, ...doc.data() });
        });
        displaySavedRecipes(recipesData);
    }, (err) => {
        console.error("Error fetching saved recipes:", err);
        showError("Could not load your saved recipes.");
    });
}

async function saveRecipe(recipe) {
    if (!db || !userId) {
        showError("Cannot save recipe. Database not connected.");
        return;
    }
    try {
        const recipesCollectionPath = `artifacts/${appId}/users/${userId}/recipes`;
        await addDoc(collection(db, recipesCollectionPath), recipe);
    } catch (err) {
        console.error("Error saving recipe:", err);
        showError("Failed to save the recipe.");
    }
}

async function deleteRecipe(recipeId) {
    if (!db || !userId) {
        showError("Cannot delete recipe. Database not connected.");
        return;
    }
    try {
        const recipeDocPath = `artifacts/${appId}/users/${userId}/recipes/${recipeId}`;
        await deleteDoc(doc(db, recipeDocPath));
    } catch (err) {
        console.error("Error deleting recipe:", err);
        showError("Failed to delete the recipe.");
    }
}


// --- UI Rendering and Helpers ---
// NOTE: This entire section (createGeneratedRecipeItem, createSavedRecipeCard, displayGeneratedRecipes, etc.)
// remains IDENTICAL to your previous version.
function createGeneratedRecipeItem(recipe) {
    const item = document.createElement('div');
    item.className = "bg-white rounded-xl shadow-strong p-6 md:p-8";

    item.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <h3 class="text-3xl font-bold text-stone-800 playfair-display">${recipe.name}</h3>
            <button class="save-btn inline-flex items-center px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg shadow-md transition-colors duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                Save
            </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="md:col-span-1">
                <div class="flex justify-between items-center mb-2">
                     <h4 class="text-xl font-semibold text-stone-700 playfair-display">Ingredients</h4>
                     <button class="sub-btn text-xs text-teal-600 hover:underline">✨ Find Substitute</button>
                </div>
                <ul class="list-disc list-inside text-stone-600 space-y-1">
                    ${recipe.ingredients.map(ing => `<li>${ing}</li>`).join('')}
                </ul>
            </div>
            <div class="md:col-span-2">
                 <h4 class="text-xl font-semibold text-stone-700 mb-2 playfair-display">Instructions</h4>
                <ol class="list-decimal list-inside text-stone-600 space-y-2 prose">
                    ${recipe.instructions.map(step => `<li>${step}</li>`).join('')}
                </ol>
            </div>
        </div>
        <div class="text-center mt-6 pt-4 border-t">
            <button class="wine-btn inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-md transition-colors duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M8 22h8"></path><path d="M7 10h10"></path><path d="M12 10v12"></path><path d="M12 4.37c2.32.94 4.37 3 4.37 5.63v0c0 2.63-2.05 4.68-4.37 5.63v0c-2.32-.95-4.37-3-4.37-5.63v0c0-2.63 2.05-4.68 4.37-5.63z"></path></svg>
                ✨ Suggest Wine Pairing
            </button>
        </div>
    `;

    item.querySelector('.save-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        e.currentTarget.innerHTML = 'Saved!';
        e.currentTarget.disabled = true;
        saveRecipe(recipe);
    });
    
    item.querySelector('.sub-btn').addEventListener('click', () => {
        ingredientSelect.innerHTML = recipe.ingredients.map(ing => `<option value="${ing}">${ing}</option>`).join('');
        subsResult.innerHTML = '';
        subModal.style.display = 'flex';
    });

    item.querySelector('.wine-btn').addEventListener('click', () => {
        handleSuggestWinePairing(recipe.name, recipe.ingredients);
    });

    return item;
}

function createSavedRecipeCard(recipe) {
    const card = document.createElement('div');
    card.className = "bg-white rounded-xl overflow-hidden shadow-strong shadow-strong-hover transition-all duration-300 flex flex-col";
    
    const deleteButtonHtml = `<button data-id="${recipe.id}" class="delete-btn inline-flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg shadow-md transition-colors duration-300">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        Delete
    </button>`;

    card.innerHTML = `
        <div class="aspect-w-4 aspect-h-3">
            <img src="${recipe.imageUrl}" alt="${recipe.name}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='https://placehold.co/600x400/cccccc/ffffff?text=Image+Not+Found';">
        </div>
        <div class="p-6 flex-grow flex flex-col">
            <h3 class="text-2xl font-bold text-stone-800 mb-3 playfair-display flex-grow">${recipe.name}</h3>
            <div class="mt-auto text-right">
                ${deleteButtonHtml}
            </div>
        </div>
    `;
    
    card.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteRecipe(e.currentTarget.dataset.id);
    });

    return card;
}

function displayGeneratedRecipes(recipes) {
    generatedRecipesContainer.innerHTML = '';
    if (recipes.length > 0) {
        recipes.forEach(recipe => {
            const item = createGeneratedRecipeItem(recipe);
            generatedRecipesContainer.appendChild(item);
        });
        generatedRecipesSection.style.display = 'block';
        generatedRecipesSection.scrollIntoView({ behavior: 'smooth' });
    }
}

function displaySavedRecipes(recipes) {
    savedRecipesContainer.innerHTML = '';
    if (recipes.length > 0) {
        recipes.forEach(recipe => {
            const card = createSavedRecipeCard(recipe);
            savedRecipesContainer.appendChild(card);
        });
        savedRecipesSection.style.display = 'block';
    } else {
        savedRecipesSection.style.display = 'none';
    }
}

function setLoading(isLoading) {
    loader.style.display = isLoading ? 'block' : 'none';
    generateBtn.disabled = isLoading || !isAuthReady;
    if (isLoading) errorDisplay.style.display = 'none';
}

function showError(message) {
    console.warn("Error:", message); // Log the error for debugging
    errorDisplay.style.display = 'none'; // Ensure the error display is hidden
}


// --- Event Listeners ---
generateBtn.addEventListener('click', handleGenerateRecipes);
closeSubModalBtn.addEventListener('click', () => subModal.style.display = 'none');
closeWineModalBtn.addEventListener('click', () => wineModal.style.display = 'none');
getSubsBtn.addEventListener('click', handleSuggestSubstitutions);


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', initializeFirebase);