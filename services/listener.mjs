
import { discordService } from './discord.mjs';
import './x.mjs';

// Start monitoring when the module is run
await discordService.initialize();
console.log('🎮 Discord service started');