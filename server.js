require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const unitRoutes = require('./routes/unitRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // open CORS: ESP32 and browsers on any origin
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', unitRoutes);

app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// JSON parse errors and anything unexpected
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON body' });
  }
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Energy Monitor running at http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start:', err.message);
    process.exit(1);
  }
}
start();
