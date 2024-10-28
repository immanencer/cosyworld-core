import { TASKS_API, POLL_INTERVAL } from '../config.js';
import { postJSON, fetchJSON } from './utils.js';

/**
 * Creates an AI task with the given system prompt and messages.
 * @param {string} system_prompt - The system prompt for the AI task.
 * @param {Array} messages - The messages for the AI task.
 * @returns {Promise<string>} The task ID of the created task.
 */
export async function createAiTask(system_prompt, messages) {
    const task = {
        action: 'ai',
        model: 'ollama/llama3.2',
        system_prompt,
        messages
    };

    try {
        const response = await postJSON(TASKS_API, task);
        return response.taskId;
    } catch (error) {
        console.error('Error creating AI task:', error);
        throw new Error('Failed to create AI task');
    }
}

/**
 * Fetches the status of a task given its task ID.
 * @param {string} taskId - The ID of the task.
 * @returns {Promise<Object>} The status of the task.
 */
export async function getTaskStatus(taskId) {
    const url = `${TASKS_API}/${taskId}`;
    try {
        return await fetchJSON(url);
    } catch (error) {
        console.error(`Error fetching task status for task ${taskId}:`, error);
        throw new Error('Failed to fetch task status');
    }
}

/**
 * Polls the completion status of a task at regular intervals.
 * @param {string} taskId - The ID of the task to poll.
 * @returns {Promise<string>} The response of the completed task.
 */
export function pollTaskCompletion(taskId) {
    return new Promise((resolve, reject) => {
        const checkStatus = async () => {
            try {
                const taskStatus = await getTaskStatus(taskId);
                if (taskStatus.status === 'completed') {
                    resolve(taskStatus.response || '');
                } else if (taskStatus.status === 'failed') {
                    reject(new Error(`Task ${taskId} failed: ${taskStatus.error}`));
                } else {
                    setTimeout(checkStatus, POLL_INTERVAL);
                }
            } catch (error) {
                console.error(`Error checking status for task ${taskId}:`, error);
                reject(new Error('Failed to check task status'));
            }
        };
        checkStatus();
    });
}

/**
 * Waits for an AI task to complete for a given avatar and conversation.
 * @param {Object} avatar - The avatar object.
 * @param {Array} conversation - The conversation messages.
 * @returns {Promise<string|null>} The result of the completed task, or null if it fails.
 */
export async function waitForTask(avatar, conversation) {
    let taskId;
    try {
        taskId = await createAiTask(avatar.personality, conversation);
    } catch (error) {
        console.error(`Failed to create task for ${avatar.name}:`, error);
        return null;
    }

    try {
        const result = await pollTaskCompletion(taskId);
        return result;
    } catch (error) {
        console.error(`Failed to complete task for ${avatar.name}:`, error);
        return null;
    }
}
