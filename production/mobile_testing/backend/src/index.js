require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { pool } = require('./db/pool');

const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const servicesRoutes = require('./routes/services');
const miscRoutes = require('./routes/misc');
const adminRoutes = require('./routes/admin');
const uploadsRoutes = require('./routes/uploads');
const paymentRoutes = require('./routes/payment');
const messagesRoutes = require('./routes/messages');
const pushTokenRoutes = require('./routes/push-token');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
// Webhook must receive raw body for signature verification; register before express.json()
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  paymentRoutes.handleWebhook(req, res).catch(next);
});
app.use(express.json());

const uploadsDir = path.join(__dirname, '../uploads');
const thumbDir = path.join(uploadsDir, 'thumb');
const THUMB_MAX = 400;

fs.mkdirSync(thumbDir, { recursive: true });

// Generate thumbnail on-the-fly for existing images that don't have a thumb yet
app.get('/uploads/thumb/:basename.jpg', async (req, res) => {
  const basename = req.params.basename;
  const thumbPath = path.join(thumbDir, `${basename}.jpg`);
  if (fs.existsSync(thumbPath)) {
    return res.sendFile(thumbPath);
  }
  const uploadsDirContents = fs.readdirSync(uploadsDir, { withFileTypes: true });
  const original = uploadsDirContents.find(
    (e) => e.isFile() && path.basename(e.name, path.extname(e.name)) === basename
  );
  if (!original) {
    return res.status(404).end();
  }
  const originalPath = path.join(uploadsDir, original.name);
  try {
    await sharp(originalPath)
      .resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(thumbPath);
    res.sendFile(thumbPath);
  } catch (err) {
    console.error('[thumb] generate failed:', err.message);
    res.status(500).end();
  }
});

app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/misc', miscRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/push-token', pushTokenRoutes);

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

// Conversations are automatically deleted after 7 days from message creation
async function cleanupOldMessages() {
  try {
    const r = await pool.query(
      `DELETE FROM message WHERE created_at < NOW() - INTERVAL '7 days'`
    );
    const count = r.rowCount ?? 0;
    if (count > 0) console.log(`[cleanupOldMessages] deleted ${count} message(s) older than 7 days`);
  } catch (e) {
    console.error('[cleanupOldMessages] failed:', e.message);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MarketPlace API running at http://localhost:${PORT}`);
  console.log(`  Network: http://<this-machine-ip>:${PORT}`);
});

// Cleanup sold items after 3 days (runs on boot + every hour)
cleanupSoldProducts();
setInterval(cleanupSoldProducts, 60 * 60 * 1000);
// Conversations auto-delete after 7 days (runs on boot + every hour)
cleanupOldMessages();
setInterval(cleanupOldMessages, 60 * 60 * 1000);
