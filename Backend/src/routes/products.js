const express = require('express');
const { pool } = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT pl.listing_id, pl.product_id, pl.client_id, pl.status, pl.listing_date, pl.listing_expires_at, pl.product_position,
             p.product_name, p.product_description, p.product_image_path, p.product_price, p.category_id,
             pc.category_name, c.username AS seller_username
      FROM product_listing pl
      JOIN product p ON p.product_id = pl.product_id
      JOIN product_category pc ON pc.category_id = p.category_id
      JOIN client c ON c.client_id = pl.client_id
      WHERE pl.status = 'avail'
      ORDER BY pl.product_position DESC, pl.listing_date DESC
    `);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const r = await pool.query(
      `SELECT pl.listing_id, pl.product_id, pl.client_id, pl.status,
               p.product_name, p.product_description, p.product_image_path, p.product_price, p.category_id,
               pc.category_name
       FROM product_listing pl
       JOIN product p ON p.product_id = pl.product_id
       JOIN product_category pc ON pc.category_id = p.category_id
       WHERE pl.listing_id = $1`,
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const { product_name, product_description, product_image_path, product_price, category_id } = req.body;
    if (!product_name || product_price == null || !category_id) {
      return res.status(400).json({ error: 'product_name, product_price, category_id required' });
    }
    const roleRes = await pool.query(
      'SELECT listing_priority FROM client_role WHERE client_role_id = $1',
      [req.user.client_role_id]
    );
    const priority = (roleRes.rows[0] && roleRes.rows[0].listing_priority) || 1;
    const productPosition = priority * 100;
    const productIns = await pool.query(
      `INSERT INTO product (product_name, product_description, product_image_path, product_price, category_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING product_id`,
      [product_name, product_description || null, product_image_path || null, product_price, category_id]
    );
    const product_id = productIns.rows[0].product_id;
    await pool.query(
      `INSERT INTO product_listing (product_id, client_id, product_position)
       VALUES ($1, $2, $3)`,
      [product_id, req.user.client_id, productPosition]
    );
    const listing = await pool.query(
      'SELECT listing_id, product_id, client_id, status, listing_date, listing_expires_at FROM product_listing WHERE product_id = $1 ORDER BY listing_id DESC LIMIT 1',
      [product_id]
    );
    res.status(201).json(listing.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id/buy', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid listing id' });
    const r = await pool.query(
      `UPDATE product_listing
       SET status = 'sold', buyer_id = $2, updated_at = NOW()
       WHERE listing_id = $1 AND status = 'avail'
       RETURNING listing_id, product_id, status, updated_at`,
      [id, req.user.client_id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Listing not found or already sold' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid listing id' });
    const { product_name, product_description, product_image_path, product_price, category_id } = req.body;
    const listing = await pool.query(
      'SELECT listing_id, product_id, client_id FROM product_listing WHERE listing_id = $1',
      [id]
    );
    if (listing.rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
    if (listing.rows[0].client_id !== req.user.client_id) return res.status(403).json({ error: 'Not your listing' });
    const product_id = listing.rows[0].product_id;
    await pool.query(
      `UPDATE product SET product_name = COALESCE($1, product_name), product_description = COALESCE($2, product_description),
        product_image_path = COALESCE($3, product_image_path), product_price = COALESCE($4, product_price),
        category_id = COALESCE($5, category_id), updated_at = NOW()
       WHERE product_id = $6`,
      [product_name ?? null, product_description ?? null, product_image_path ?? null, product_price ?? null, category_id ?? null, product_id]
    );
    const r = await pool.query(
      `SELECT pl.listing_id, pl.product_id, pl.client_id, pl.status,
               p.product_name, p.product_description, p.product_image_path, p.product_price, p.category_id,
               pc.category_name
       FROM product_listing pl
       JOIN product p ON p.product_id = pl.product_id
       JOIN product_category pc ON pc.category_id = p.category_id
       WHERE pl.listing_id = $1`,
      [id]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid listing id' });
    const listing = await pool.query(
      'SELECT listing_id, product_id, client_id FROM product_listing WHERE listing_id = $1',
      [id]
    );
    if (listing.rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
    if (listing.rows[0].client_id !== req.user.client_id) return res.status(403).json({ error: 'Not your listing' });
    const product_id = listing.rows[0].product_id;
    await pool.query('DELETE FROM product_listing WHERE listing_id = $1', [id]);
    await pool.query('DELETE FROM product WHERE product_id = $1', [product_id]);
    res.json({ message: 'Listing deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id/reinstate', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await pool.query(
      'SELECT listing_id, client_id, listing_reinstate_count FROM product_listing WHERE listing_id = $1 AND status = $2',
      [id, 'dormant']
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Dormant listing not found' });
    if (r.rows[0].client_id !== req.user.client_id) return res.status(403).json({ error: 'Not your listing' });
    if (r.rows[0].listing_reinstate_count >= 2) return res.status(400).json({ error: 'Reinstate limit reached' });
    await pool.query(
      `UPDATE product_listing SET status = 'avail', listing_expires_at = NOW() + INTERVAL '3 days',
       listing_reinstate_count = listing_reinstate_count + 1, updated_at = NOW() WHERE listing_id = $1`,
      [id]
    );
    res.json({ message: 'Listing reinstated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
