const mongoose = require('mongoose');

const meterSchema = new mongoose.Schema(
    {
        deviceId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        currentReading: {
            type: Number,
            default: 0,
            min: 0
        },

        readingSet: {
            type: Boolean,
            default: false
        },

        lastSeen: Date, // last ping ka timestamp

        status: String
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Meter', meterSchema);
