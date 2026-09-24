const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, trim: true },
    units: { type: Number, required: true, default: 1 },
    // Optional idempotency key. Sparse unique index: events without one are unaffected.
    eventId: { type: String, unique: true, sparse: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

unitSchema.index({ deviceId: 1, createdAt: -1 });

module.exports = mongoose.model('Unit', unitSchema);
