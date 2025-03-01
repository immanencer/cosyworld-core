import express from 'express';
import bodyParser from 'body-parser';
import { ObjectId } from 'mongodb';
import { db } from '../../database.mjs';

const router = express.Router();
const TASKS_COLLECTION = 'tasks';

// Middleware to parse JSON requests
router.use(bodyParser.json());

// Endpoint to create a new task
router.post('/tasks', async (req, res) => {
    const { model, system_prompt, messages } = req.body;
    
    if (!model || !system_prompt || !messages) {
        return res.status(400).send({ error: 'Missing required fields: model, system_prompt, messages' });
    }
    
    const newTask = {
        model: 'ollama/llama3',
        system_prompt,
        messages,
        status: 'pending',
        createdAt: new Date()
    };
    
    try {
        const result = await db.collection(TASKS_COLLECTION).insertOne(newTask);
        res.status(201).send({ message: 'Task created', taskId: result.insertedId });
    } catch (error) {
        console.error('❌ Failed to create task:', error);
        res.status(500).send({ error: 'Failed to create task' });
    }
});

// Endpoint to get all tasks
router.get('/tasks', async (req, res) => {
    try {
        const tasks = await db.collection(TASKS_COLLECTION).find({}).toArray();
        res.status(200).send(tasks);
    } catch (error) {
        console.error('❌ Failed to get tasks:', error);
        res.status(500).send({ error: 'Failed to get tasks' });
    }
});

// Endpoint to get a single task by ID
router.get('/tasks/:taskId', async (req, res) => {
    const { taskId } = req.params;
    try {
        const task = await db.collection(TASKS_COLLECTION).findOne({ _id: new ObjectId(taskId) });
        if (!task) {
            return res.status(404).send({ error: 'Task not found' });
        }
        res.status(200).send(task);
    } catch (error) {
        console.error('❌ Failed to get task:', error);
        res.status(500).send({ error: 'Failed to get task' });
    }
});

export default router;