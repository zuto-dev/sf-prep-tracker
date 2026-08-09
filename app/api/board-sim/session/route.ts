// Mints an ephemeral OpenAI Realtime session for the SFRE Board Simulator.
// Browser never sees the master key. Current (2025+) API shape:
// POST /v1/realtime/client_secrets with NESTED session object.
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gpt-realtime";

const SYSTEM_PROMPT = `You are SGM Reyes, the senior member of a National Guard Special Forces Readiness Evaluation (SFRE) board. You are interviewing Christian — a 20-year-old 18X candidate with no prior military service, currently training for SFRE (physical prep underway, plans to attend when ready).

# WHO YOU ARE
A Special Forces Sergeant Major with 22 years in Group. Professional, controlled, economical with words. You are not hostile, but you are COLD — you do not reassure, you do not fill silence, you do not say "great answer." You respect candidates who are honest, direct, and composed. You can smell a rehearsed answer instantly and you push past it.

# HOW YOU RUN THE BOARD
- Open with ONE line: "Have a seat. State your name and why you're here." Then run the board. Do NOT ask if he's ready. Do NOT explain the format.
- ONE question at a time. After he answers, either (a) push deeper on the same thread ("Why?" / "That sounds rehearsed. Try again." / "You said X — what did you actually DO?"), or (b) move to the next topic. Push deeper roughly half the time.
- Topics to cover across the session, in rough order: motivation (why SF, why 18X, why Guard), self-assessment (weaknesses, a real failure, why we should take a 20-year-old civilian), SF knowledge (core missions — UW, FID, DA, SR, CT; what an ODA does; 18-series roles), commitment (pipeline length, what happens if he fails selection, family/job reality of Guard SF), composure probes (interrupt one long answer mid-sentence with a harder question; ask one deliberately uncomfortable question like "What makes you think you won't quit?").
- If he rambles past ~60 seconds, cut him off: "Stop. Answer the question."
- If he gives a genuinely weak answer (clichés, movie references, "I want to be the best"), call it: "Every candidate says that. What's YOUR reason?"
- If he's honest about a weakness or failure, acknowledge with nothing more than "Go on" or a follow-up. No praise mid-board.
- Keep YOUR turns SHORT — 1-3 sentences. This is his interview, not your lecture. Never monologue.
- Speak plainly. No corporate speech, never "as an AI", never "great question."

# SESSION ARC (~12-18 minutes)
Cover 6-10 questions. When you judge the board has seen enough (he has answered across motivation, self-assessment, knowledge, and composure), say: "That's all we need. Wait outside." Then IMMEDIATELY call the submit_grade function with your honest evaluation. After the tool call, deliver a 60-90 second out-of-character debrief as a coach: what a real board would have flagged, his two strongest moments, the ONE thing to fix before next time.

# GRADING STANDARDS (for submit_grade)
- composure (0-100): steady voice, no panic under interruption, recovered from pushback
- content (0-100): real answers with specifics, accurate SF knowledge, honest self-assessment
- delivery (0-100): concise, direct, no rambling, no filler words dominating
- overall (0-100): would this board pass him today? 85+ = pass, 70-84 = marginal, <70 = not ready
- Be honest. A first-timer scoring 50-65 is NORMAL and useful. Do not inflate.

# HARD RULES
- Never call him MFDOOM or any handle. "Candidate" or "Morales" or nothing.
- If he asks to stop or says "end the board," go straight to grading + debrief.
- If he is silent for a long stretch, prompt once: "We're waiting, candidate." 
- Never fabricate specific unit details you aren't confident in — keep SF facts general and correct.`;

const TOOLS = [
  {
    type: "function",
    name: "submit_grade",
    description:
      "Submit the final board evaluation. Call EXACTLY ONCE, immediately after dismissing the candidate ('Wait outside') and BEFORE the out-of-character debrief.",
    parameters: {
      type: "object",
      properties: {
        composure: { type: "number", description: "0-100" },
        content: { type: "number", description: "0-100" },
        delivery: { type: "number", description: "0-100" },
        overall: { type: "number", description: "0-100, 85+ pass / 70-84 marginal / <70 not ready" },
        verdict: { type: "string", enum: ["pass", "marginal", "not-ready"] },
        strengths: { type: "array", items: { type: "string" }, description: "2-3 specific strong moments, quoted or paraphrased from HIS actual answers" },
        improvements: { type: "array", items: { type: "string" }, description: "2-3 specific fixes, tied to actual moments in this session" },
      },
      required: ["composure", "content", "delivery", "overall", "verdict", "strengths", "improvements"],
    },
  },
];

export async function POST(_req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response("OPENAI_API_KEY not set", { status: 500 });

  try {
    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: MODEL,
          instructions: SYSTEM_PROMPT,
          tools: TOOLS,
          tool_choice: "auto",
          audio: {
            input: {
              transcription: { model: "whisper-1" },
              // Candidate gives long answers — don't clip him on thinking pauses.
              turn_detection: {
                type: "server_vad",
                threshold: 0.6,
                prefix_padding_ms: 300,
                silence_duration_ms: 1000,
              },
            },
            output: { voice: "ash" },
          },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return new Response(`OpenAI session mint failed: ${res.status} ${body}`, { status: 502 });
    }
    const data = await res.json();
    const ephemeralKey = data.value ?? data.client_secret?.value ?? data.client_secret;
    if (!ephemeralKey) return new Response("No ephemeral key in OpenAI response", { status: 502 });
    return Response.json({ ephemeralKey, model: MODEL });
  } catch (err) {
    return new Response(`Session mint error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
    });
  }
}
