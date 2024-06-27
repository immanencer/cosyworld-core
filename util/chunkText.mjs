/**
 * Chunks a given text message into smaller parts while preserving logical sections.
 * @param {string} message - The message to be chunked.
 * @param {number} [chunkSize=2000] - The maximum size of each chunk.
 * @returns {string[]} An array of chunked text sections.
 * @throws {Error} If the message is not a string or if chunkSize is not a positive number.
 */
export default function chunkText(message, chunkSize = 2000) {
    // Input validation
    if (typeof message !== 'string') {
        throw new Error('Message must be a string');
    }
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
        throw new Error('Chunk size must be a positive integer');
    }

    // Handle empty message
    if (message.trim().length === 0) {
        console.warn('🎮 ⚠️ Empty message provided to chunker');
        return [];
    }

    // Regex for splitting: headings, double newlines, bold text
    const splitRegex = /(\n\n|\n#+\s|\*\*[^*]+\*\*|\*\*\s)/;
    const sections = message.split(splitRegex);

    const chunks = [];
    let currentChunk = "";

    for (const section of sections) {
        if (currentChunk.length + section.length <= chunkSize) {
            currentChunk += section;
        } else {
            // If adding this section exceeds the chunk size
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
            
            // Handle sections longer than chunkSize
            if (section.length > chunkSize) {
                const subChunks = section.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || [];
                chunks.push(...subChunks.map(chunk => chunk.trim()));
            } else {
                currentChunk = section;
            }
        }
    }

    // Add the last chunk if it contains text
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}