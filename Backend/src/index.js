require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./db/pool');
const path = require('path');

const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const servicesRoutes = require('./routes/services');
const miscRoutes = require('./routes/misc');
const adminRoutes = require('./routes/admin');
const uploadsRoutes = require('./routes/uploads');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/misc', miscRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadsRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

async function cleanupSoldProducts() {
  try {
    const delListings = await pool.query(
      `DELETE FROM product_listing
       WHERE status = 'sold' AND updated_at < NOW() - INTERVAL '3 days'
       RETURNING product_id`
    );
    const productIds = delListings.rows.map((r) => r.product_id);
    if (productIds.length > 0) {
      await pool.query(
        `DELETE FROM product p
         WHERE p.product_id = ANY($1)
           AND NOT EXISTS (SELECT 1 FROM product_listing pl WHERE pl.product_id = p.product_id)`,
        [productIds]
      );
    }
  } catch (e) {
    console.error('[cleanupSoldProducts] failed:', e.message);
  }
}

app.listen(PORT, () => {
  console.log(`MarketPlace API running at http://localhost:${PORT}`);
});

// Cleanup sold items after 3 days (runs on boot + every hour)
cleanupSoldProducts();
setInterval(cleanupSoldProducts, 60 * 60 * 1000);
