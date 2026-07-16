import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Enhanced mock implementation that simulates real vision analysis
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, prompt } = body;

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Mock different meal types based on random selection
    const mealTypes = [
      {
        detected: 'grilled chicken salad bowl',
        confidence: 0.92,
        meal: {
          name: 'Grilled Chicken Salad Bowl',
          serving: '1 large bowl',
          kcal: 480,
          p: 42,
          c: 28,
          f: 18,
          ingredients: [
            'grilled chicken breast (6oz)',
            'mixed greens',
            'cherry tomatoes',
            'cucumber',
            'avocado (1/2)',
            'olive oil dressing',
            'feta cheese'
          ]
        },
        notes: 'High protein, moderate carb meal. Good post-workout option.'
      },
      {
        detected: 'steak with sweet potato',
        confidence: 0.94,
        meal: {
          name: 'Steak & Sweet Potato',
          serving: '1 plate',
          kcal: 650,
          p: 48,
          c: 45,
          f: 28,
          ingredients: [
            'lean sirloin steak (8oz)',
            'sweet potato (medium)',
            'steamed broccoli',
            'butter (1 tbsp)'
          ]
        },
        notes: 'Balanced macros, excellent for strength training days.'
      },
      {
        detected: 'protein smoothie bowl',
        confidence: 0.88,
        meal: {
          name: 'Protein Smoothie Bowl',
          serving: '1 bowl (16oz)',
          kcal: 420,
          p: 35,
          c: 48,
          f: 12,
          ingredients: [
            'whey protein (1.5 scoops)',
            'frozen berries',
            'banana (1/2)',
            'granola topping',
            'almond milk',
            'peanut butter (1 tbsp)'
          ]
        },
        notes: 'Great breakfast option. Higher carb for morning energy.'
      },
      {
        detected: 'chicken and rice meal prep',
        confidence: 0.91,
        meal: {
          name: 'Chicken Rice Bowl',
          serving: '1 container',
          kcal: 520,
          p: 40,
          c: 58,
          f: 12,
          ingredients: [
            'chicken breast (5oz)',
            'white rice (1 cup cooked)',
            'green beans',
            'teriyaki sauce'
          ]
        },
        notes: 'Classic meal prep. Lower fat, good for pre-workout.'
      },
      {
        detected: 'egg and avocado toast',
        confidence: 0.89,
        meal: {
          name: 'Egg & Avocado Toast',
          serving: '2 slices',
          kcal: 380,
          p: 18,
          c: 32,
          f: 22,
          ingredients: [
            'whole grain bread (2 slices)',
            'eggs (2)',
            'avocado (1/2)',
            'everything seasoning'
          ]
        },
        notes: 'Moderate protein, good fats. Solid breakfast choice.'
      }
    ];

    // Select a meal type randomly
    const selectedMeal = mealTypes[Math.floor(Math.random() * mealTypes.length)];

    return NextResponse.json({
      success: true,
      ...selectedMeal,
      message: `I see ${selectedMeal.detected}. Based on the portions, here's my estimate:`,
      save_meal: selectedMeal.meal,
      api_note: 'Using mock vision API for demonstration. Real Gemini integration requires valid API key.'
    });

  } catch (error) {
    console.error('Photo analysis error:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}