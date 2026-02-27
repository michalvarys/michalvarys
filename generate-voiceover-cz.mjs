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

// Using the same voice (multilingual v2 handles Czech well)
const VOICE_ID = "P5JJg65WdWQglOCyt8cr";
const OUTPUT_FILE = path.join(__dirname, "video-wordpress-problems-cz-voiceover.mp3");

// Czech voiceover script — matches 45s video timeline
// Scene 1 (0-8s): Hook — upoutat pozornost podnikatelů s WP problémy
// Scene 2 (7.5-14.5s): Pain points — zesílit frustraci
// Scene 3 (14-21s): Pivot — přechod k řešení
// Scene 4 (20.5-27.5s): Solution — představit VARYSHOP
// Scene 5 (27-38s): CTA — výzva k akci
// Scene 6 (37.5-45s): Outro — závěr

const VOICEOVER_TEXT = `Jste podnikatel a váš WordPress se načítá celou věčnost? Pravděpodobně přicházíte o zákazníky.

Neustálé chyby. Pluginy se rozbijí po každém updatu. Tři sekundy načítání zabíjí prodeje. Třicet pluginů jen aby web fungoval. A update pluginů to rozbije.

Co když existuje lepší cesta. Co když se WordPressu dá zbavit úplně, bez jakéhokoliv rizika?

Proto tu je Varyshop. Jedna platforma, pro správu celého byznysu. Bleskurychlé načítání. Jednoduchý editor obsahu — žádný kód. Vestavěné CRM pro správu kontaktů. A marketingové nástroje jako e-maily, formuláře, analytika — vše v jednom.

Převedeme váš WordPress k nám zdarma. Žádné náklady předem. Máme kapacitu pouze na pět klientů, tak neváhejte.`;

console.log("Voiceover text (CZ):");
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
