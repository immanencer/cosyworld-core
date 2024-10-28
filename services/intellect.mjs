import { db } from '../database.mjs';

const collection = db.collection('tasks');

import AI from './ai.mjs';

let logged = false;
async function process_next_task() {
    // get the next task from the queue
    const task = await collection.findOneAndUpdate(
        { status: 'pending'
        , system_prompt: {$exists: true}
        , messages: {$exists: true} },
        { $set: { status: 'processing' } }
    );
    
    if (!task) {
        if (!logged) {
            console.log('No tasks in the queue, monitoring...');
            logged = true;
        }
        return;
    }
    logged = false;
    
    // process the task
    const ai = new AI(task.model);


    let response;
    try {
        response = await ai.generateResponse(task.system_prompt, task.messages);
    } catch (error) {
        console.error('Error processing task:', error);
        await collection.updateOne(
            { _id: task._id },
            { $set: { status: 'failed', error: error.message }
        });
        return;
    }


    // update the task with the response    
    await collection.updateOne(
        { _id: task._id },
        { $set: { status: 'completed', response } }
    );
    
}


let running = true;
while (running) {
    await process_next_task();
}
