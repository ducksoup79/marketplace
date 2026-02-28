const express = require('express');
const { pool } = require('../db/pool');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken, requireAdmin);

const TABLE_WHITELIST = [
  'currency', 'location', 'client_role', 'client', 'product_category', 'product',
  'product_listing', 'service', 'service_listing', 'advert_list', 'error_report',
];

function getPkCol(table) {
  const map = {
    product_listing: 'listing_id', service_listing: 'service_listing_id',
    advert_list: 'advert_list_id', error_report: 'report_id',
    product_category: 'category_id',
  };
  return map[table] || `${table.replace(/s$/, '')}_id`;
}

router.get('/dashboard', async (req, res) => {
  try {
    const [clients, products, services, reports] = await Promise.all([
      pool.query('SELECT COUNT(*) AS n FROM client'),
      pool.query('SELECT COUNT(*) AS n FROM product_listing'),
      pool.query('SELECT COUNT(*) AS n FROM service'),
      pool.query('SELECT COUNT(*) AS n FROM error_report WHERE resolved = FALSE'),
    ]);
    res.json({
      clients: parseInt(clients.rows[0].n, 10),
      product_listings: parseInt(products.rows[0].n, 10),
      services: parseInt(services.rows[0].n, 10),
      unresolved_reports: parseInt(reports.rows[0].n, 10),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/tables', (req, res) => {
  res.json(TABLE_WHITELIST);
});

router.get('/tables/:table', async (req, res) => {
  const table = req.params.table;
  if (!TABLE_WHITELIST.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  try {
    const r = await pool.query(`SELECT * FROM ${table} LIMIT 500`);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tables/:table', async (req, res) => {
  const table = req.params.table;
  if (!TABLE_WHITELIST.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  const body = req.body || {};
  const keys = Object.keys(body);
  if (keys.length === 0) return res.status(400).json({ error: 'No fields provided' });
  const cols = keys.join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  try {
    const r = await pool.query(
      `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`,
      keys.map((k) => body[k])
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/tables/:table/:id', async (req, res) => {
  const table = req.params.table;
  const id = req.params.id;
  if (!TABLE_WHITELIST.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  const body = req.body || {};
  const keys = Object.keys(body);
  if (keys.length === 0) return res.status(400).json({ error: 'No fields provided' });
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const pkCol = getPkCol(table);
  try {
    const r = await pool.query(
      `UPDATE ${table} SET ${setClause} WHERE ${pkCol} = $${keys.length + 1} RETURNING *`,
      [...keys.map((k) => body[k]), id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/tables/:table/:id', async (req, res) => {
  const table = req.params.table;
  const id = req.params.id;
  if (!TABLE_WHITELIST.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  const pkCol = getPkCol(table);
  try {
    const r = await pool.query(`DELETE FROM ${table} WHERE ${pkCol} = $1 RETURNING *`, [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
