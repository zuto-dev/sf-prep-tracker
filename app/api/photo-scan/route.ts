import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, prompt } = body;

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // 1. Try Live Gemini Flash Vision API if key exists
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        let base64Data = image;
        let mimeType = 'image/jpeg';

        if (image.startsWith('data:')) {
          const match = image.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            base64Data = match[2];
          }
        }

        const geminiPrompt = `Analyze this image of a food plate.
User description/hint: "${prompt || 'None'}"

Calculate the estimated portion size, ingredients, and macronutrients (calories, protein, carbs, fats).
If the user description is provided, prioritize it for naming and estimating the contents of the plate (e.g., if they say it has Greek yogurt, protein scoop, and fruit, then detect that).

You MUST return a JSON object with this exact structure:
{
  "detected": "Short name of the detected food plate (e.g., Greek Yogurt with Protein)",
  "confidence": 0.95,
  "meal": {
    "name": "Name of the meal",
    "serving": "Portion size description (e.g., 1 bowl)",
    "kcal": 320,
    "p": 30,
    "c": 20,
    "f": 5,
    "ingredients": ["greek yogurt", "protein powder", "mixed fruit"]
  },
  "notes": "Short nutritional notes/coaching advice based on the macros"
}

Return ONLY raw JSON. No markdown formatting, no backticks.`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: geminiPrompt },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });

        if (response.ok) {
          const resData = await response.json();
          const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text.trim());
            return NextResponse.json({
              success: true,
              detected: parsed.detected || parsed.meal?.name || 'Detected Meal',
              confidence: parsed.confidence || 0.90,
              meal: parsed.meal,
              notes: parsed.notes || '',
              message: `I see ${parsed.detected || parsed.meal?.name}. Based on the portions, here's my estimate:`,
              save_meal: parsed.meal,
              api_note: 'Analyzed using Gemini Flash vision API.'
            });
          }
        } else {
          console.warn('Gemini API returned non-200 status, falling back to heuristics:', response.status);
        }
      } catch (geminiError) {
        console.error('Failed to run Gemini analysis, falling back to heuristics:', geminiError);
      }
    }

    // 2. Intelligent Heuristic Fallback Parser based on description
    if (prompt && prompt.trim().length > 0) {
      const lower = prompt.toLowerCase();
      
      let kcal = 0;
      let p = 0;
      let c = 0;
      let f = 0;
      const ingredients: string[] = [];

      // Greek Yogurt / Yogurt
      if (lower.includes('yogurt') || lower.includes('chobani')) {
        let amt = 1;
        if (lower.includes('1/2') || lower.includes('0.5') || lower.includes('half')) amt = 0.5;
        if (lower.includes('greek')) {
          kcal += 100 * amt;
          p += 15 * amt;
          c += 6 * amt;
          f += 0 * amt;
          ingredients.push(`greek yogurt (${amt === 0.5 ? '1/2 cup' : amt + ' cup'})`);
        } else {
          kcal += 120 * amt;
          p += 8 * amt;
          c += 15 * amt;
          f += 2 * amt;
          ingredients.push(`yogurt (${amt === 0.5 ? '1/2 cup' : amt + ' cup'})`);
        }
      }

      // Protein Powder / Scoop
      if (lower.includes('protein') || lower.includes('whey') || lower.includes('powder')) {
        let scoops = 1;
        if (lower.includes('2 scoop') || lower.includes('2scoop')) scoops = 2;
        kcal += 120 * scoops;
        p += 24 * scoops;
        c += 3 * scoops;
        f += 1.5 * scoops;
        ingredients.push(`protein powder (${scoops} scoop${scoops > 1 ? 's' : ''})`);
      }

      // Fruit (dragon fruit, berries, frozen fruit, bananas, etc.)
      if (lower.includes('fruit') || lower.includes('berry') || lower.includes('berries') || lower.includes('strawberry') || lower.includes('banana') || lower.includes('dragon') || lower.includes('mango')) {
        kcal += 80;
        p += 1;
        c += 18;
        f += 0.5;
        ingredients.push('mixed fruit / dragon fruit');
      }

      // Oats / Oatmeal
      if (lower.includes('oats') || lower.includes('oatmeal')) {
        kcal += 150;
        p += 5;
        c += 27;
        f += 2.5;
        ingredients.push('rolled oats');
      }

      // Honey / Sweeteners
      if (lower.includes('honey') || lower.includes('maple')) {
        kcal += 60;
        p += 0;
        c += 17;
        f += 0;
        ingredients.push('honey (1 tbsp)');
      }

      // Peanut Butter / Nuts
      if (lower.includes('peanut butter') || lower.includes('pb') || lower.includes('nut butter') || lower.includes('almond butter')) {
        kcal += 190;
        p += 7;
        c += 6;
        f += 16;
        ingredients.push('peanut butter (2 tbsp)');
      }

      // Sirloin / Beef / Steak
      if (lower.includes('steak') || lower.includes('beef') || lower.includes('sirloin')) {
        kcal += 300;
        p += 32;
        c += 0;
        f += 18;
        ingredients.push('lean steak (6oz)');
      }

      // Chicken / Poultry
      if (lower.includes('chicken') || lower.includes('turkey')) {
        kcal += 200;
        p += 35;
        c += 0;
        f += 5;
        ingredients.push('grilled chicken breast');
      }

      // Whole Eggs
      if (lower.includes('egg') || lower.includes('eggs')) {
        let count = 2;
        if (lower.includes('3 egg') || lower.includes('3egg')) count = 3;
        if (lower.includes('4 egg') || lower.includes('4egg')) count = 4;
        kcal += 70 * count;
        p += 6 * count;
        c += 0.5 * count;
        f += 5 * count;
        ingredients.push(`${count} whole eggs`);
      }

      // Rice / Grains
      if (lower.includes('rice') || lower.includes('jasmine')) {
        kcal += 205;
        p += 4;
        c += 45;
        f += 0.4;
        ingredients.push('cooked white rice');
      }

      // Avocado
      if (lower.includes('avocado')) {
        kcal += 160;
        p += 2;
        c += 8;
        f += 15;
        ingredients.push('avocado (1/2)');
      }

      // Bread / Slices / Toast
      if (lower.includes('bread') || lower.includes('toast') || lower.includes('sourdough')) {
        let slices = 2;
        if (lower.includes('1 slice') || lower.includes('1slice')) slices = 1;
        kcal += 80 * slices;
        p += 3 * slices;
        c += 15 * slices;
        f += 1 * slices;
        ingredients.push(`whole grain toast (${slices} slice${slices > 1 ? 's' : ''})`);
      }

      // Sweet potato / potato
      if (lower.includes('sweet potato') || lower.includes('potato')) {
        kcal += 110;
        p += 2;
        c += 26;
        f += 0.2;
        ingredients.push('baked sweet potato');
      }

      // Greens / Broccoli
      if (lower.includes('broccoli') || lower.includes('spinach') || lower.includes('greens') || lower.includes('veggie')) {
        kcal += 40;
        p += 2;
        c += 6;
        f += 0;
        ingredients.push('mixed green vegetables');
      }

      // Fallback defaults if no keywords match but prompt exists
      if (kcal === 0) {
        kcal = 450;
        p = 25;
        c = 45;
        f = 12;
        ingredients.push('estimated meal components');
      }

      let title = prompt;
      if (title.length > 35) {
        title = title.substring(0, 35) + '...';
      }

      return NextResponse.json({
        success: true,
        detected: prompt,
        confidence: 0.95,
        meal: {
          name: title,
          serving: '1 serving',
          kcal,
          p,
          c,
          f,
          ingredients
        },
        notes: `Estimated based on description: "${prompt}".`,
        api_note: 'Using local heuristic parsing fallback.'
      });
    }

    return NextResponse.json({
      error: 'Live image analysis is unavailable. Add a meal description to use the local estimate instead.',
    }, { status: 503 });

  } catch (error) {
    console.error('Photo analysis error:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}