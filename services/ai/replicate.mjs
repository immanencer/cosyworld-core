const model_cache = {};

export default class ReplicateService {
    constructor(model = 'meta-llama-3.1-8b-instruct') {
        this.model = model;
        this.apiToken = process.env.REPLICATE_API_TOKEN;
    }

    async chat({ systemPrompt, messages }) {
        const userMessages = messages.map(msg => msg.content).join('\n');
        const requestBody = {
            input: {
                prompt: userMessages,
                max_tokens: 512,
                temperature: 0.7, // Slightly increased for more creative responses
                top_p: 0.9, // High probability mass to consider for sampling
                top_k: 50, // Adding top_k for better quality control
                presence_penalty: 1.2, // Increased slightly to encourage novel tokens
                frequency_penalty: 0.5, // Added to reduce repetition
                log_performance_metrics: false,
                length_penalty: 1, // Adjust based on desired verbosity
                stop_sequences: "<|end_of_text|>,<|eot_id|>",
                prompt_template: "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n" + systemPrompt + "<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"
            }
        };

        const response = await fetch('https://api.replicate.com/v1/models/meta/meta-llama-3.1-405b-instruct/predictions', {
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
        const prediction = await response.json();
        return this.pollPredictionResult(prediction.id);
    }

    async pollPredictionResult(predictionId) {
        let status = 'starting';
        let result;
        do {
            const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`
                }
            });
            result = await pollResponse.json();
            status = result.status;
            if (status === 'failed' || status === 'canceled') {
                console.error('🦙 Prediction failed or was canceled:', result.error);
                throw new Error('Prediction failed or was canceled');
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every second
        } while (status === 'starting' || status === 'processing');

        return result.output.join('');
    }

    async viewImageByUrl({ imageUrl, prompt, maxTokens = 1024, temperature = 0.2 }) {
        const requestBody = {
            version: "b5f6212d032508382d61ff00469ddda3e32fd8a0e75dc39d8a4191bb742157fb",
            input: {
                image: imageUrl,
                top_p: 1,
                prompt: prompt,
                max_tokens: maxTokens,
                temperature: temperature
            }
        };

        const response = await fetch('https://api.replicate.com/v1/predictions', {
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

        const prediction = await response.json();
        return this.pollPredictionResult(prediction.id);
    }
}