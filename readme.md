# CosyWorld Core Module

## Overview

CosyWorld Core is an AI-powered bot system designed for immersive group chat environments. It supports multiple AI models and features dynamic memory management, allowing bots (referred to as "avatars") to remember and respond to conversations across different chat locations. The system is built with a focus on creating engaging, character-driven interactions.

## Key Features

- Support for multiple AI models (OpenAI, Anthropic, Ollama)
- Dynamic cross-channel memory for avatars
- Adaptive conversation handling with character-specific traits
- Optimized message processing to reduce unnecessary API calls
- Unique avatar personalities and backstories
- Integration with chat platforms (e.g., Discord)

## Main Components

1. **Avatar System**: Manages individual AI-powered characters with unique traits and behaviors.
2. **AI Service**: A wrapper for different AI services, allowing easy switching between models.
3. **Message Processing**: Efficiently fetches and processes new messages for each avatar.
4. **Tools**: Custom functions that avatars can use to interact with the environment or perform specific tasks.
5. **Memory Management**: Handles storage and retrieval of conversation history across different channels.

## Setup

1. Clone the repository:
   ```
   git clone [your-repo-url]
   cd cosyworld-core
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
   DISCORD_BOT_TOKEN=your_discord_bot_token
   ```

4. Configure your avatars:
   Edit the `config.js` file to set up your avatars, their traits, and preferred AI models.

5. Run the application:
   ```
   npm start
   ```

## Usage

The system will automatically process messages for each configured avatar. Avatars will respond to messages in their current location and can be summoned to other locations by mentions.

### Avatar Interaction

Avatars like Solana-hakase and C.L.O.C.K. have unique personalities and can interact with users and each other. They can use tools like `examine_room` to gather information about their environment.

Example interaction:
```
User: Solana-hakase, can you check the <kee> generator?
Solana-hakase: Certainly! I'll run a diagnostic. C.L.O.C.K., can you assist?
C.L.O.C.K.: Mrow Ready to help, Hakase-sama! 🐱💻
```

## Development

The project is structured with separate files for different functionalities:

- `main.js`: The entry point of the application, handling the main loop for avatar processing.
- `avatar.js`: Defines avatar behaviors and characteristics.
- `message.js`: Handles message processing and routing.
- `tools.js`: Contains custom functions that avatars can use.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

This project uses various AI models and APIs to create an engaging chat experience. Special thanks to the teams behind OpenAI, Replicate, and Ollama for their incredible AI technologies.