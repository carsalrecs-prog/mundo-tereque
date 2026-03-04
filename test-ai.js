import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "AIzaSyDkSAqtXh2MdpEou7XQPJxuEKw3eCL1m6g" });

async function run() {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: 'say hello',
        });
        console.log(response.text);
    } catch (e) {
        console.error("ERROR CAUGHT:");
        console.error(e);
    }
}
run();
