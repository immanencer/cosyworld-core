const model_cache = {};

export default class ReplicateService {
    constructor(model = 'meta-llama-3-70b-instruct') {
        this.model = model;
        this.apiToken = process.env.REPLICATE_API_TOKEN;
    }

    async chat({ systemPrompt, messages }) {
        const userMessages = messages.map(msg => msg.content).join(' ');
        const requestBody = {
            input: {
                top_k: 0,
                top_p: 0.9,
                prompt: userMessages,
                max_tokens: 512,
                min_tokens: 0,
                temperature: 0.6,
                system_prompt: systemPrompt,
                length_penalty: 1,
                stop_sequences: "<|end_of_text|>,<|eot_id|>",
                prompt_template: "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n" + systemPrompt + "<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
                presence_penalty: 1.15,
                log_performance_metrics: false
              }
        };

        console.log('🦙 Requesting response from Replicate:', JSON.stringify(requestBody, null, 2));

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
            console
            console.error('🦙 Empty response from Replicate');
            throw new Error('Empty response from Replicate');
        }

        return result.output;
    }
}
