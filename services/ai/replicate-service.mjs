const model_cache = {};

export default class ReplicateService {
    constructor(model = 'meta-llama-3-70b-instruct') {
        this.model = model;
        this.apiToken = process.env.REPLICATE_API_TOKEN;
    }

    async chat({ systemPrompt, messages }) {
        const modelfile = `FROM ${this.model}\nSYSTEM "${systemPrompt}"`;

        const modelHash = this.generateHash(modelfile);

        if (!model_cache[modelHash]) {
            try {
                model_cache[modelHash] = true;
                console.log('🦙 Model initialized:', modelHash);
            } catch (error) {
                console.error('💀 🦙 Failed to initialize model:', error);
                throw error;
            }
        } else {
            console.log('🦙 Model exists:', modelHash);
        }

        const userMessages = messages.map(msg => msg.content).join(' ');
        const requestBody = {
            input: {
                top_k: 0,
                top_p: 0.9,
                prompt: `Work through this problem step by step:\n\nQ: ${userMessages}`,
                max_tokens: 512,
                min_tokens: 0,
                temperature: 0.6,
                system_prompt: systemPrompt,
                length_penalty: 1,
                stop_sequences: [","],
                prompt_template: `system\n\nYou are a helpful assistant\n\nuser\n\n{prompt}\n\nassistant\n\n`,
                presence_penalty: 1.15,
                log_performance_metrics: false
            }
        };

        const response = await fetch('https://api.replicate.com/v1/models/meta/meta-llama-3-70b-instruct/predictions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('🦙 Failed to get response from Replicate:', errorText);
            throw new Error('Failed to get response from Replicate');
        }

        const result = await response.json();

        if (!result || !result.output) {
            console.error('🦙 Empty response from Replicate');
            throw new Error('Empty response from Replicate');
        }

        return result.output;
    }

    generateHash(input) {
        return input.split('').reduce((acc, char) => {
            return acc + char.charCodeAt(0);
        }, 0).toString();
    }
}
