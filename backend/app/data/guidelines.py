"""Static Indian-nutrition guideline content shown alongside every generated
plan. There's no admin UI to edit these yet, so they live in code rather than
the database — move them to a table later if that becomes a requirement.
"""

DIET_GUIDELINES = [
    {
        "title": "Detox Drink 1",
        "items": [
            "Use weekly 3-4 times on an empty stomach.",
            "Moringa powder.",
            "1 tbsp dried ginger powder for digestion and fat burn.",
            "1/2 tbsp cinnamon powder for blood sugar control.",
            "1 tbsp flaxseed powder for fiber and gut cleansing.",
            "1 tbsp fennel seed powder to reduce bloating.",
            "1/2 tsp turmeric for anti-inflammatory support.",
            "1/2 tsp black pepper to support absorption.",
        ],
    },
    {
        "title": "Detox Drink 2",
        "items": [
            "1/2 carrot.",
            "1/2 beetroot.",
            "1 amla.",
            "Orange, optional.",
            "1/2 lemon.",
            "1/2 cucumber.",
            "Few mint leaves.",
            "Soaked fenugreek seeds.",
            "Blend everything into juice and strain if preferred.",
        ],
    },
    {
        "title": "Daily Notes",
        "items": [
            "Add a little ghee to steamed carrot for better nutrient absorption.",
            "Add turmeric and black pepper to milk, then boil it for better benefits.",
            "Finish dinner before 7:30pm.",
            "Eat a few nuts or seeds before fruit to reduce sudden sugar spikes.",
            "Drink 2.5-3 litres of water between 6am and 6pm.",
            "Start with 5k steps every day and slowly increase toward 10k.",
            "Walk for 10 minutes after meals.",
            "Avoid lying down immediately after meals.",
            "Manage stress because it is important for bloating.",
        ],
    },
    {
        "title": "Training",
        "items": [
            "Strength training 3-4 days per week is a must.",
            "Pre-workout, light: banana or toast with peanut butter.",
            "Post-workout: protein plus carbs for recovery and reduced bloating.",
            "Pre and post workout nutrition matters.",
        ],
    },
    {"title": "Optional Add On", "items": ["Milk, around 100 kcal."]},
    {
        "title": "Limit And Test Tolerance",
        "items": [
            "Excess onion, cabbage, and cauliflower.",
            "Artificial sweeteners.",
            "Protein overloading in one meal.",
            "Protein bars if they cause bloating.",
        ],
    },
    {
        "title": "Protein And Hydration",
        "items": [
            "Spread protein across meals.",
            "Avoid heavy protein in one sitting.",
            "20-30g protein per meal works best.",
            "Drink 2.5-3 litres of water.",
            "Avoid gulping water during meals.",
        ],
    },
    {
        "title": "Gut Friendly Additions",
        "items": ["Curd or buttermilk.", "Ginger or jeera water.", "Papaya and banana."],
    },
    {
        "title": "Detox Water Ideas",
        "items": [
            "Lemon, mint, and cucumber.",
            "Jeera water soaked overnight.",
            "Ginger and lemon water.",
            "Fennel water.",
            "Apple cider vinegar, 1 tsp in water, optional.",
        ],
    },
    {
        "title": "Lifestyle Tweaks",
        "items": [
            "Walk 10 minutes after meals.",
            "Avoid lying down immediately after meals.",
            "Manage stress because it is important for bloating.",
        ],
    },
    {
        "title": "Common Mistakes",
        "items": [
            "Too much protein can cause bloating.",
            "Artificial sweeteners and protein bars may trigger bloating.",
            "Eating too fast.",
            "Ignoring gut health.",
        ],
    },
]
