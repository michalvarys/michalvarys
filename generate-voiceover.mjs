import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load API key from .env
const envContent = readFileSync(path.join(__dirname, ".env"), "utf-8");
const API_KEY = envContent
  .split("\n")
  .find((l) => l.startsWith("ELEVENLABS_API_KEY="))
  ?.split("=")[1]
  ?.trim();

if (!API_KEY) {
  console.error("ELEVENLABS_API_KEY not found in .env");
  process.exit(1);
}

const VOICE_ID = "P5JJg65WdWQglOCyt8cr";
const OUTPUT_FILE = path.join(__dirname, "video-wordpress-problems-voiceover.mp3");

// Voiceover script — matches 45s video timeline
// Scene 1 (0-8s): Hook — grab attention of business owners with WP problems
// Scene 2 (7.5-14.5s): Pain points — amplify the frustration
// Scene 3 (14-21s): Pivot — transition to solution
// Scene 4 (20.5-27.5s): Solution — introduce VARYSHOP
// Scene 5 (27-38s): CTA — call to action
// Scene 6 (37.5-45s): Outro — brand close

const VOICEOVER_TEXT = `If you are a Business owner and your WordPress takes forever to load, you're losing customers right now.

Constant errors. Plugins breaking after every update. Three-second load times killing your sales. Thirty plugins just to keep things running. And hackers? They never stop trying.

But there's a better way. What if you could ditch WordPress entirely with zero risk?

Meet Varyshop. One platform that does it all. Blazing fast load times. A simple content editor — no code needed. Built-in CRM to manage your leads. And marketing tools — email, forms, analytics — all included.

We'll migrate your WordPress site for free. No upfront cost. Only five spots are available, so don't wait.`;

console.log("Voiceover text:");
console.log("---");
console.log(VOICEOVER_TEXT);
console.log("---");
console.log(`\nCharacters: ${VOICEOVER_TEXT.length}`);
console.log(`Voice ID: ${VOICE_ID}`);
console.log(`Output: ${OUTPUT_FILE}\n`);

console.log("Calling ElevenLabs TTS API...");

const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
  {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: VOICEOVER_TEXT,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  }
);

if (!response.ok) {
  const errorText = await response.text();
  console.error(`ElevenLabs API error (${response.status}):`, errorText);
  process.exit(1);
}

const arrayBuffer = await response.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);
writeFileSync(OUTPUT_FILE, buffer);

console.log(`Voiceover saved: ${OUTPUT_FILE}`);
console.log(`File size: ${(buffer.length / 1024).toFixed(1)} KB`);
