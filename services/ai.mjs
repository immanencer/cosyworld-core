import ReplicateService from './ai/replicate.mjs';

class AI {
    constructor(model) {
        this.model = model;
        this.initializeService();
    }

    initializeService() {
        switch (this.model) {
            case 'openai/gpt-3.5-turbo':
                //this.service = new OpenAIService();
                //break;
            case 'ollama':
            case 'ollama/llama3':
                //this.service = new OllamaService();
                //break;
            case 'qwen2':
            case 'ollama/qwen2':
                //this.service = new OllamaService('qwen2');
                //break;
            case 'replicate/meta-llama-3-70b-instruct':
                this.service = new ReplicateService('meta-llama-3-70b-instruct');
                break;
            case 'replicate/meta-llama-3.1-405b-instruct':
                this.service = new ReplicateService('meta-llama-3.1-405b-instruct');
                break;
            default:
                throw new Error('Invalid model');

        }
    }

    async generateResponse(systemPrompt, messages) {
        return await this.service.chat({ systemPrompt, messages: messages });
    }
}

export default AI;
