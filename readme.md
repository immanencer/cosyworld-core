# AI-Powered Group Chat Bot

## Overview

This project implements an AI-powered bot system designed for group chat environments. It supports multiple AI models and features dynamic memory management, allowing bots to remember and respond to conversations across different chat locations.

## Key Features

- Support for multiple AI models (OpenAI, Anthropic, Ollama)
- Dynamic cross-channel memory for bots
- Adaptive conversation handling
- Optimized message processing to reduce unnecessary API calls

## Main Components

1. **AI Class**: A wrapper for different AI services, allowing easy switching between models.
2. **OpenAIService**: Handles interactions with the OpenAI API.
3. **AnthropicService**: Manages communications with the Anthropic API.
4. **OllamaService**: Interfaces with the Ollama local AI model.
5. **Message Processing**: Efficiently fetches and processes new messages for each bot.

## Setup

1. Clone the repository:
   ```
   git clone [your-repo-url]
   cd [your-project-directory]
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the project root and add the following:
   ```
   OPENAI_API_KEY=your_openai_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

4. Configure your bots:
   Edit the `config.js` file to set up your bots, their locations, and preferred AI models.

5. Run the application:
   ```
   npm start
   ```

## Usage

The system will automatically process messages for each configured bot. Bots will respond to messages in their current location and can be summoned to other locations by mentions.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This is a permissive (MIT) open source project. Please attribute this github account in source code.
