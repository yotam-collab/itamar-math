#!/usr/bin/env node
/**
 * generate-audio.mjs — Generate Hebrew TTS and SFX using ElevenLabs API
 *
 * Usage:
 *   ELEVENLABS_API_KEY=sk_xxx node generate-audio.mjs
 *
 * Outputs: audio-data.js (base64-encoded audio for the math game)
 */

import fs from 'fs';
import path from 'path';

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
    console.error('Error: Set ELEVENLABS_API_KEY environment variable');
    process.exit(1);
}

const BASE_URL = 'https://api.elevenlabs.io/v1';
const PROGRESS_FILE = './audio-gen-progress.json';

// Hebrew number words (mirrors HebrewNumbers in index.html)
const ones = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'];
const teens = ['עשר', 'אחת עשרה', 'שתים עשרה', 'שלוש עשרה', 'ארבע עשרה', 'חמש עשרה',
    'שש עשרה', 'שבע עשרה', 'שמונה עשרה', 'תשע עשרה'];
const tens = ['', '', 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'];

function toWords(n) {
    if (n === 0) return 'אפס';
    if (n === 100) return 'מאה';
    if (n > 100 && n <= 144) {
        const remainder = n - 100;
        if (remainder === 0) return 'מאה';
        return 'מאה ' + (remainder < 10 ? 'ו' : 'ו') + toWords(remainder);
    }
    if (n < 10) return ones[n];
    if (n >= 10 && n < 20) return teens[n - 10];
    const ten = Math.floor(n / 10);
    const one = n % 10;
    if (one === 0) return tens[ten];
    return tens[ten] + ' ו' + ones[one];
}

// ====== Voice Selection ======
async function findBestVoice() {
    // First try to list available voices
    const res = await fetch(`${BASE_URL}/voices`, {
        headers: { 'xi-api-key': API_KEY }
    });
    const data = await res.json();
    const voices = data.voices || [];

    if (voices.length > 0) {
        console.log(`Found ${voices.length} voices in account`);
        // Prefer a young/playful voice
        for (const v of voices) {
            const labels = v.labels || {};
            console.log(`  Voice: ${v.name} | ${v.voice_id} | age=${labels.age} | gender=${labels.gender}`);
        }
        // Use first available, or Rachel as default
        return voices[0].voice_id;
    }

    // Fallback to well-known multilingual voices
    // Aria - natural, young-sounding multilingual voice (good Hebrew)
    const defaultVoices = [
        { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria' },
        { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River' },
        { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger' },
        { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
    ];

    // Test which one works
    for (const voice of defaultVoices) {
        try {
            const testRes = await fetch(`${BASE_URL}/text-to-speech/${voice.id}`, {
                method: 'POST',
                headers: {
                    'xi-api-key': API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: 'שלום',
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: { stability: 0.5, similarity_boost: 0.8 }
                })
            });
            if (testRes.ok) {
                console.log(`Using voice: ${voice.name} (${voice.id})`);
                return voice.id;
            }
        } catch (e) { /* try next */ }
    }

    throw new Error('No working voice found');
}

// ====== TTS Generation ======
async function generateTTS(voiceId, text, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
                method: 'POST',
                headers: {
                    'xi-api-key': API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                body: JSON.stringify({
                    text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.55,
                        similarity_boost: 0.8,
                        style: 0.35,
                        use_speaker_boost: true
                    },
                    output_format: 'mp3_22050_32'
                })
            });

            if (!res.ok) {
                const err = await res.text();
                if (res.status === 429) {
                    // Rate limited - wait and retry
                    const wait = (attempt + 1) * 5000;
                    console.log(`  Rate limited, waiting ${wait/1000}s...`);
                    await sleep(wait);
                    continue;
                }
                throw new Error(`TTS API error ${res.status}: ${err}`);
            }

            const buffer = await res.arrayBuffer();
            return Buffer.from(buffer).toString('base64');
        } catch (e) {
            if (attempt === retries - 1) throw e;
            await sleep(2000);
        }
    }
}

// ====== Sound Effects Generation ======
async function generateSFX(prompt, durationSeconds = 2, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const res = await fetch(`${BASE_URL}/sound-generation`, {
                method: 'POST',
                headers: {
                    'xi-api-key': API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: prompt,
                    duration_seconds: durationSeconds,
                    prompt_influence: 0.3
                })
            });

            if (!res.ok) {
                const err = await res.text();
                if (res.status === 429) {
                    const wait = (attempt + 1) * 5000;
                    console.log(`  Rate limited, waiting ${wait/1000}s...`);
                    await sleep(wait);
                    continue;
                }
                throw new Error(`SFX API error ${res.status}: ${err}`);
            }

            const buffer = await res.arrayBuffer();
            return Buffer.from(buffer).toString('base64');
        } catch (e) {
            if (attempt === retries - 1) throw e;
            await sleep(2000);
        }
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ====== Progress tracking ======
function loadProgress() {
    try {
        return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    } catch { return { numbers: {}, phrases: {}, sfx: {} }; }
}

function saveProgress(progress) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ====== Main ======
async function main() {
    console.log('=== ElevenLabs Audio Generator for Math Game ===\n');

    // Find best voice
    const voiceId = await findBestVoice();

    // Load progress (for resume capability)
    const progress = loadProgress();

    // 1. Generate numbers 1-144
    console.log('\n📢 Generating Hebrew number TTS (1-144)...');
    const numbersToGenerate = new Set();
    for (let a = 1; a <= 12; a++) {
        for (let b = 1; b <= 12; b++) {
            numbersToGenerate.add(a);
            numbersToGenerate.add(b);
            numbersToGenerate.add(a * b);
        }
    }
    const sortedNumbers = [...numbersToGenerate].sort((a, b) => a - b);

    let count = 0;
    const total = sortedNumbers.length;
    for (const n of sortedNumbers) {
        const key = String(n);
        if (progress.numbers[key]) {
            count++;
            continue;
        }

        const word = toWords(n);
        count++;
        process.stdout.write(`  [${count}/${total}] ${n} → "${word}"...`);

        const b64 = await generateTTS(voiceId, word);
        progress.numbers[key] = b64;
        saveProgress(progress);
        console.log(` ✓ (${Math.round(b64.length * 0.75 / 1024)}KB)`);

        await sleep(300); // Rate limit buffer
    }

    // 2. Generate connector phrases
    console.log('\n📢 Generating connector phrases...');
    const phrases = {
        'כפול': 'כפול',
        'שווה': 'שווה',
        'נכון מאוד איתמר': 'נכון מאוד איתמר!',
        'איתמר אלוף': 'איתמר אלוף!',
        'כל הכבוד איתמר': 'כל הכבוד איתמר!',
        'מעולה איתמר': 'מעולה איתמר!',
        'יופי איתמר': 'יופי איתמר!',
        'מדהים איתמר': 'מדהים איתמר!',
        'וואו איתמר': 'וואו איתמר!',
        'נהדר איתמר': 'נהדר איתמר!',
        'איתמר כוכב': 'איתמר כוכב!'
    };

    for (const [key, text] of Object.entries(phrases)) {
        if (progress.phrases[key]) {
            console.log(`  "${key}" — cached ✓`);
            continue;
        }

        process.stdout.write(`  "${key}"...`);
        const b64 = await generateTTS(voiceId, text);
        progress.phrases[key] = b64;
        saveProgress(progress);
        console.log(` ✓ (${Math.round(b64.length * 0.75 / 1024)}KB)`);

        await sleep(300);
    }

    // 3. Generate sound effects
    console.log('\n🔊 Generating sound effects...');
    const sfxPrompts = {
        'correct_1': 'Short cheerful ding, bright positive game feedback, child-friendly, 8-bit arcade style',
        'correct_2': 'Quick happy chime with sparkle, game correct answer, upbeat and playful',
        'correct_3': 'Short triumphant piccolo trill, child game positive feedback, bright and bubbly',
        'correct_4': 'Quick ascending xylophone notes, happy game sound, cute and cheerful',
        'correct_5': 'Short magical sparkle sound, fairy dust, child game correct answer reward',
        'wrong': 'Gentle short buzzer, soft wrong answer feedback, not scary, child-friendly game',
        'achievement': 'Short fanfare with trumpets, game achievement unlock, triumphant and exciting, child-friendly',
        'perfect': 'Grand triumphant victory fanfare, celebration, fireworks sparkle, child game perfect score',
        'streak': 'Quick ascending power-up sound, combo multiplier, energetic game streak sound',
        'welcome': 'Short playful greeting melody, happy game startup jingle, bright and inviting, child-friendly'
    };

    for (const [key, prompt] of Object.entries(sfxPrompts)) {
        if (progress.sfx[key]) {
            console.log(`  "${key}" — cached ✓`);
            continue;
        }

        const duration = key === 'welcome' ? 3 : (key === 'perfect' || key === 'achievement') ? 2.5 : 1.5;
        process.stdout.write(`  "${key}" (${duration}s)...`);

        try {
            const b64 = await generateSFX(prompt, duration);
            progress.sfx[key] = b64;
            saveProgress(progress);
            console.log(` ✓ (${Math.round(b64.length * 0.75 / 1024)}KB)`);
        } catch (e) {
            console.log(` ✗ (${e.message}) — will use oscillator fallback`);
        }

        await sleep(500);
    }

    // 4. Write output file
    console.log('\n💾 Writing audio-data.js...');

    const output = `// Auto-generated by generate-audio.mjs — DO NOT EDIT
// Contains base64-encoded audio clips for the math game
// Generated: ${new Date().toISOString()}
window.AUDIO_DATA = {
  numbers: ${JSON.stringify(progress.numbers)},
  phrases: ${JSON.stringify(progress.phrases)},
  sfx: ${JSON.stringify(progress.sfx)}
};
`;

    fs.writeFileSync('./audio-data.js', output);
    const sizeKB = Math.round(fs.statSync('./audio-data.js').size / 1024);
    console.log(`\n✅ Done! audio-data.js written (${sizeKB}KB)`);
    console.log(`   Numbers: ${Object.keys(progress.numbers).length}`);
    console.log(`   Phrases: ${Object.keys(progress.phrases).length}`);
    console.log(`   SFX: ${Object.keys(progress.sfx).length}`);

    // Cleanup progress file
    fs.unlinkSync(PROGRESS_FILE);
    console.log('\n🎉 All done! Add <script src="audio-data.js"></script> to index.html');
}

main().catch(e => {
    console.error('\n❌ Error:', e.message);
    console.log('Progress saved. Run again to resume.');
    process.exit(1);
});
