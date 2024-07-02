import express from 'express';
import { db } from '../../database.mjs';

const router = express.Router();

// Route to get dashboard statistics
router.get('/', async (req, res) => {
    try {
        const pipeline = [
            {
                $group: {
                    _id: null,
                    totalMessages: { 
                        $sum: { 
                            $cond: [
                                { $isArray: "$messages" },
                                { $size: "$messages" },
                                0
                            ]
                        } 
                    },
                    totalErrors: { 
                        $sum: { 
                            $cond: [{ $eq: ["$status", "failed"] }, 1, 0] 
                        } 
                    },
                    totalActions: { $sum: 1 },
                    statusCounts: { 
                        $push: { 
                            k: { 
                                $cond: [
                                    { $eq: ["$status", null] },
                                    "null",
                                    { $ifNull: ["$status", "unknown"] }
                                ]
                            }, 
                            v: 1
                        } 
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    messages: "$totalMessages",
                    errors: "$totalErrors",
                    actions: "$totalActions",
                    statuses: { $arrayToObject: "$statusCounts" }
                }
            }
        ];

        const stats = await db.collection('requests').aggregate(pipeline).next();

        if (!stats) {
            return res.status(404).send({ error: 'No statistics available' });
        }

        // Get the latest timestamp
        const latestTimestamp = await db.collection('requests').find({}, { projection: { createdAt: 1 } })
            .sort({ createdAt: -1 })
            .limit(1)
            .next();

        const response = {
            current: stats,
            timestamp: latestTimestamp ? latestTimestamp.createdAt : new Date(),
        };

        res.status(200).send(response);
    } catch (error) {
        console.error('📊 ❌ Failed to fetch statistics:', error);
        res.status(500).send({ error: 'Failed to fetch statistics' });
    }
});

// Route to get historical data for the dashboard
router.get('/history', async (req, res) => {
    try {
        const { hours = 1 } = req.query;
        const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);

        const pipeline = [
            {
                $match: {
                    createdAt: { $gte: hoursAgo }
                }
            },
            {
                $group: {
                    _id: { 
                        $dateToString: { 
                            format: "%Y-%m-%d %H:%M", 
                            date: "$createdAt" 
                        } 
                    },
                    messages: { 
                        $sum: { 
                            $cond: [
                                { $isArray: "$messages" },
                                { $size: "$messages" },
                                0
                            ]
                        } 
                    },
                    errors: { 
                        $sum: { 
                            $cond: [{ $eq: ["$status", "failed"] }, 1, 0] 
                        } 
                    },
                    actions: { $sum: 1 },
                    statuses: { 
                        $addToSet: { 
                            $cond: [
                                { $eq: ["$status", null] },
                                "null",
                                { $ifNull: ["$status", "unknown"] }
                            ]
                        } 
                    }
                }
            },
            {
                $sort: { _id: 1 }
            },
            {
                $project: {
                    _id: 0,
                    timestamp: "$_id",
                    messages: 1,
                    errors: 1,
                    actions: 1,
                    statuses: { $size: "$statuses" }
                }
            }
        ];

        const history = await db.collection('requests').aggregate(pipeline).toArray();

        if (history.length === 0) {
            return res.status(404).send({ error: 'No historical data available' });
        }

        res.status(200).send(history);
    } catch (error) {
        console.error('📊 ❌ Failed to fetch historical statistics:', error);
        res.status(500).send({ error: 'Failed to fetch historical statistics' });
    }
});

export default router;