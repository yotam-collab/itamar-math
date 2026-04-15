import https from 'https';
import fs from 'fs';
import path from 'path';

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error('Set OPENAI_API_KEY'); process.exit(1); }

const IMAGES_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'images');

const PROMPTS = [
    {
        file: 'welcome.jpg',
        prompt: "Cute cartoon illustration of a cheerful Jewish elementary school with kids in kippot studying math together, warm golden light, trees and nature of Israeli town visible through windows, colorful classroom with multiplication tables on walls, friendly and inviting atmosphere, children's book illustration style, no text in image"
    },
    {
        file: 'practice.jpg',
        prompt: "Cartoon illustration of a happy Jewish boy wearing a kippah confidently solving multiplication on a colorful chalkboard, golden stars and math symbols floating around him, cheerful bright classroom, children's book illustration style, no text"
    },
    {
        file: 'correct.jpg',
        prompt: "Joyful cartoon illustration of Jewish elementary school kids in kippot jumping and celebrating with gold stars and confetti, bright happy colors, school setting with math decorations, victory celebration mood, children's book illustration style, no text"
    },
    {
        file: 'correct2.png',
        prompt: "Cartoon illustration of a happy Jewish boy in kippah giving thumbs up with a big smile, surrounded by floating golden stars and sparkles, green checkmark in background, school setting, children's book illustration style, no text"
    },
    {
        file: 'correct3.png',
        prompt: "Cartoon illustration of cheerful Jewish school kids high-fiving each other wearing kippot, colorful confetti and stars around them, bright classroom background, celebration mood, children's book illustration style, no text"
    },
    {
        file: 'correct4.png',
        prompt: "Cartoon illustration of a proud Jewish boy wearing kippah holding up a paper with a gold star, beaming with pride, surrounded by sparkles and math symbols, warm school atmosphere, children's book illustration style, no text"
    },
    {
        file: 'wrong.jpg',
        prompt: "Cartoon illustration of a thoughtful Jewish boy wearing kippah scratching his head with a pencil, gentle encouraging expression, warm supportive school atmosphere, soft colors, thinking pose, children's book illustration style, no text"
    },
    {
        file: 'wrong2.png',
        prompt: "Cartoon illustration of a Jewish boy in kippah looking puzzled at a math problem, with a friendly cartoon lightbulb character encouraging him, warm school desk setting, soft encouraging colors, children's book illustration style, no text"
    },
    {
        file: 'wrong3.png',
        prompt: "Cartoon illustration of a Jewish school boy wearing kippah taking a deep breath with determined expression, about to try again, warm supportive classroom atmosphere, encouraging mood, children's book illustration style, no text"
    },
    {
        file: 'wrong4.png',
        prompt: "Cartoon illustration of a Jewish boy in kippah with a gentle smile saying 'I'll try again', supportive teacher hand on his shoulder, warm school setting, encouraging atmosphere, children's book illustration style, no text"
    }
];

async function generateImage(prompt) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            model: 'dall-e-3',
            prompt,
            n: 1,
            size: '1024x1024',
            response_format: 'b64_json'
        });

        const req = https.request({
            hostname: 'api.openai.com',
            path: '/v1/images/generations',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`API error ${res.statusCode}: ${data.substring(0, 200)}`));
                    return;
                }
                try {
                    const json = JSON.parse(data);
                    resolve(json.data[0].b64_json);
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function main() {
    console.log(`Generating ${PROMPTS.length} images with DALL-E 3...`);

    for (let i = 0; i < PROMPTS.length; i++) {
        const { file, prompt } = PROMPTS[i];
        const filePath = path.join(IMAGES_DIR, file);

        console.log(`[${i + 1}/${PROMPTS.length}] Generating ${file}...`);

        try {
            const b64 = await generateImage(prompt);
            const buf = Buffer.from(b64, 'base64');
            fs.writeFileSync(filePath, buf);
            console.log(`  ✓ Saved ${file} (${(buf.length / 1024).toFixed(0)}KB)`);
        } catch (err) {
            console.error(`  ✗ Failed ${file}: ${err.message}`);
        }

        // Rate limit: wait 1.5s between requests
        if (i < PROMPTS.length - 1) {
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    console.log('\nDone!');
}

main().catch(console.error);
