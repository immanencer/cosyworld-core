import express from 'express';
const router = express.Router();

import { db } from '../../database.mjs';

router.get('/map', async (req, res) => {
  const client = new MongoClient(mongoUri);

  try {
    // Get all avatars and objects
    const avatars = await db.collection('avatars').find().toArray();
    const objects = await db.collection('objects').find().toArray();

    // Combine avatars and objects by location
    const locationMap = {};

    avatars.forEach(avatar => {
      if (!locationMap[avatar.location]) {
        locationMap[avatar.location] = { avatars: [], objects: [] };
      }
      locationMap[avatar.location].avatars.push(avatar);
    });

    objects.forEach(object => {
      if (!locationMap[object.location]) {
        locationMap[object.location] = { avatars: [], objects: [] };
      }
      locationMap[object.location].objects.push(object);
    });

    res.json(locationMap);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;