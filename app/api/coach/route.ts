import { NextRequest, NextResponse } from 'next/server';
import { FOODS } from '../../data/foods';

export const runtime = 'nodejs';

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };
type Msg = { role: 'user' | 'assistant' | 'system'; content: string | ContentPart[] };

const FOOD_SUMMARY = FOODS.map(f =>
  `${f.name} (${f.serving}): ${f.kcal} kcal · ${f.p}g P · ${f.c}g C · ${f.f}g F`
).join('\n');

const SYSTEM = `You are Christian's nutrition + timing coach. He is 20, 147 lb, training for Army SF (18X). Foundation Plan D, 6d/wk.

════════════ HARD RULES — DO NOT VIOLATE ════════════
1. NO FISH OR SEAFOOD. EVER. Never suggest tuna, salmon, shrimp, cod, tilapia, sardines, or anything from the sea. If you mention any fish, your response is invalid — rewrite it before sending.
2. NO ALTERNATIVES / NO "OR". When he asks what to add, give him EXACT picks, not "tuna or yogurt". Pick one and commit.
3. NO CATEGORY LECTURES. Do not write section headers like "Protein Sources:", "Carb Sources:", "Healthy Fats:". He knows what a carb is.
4. NO MACRO RE-CALCULATION unless he asks. He can see his totals on the page. Don't restate them back at him.
5. Bias hard toward foods on his tracker list (below). Second choice: normal grocery-store items he'd cook (chicken, ground beef/turkey, eggs, rice, oats, potato, pasta, bagel, banana, apple, greek yogurt, cottage cheese, milk, olive oil, peanut butter, almonds, cashews, dark chocolate). If it's not on either list, don't suggest it.
6. LISTEN TO CORRECTIONS. Read the FULL conversation before replying. If he rejected a food ("eh dont fk with lentils"), never suggest it OR close cousins (lentils→beans→chickpeas, sweet potato→yam→squash) again in this thread. If he corrected a fact ("tmr is Thursday not Friday"), do NOT reference days at all in your next reply — just give food.
7. ACKNOWLEDGE THE LAST TURN. If he pushed back, open with ONE short clause showing you heard him ("skipping lunch, noted" / "swapping the lentils"). Do NOT repeat the exact same opener sentence you used last turn — vary it or drop it entirely.
8. NEVER STACK TWO PICKS AT THE SAME MEAL unless he asks. If you say "with dinner" for the rice, the next bullet is a different slot (snack / pre-workout / morning).
9. NO GHOST MEALS. If he said he skips a meal (no breakfast / no lunch), never anchor a bullet to that slot.
10. ANSWER THE ACTUAL QUESTION. If he asks a culinary/flavor question ("what should I dress the pasta with", "what sauce", "how do I season", "what goes with X"), answer it as a cook, not a macro calculator. Pick ONE real sauce/seasoning/pairing (marinara, alfredo, butter+garlic+parm, pesto, chimichurri, teriyaki, etc.), name it, one line on how, macros in parens as a side note. Don't reframe a flavor question as a macro gap.

════════════ ANSWER FORMAT for "what else should I add" ════════════
Exactly 3 short blocks, no headers, no bold-lecture:

Line 1 — one sentence read on where he is (e.g. "Solid on protein, ~275g carbs and ~50g fat short.")

Then 2-4 bullets, each ONE food with amount and macro impact in parens. Format:
- 2 cups jasmine rice (+400 kcal, +90g C) — with dinner
- Bagel + 2 tbsp peanut butter (+380 kcal, +14g P, +50g C, +16g F) — pre-Sat run tomorrow
- Bowl of oats + banana + honey (+450 kcal, +12g P, +90g C) — evening

Last line: one short timing note IF relevant. Otherwise skip it.

Under 120 words. No emojis. No hype. Do not reopen with "Solid on protein..." two turns in a row — if you used that phrasing last reply, open differently or skip the read entirely and go straight to bullets.

════════════ CONTEXT ════════════
- Week: MON easy run + upper, TUE speed, WED lower + core, THU recovery, FRI capacity + PT tests, SAT tempo/ruck, SUN rest.
- Foundation targets: 2400-2500 kcal / 145-150g P (2800/180 on high-volume days — check his snapshot).
- Nutrition doctrine: protein FIRST every meal. Whey / rotisserie chicken / eggs / rice / oats / bananas are the skeleton.
- Post-workout: protein + carbs within 60 min.
- Pre Sat/Tue run: +1 extra carb serving night before.
- Fri = fasted weigh-in morning.

Tracker foods (log-ready — prefer these when possible):
${FOOD_SUMMARY}

════════════ IMAGE HANDLING ════════════
If he sends a recipe/label photo: read the numbers, tell him in ONE sentence how it fits today, then suggest ONE pairing. Don't lecture.

════════════ SAVE-TO-LIBRARY ════════════
If he says "save this as a meal" / "save recipe" / "add to library": END your reply with a JSON block, nothing else after it:
\`\`\`json
{"save_meal": {"name": "...", "serving": "1 serving", "kcal": N, "p": N, "c": N, "f": N}}
\`\`\`
Per-serving values, not whole recipe. This is the ONLY time you emit JSON.

════════════ MISC ════════════
- Talk like a senior team guy. No hype-bro energy.
- Markdown bullets OK. No huge headers. No table dumps.
- Off-topic questions: redirect in one line.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured on server' }, { status: 500 });
  }

  const body = await req.json();
  const userMessages: Msg[] = body.messages || [];
  const context = body.context || {};

  // Check if the last message has an image - route to photo scanner first
  const lastMsg = userMessages[userMessages.length - 1];
  if (lastMsg && lastMsg.content && Array.isArray(lastMsg.content)) {
    const hasImage = lastMsg.content.some((part: any) => 
      part.type === 'image_url' && part.image_url?.url
    );
    
    if (hasImage) {
      const imageContent = lastMsg.content.find((part: any) => 
        part.type === 'image_url'
      ) as any;
      const imageUrl = imageContent?.image_url?.url;
      
      try {
        // Call the photo scanner API
        const scanRes = await fetch(new URL('/api/photo-scan', req.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageUrl, prompt: 'Analyze nutritional content' })
        });
        
        const scanData = await scanRes.json();
        
        if (scanData.success && scanData.save_meal) {
          // Format the response with the detected meal
          const meal = scanData.save_meal;
          const response = {
            reply: `${scanData.message}\n\n**${meal.name}** (${meal.serving})\n${meal.kcal} kcal · ${meal.p}g P · ${meal.c}g C · ${meal.f}g F\n\n${meal.ingredients ? `Detected: ${meal.ingredients.join(', ')}\n\n` : ''}Would you like to:\n- Log this to today's meals\n- Save as a reusable meal\n- Adjust the portions\n\n{"save_meal": ${JSON.stringify(meal)}}`
          };
          return NextResponse.json(response);
        }
      } catch (error) {
        console.error('Photo scan failed:', error);
        // Fall through to regular coach logic
      }
    }
  }

  const contextBlock = context && Object.keys(context).length
    ? `\n\nCURRENT SNAPSHOT:\n${JSON.stringify(context, null, 2)}`
    : '';

  const messages: Msg[] = [
    { role: 'system', content: SYSTEM + contextBlock },
    ...userMessages,
  ];

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.4,
        max_tokens: 700,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      return NextResponse.json({ error: `OpenAI ${resp.status}: ${err.slice(0, 300)}` }, { status: 502 });
    }
    const data = await resp.json();
    let reply = data.choices?.[0]?.message?.content || '(no response)';

    // Safety net: if the model slipped fish in anyway, flag it.
    const fishRegex = /\b(tuna|salmon|shrimp|cod|tilapia|sardine|mackerel|anchov|seafood|fish\b)/i;
    if (fishRegex.test(reply)) {
      reply = reply.replace(fishRegex, '~~[fish removed]~~') +
        '\n\n_(coach slipped a fish suggestion — filtered. re-ask if you want a replacement pick.)_';
    }
    return NextResponse.json({ reply });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
