const express = require('express');
const { pool } = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/locations', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT location_id, location_name, currency_id, location_lat, location_long, location_radius FROM location ORDER BY location_name'
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/roles', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT client_role_id, client_role, sub_price, listing_priority FROM client_role ORDER BY listing_priority'
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT category_id, category_name FROM product_category ORDER BY category_name'
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/report-error', verifyToken, async (req, res) => {
  try {
    const { subject, description } = req.body;
    if (!description) return res.status(400).json({ error: 'description required' });
    await pool.query(
      'INSERT INTO error_report (client_id, subject, description) VALUES ($1, $2, $3)',
      [req.user.client_id, subject || null, description]
    );
    res.status(201).json({ message: 'Report submitted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
