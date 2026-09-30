const Meter = require('../models/Meter');
const Unit = require('../models/Unit');

const DEFAULT_DEVICE = 'ESP32-001';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // Asia/Kolkata is UTC+05:30, no DST

// Start of today / Monday-week / month in IST, returned as real UTC Dates.
function periodStarts(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS); // shifted clock: UTC getters read IST
  const y = ist.getUTCFullYear(), m = ist.getUTCMonth(), d = ist.getUTCDate();
  const toUtc = (yy, mm, dd) => new Date(Date.UTC(yy, mm, dd) - IST_OFFSET_MS);
  const daysSinceMonday = (ist.getUTCDay() + 6) % 7;
  return {
    day: toUtc(y, m, d),
    week: toUtc(y, m, d - daysSinceMonday),
    month: toUtc(y, m, 1)
  };
}

async function sumUnits(deviceId, since) {
  const match = { deviceId };
  if (since) match.createdAt = { $gte: since };
  const [r] = await Unit.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$units' } } }]);
  return r ? r.total : 0;
}

// POST /api/set-reading  { deviceId?, reading, confirm? }
exports.setReading = async (req, res) => {
  try {
    const { deviceId = DEFAULT_DEVICE, reading, confirm = false } = req.body || {};
    const value = typeof reading === 'string' && reading.trim() !== '' ? Number(reading) : reading;

    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return res.status(400).json({ success: false, message: 'reading must be a number, 0 or greater' });
    }

    const meter = await Meter.findOne({ deviceId });
    if (meter && meter.readingSet && value < meter.currentReading && confirm !== true) {
      return res.status(409).json({
        success: false,
        requiresConfirmation: true,
        currentReading: meter.currentReading,
        message: `New reading ${value} is lower than the current reading ${meter.currentReading}. Send confirm: true to lower it.`
      });
    }

    const saved = await Meter.findOneAndUpdate(
      { deviceId },
      { $set: { currentReading: value, readingSet: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ success: true, deviceId, currentReading: saved.currentReading });
  } catch (err) {
    console.error('setReading:', err);
    res.status(500).json({ success: false, message: 'Failed to save reading' });
  }
};

// POST /api/get-unit  { deviceId, eventId? }  -- one completed unit (3200 pulses)
exports.receiveUnit = async (req, res) => {
  try {
    const { deviceId, eventId } = req.body || {};
    if (typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({ success: false, message: 'deviceId is required' });
    }
    if (eventId !== undefined && (typeof eventId !== 'string' || !eventId.trim())) {
      return res.status(400).json({ success: false, message: 'eventId must be a non-empty string' });
    }
    const id = deviceId.trim();

    try {
      await Unit.create({ deviceId: id, units: 1, ...(eventId ? { eventId } : {}) });
    } catch (err) {
      if (err.code === 11000) { // same eventId seen before: ack without incrementing
        const meter = await Meter.findOne({ deviceId: id });
        return res.status(200).json({ success: true, duplicate: true, currentReading: meter ? meter.currentReading : null });
      }
      throw err;
    }

    const meter = await Meter.findOneAndUpdate(
      { deviceId: id },
      { $inc: { currentReading: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true, deviceId: meter.deviceId, currentReading: meter.currentReading });
  } catch (err) {
    console.error('receiveUnit:', err);
    res.status(500).json({ success: false, message: 'Failed to record unit' });
  }
};

// GET /api/get-data?deviceId=ESP32-001
exports.getData = async (req, res) => {
  try {
    const deviceId = req.query.deviceId || DEFAULT_DEVICE;
    const starts = periodStarts();
    const [meter, todayUnits, weekUnits, monthUnits, totalMonitoredUnits, last] = await Promise.all([
      Meter.findOne({ deviceId }),
      sumUnits(deviceId, starts.day),
      sumUnits(deviceId, starts.week),
      sumUnits(deviceId, starts.month),
      sumUnits(deviceId),
      Unit.findOne({ deviceId }).sort({ createdAt: -1 })
    ]);

    res.status(200).json({
      success: true,
      deviceId,
      readingSet: !!(meter && meter.readingSet),
      currentMeterReading: meter ? meter.currentReading : 0,
      todayUnits,
      weekUnits,
      monthUnits,
      totalMonitoredUnits,
      lastUnitAt: last ? last.createdAt : null,
      lastUpdated: meter && meter.lastSeen ? meter.lastSeen.toISOString() : null,
      timezone: 'Asia/Kolkata'
    });
  } catch (err) {
    console.error('getData:', err);
    res.status(500).json({ success: false, message: 'Failed to load data' });
  }
};


// ===================== HEARTBEAT =====================
// ESP32 har 10 sec me ye call karega -> "main zinda hu" wala ping
exports.heartbeat = async (req, res) => {
	  try {
	  	    const { deviceId } = req.body;

	  	        if (!deviceId) {
	  	        	      return res.status(400).json({ ok: false, message: 'deviceId required' });
	  	        	          }

	  	        	              await Meter.findOneAndUpdate(
	  	        	              	      { deviceId },
	  	        	              	            { lastSeen: new Date() },
	  	        	              	                  { upsert: true, new: true }
	  	        	              	                      );

	  	        	              	                          return res.status(200).json({ ok: true });
	  	        	              	                            } catch (err) {
	  	        	              	                            	    console.error('Heartbeat error:', err.message);
	  	        	              	                            	        return res.status(500).json({ ok: false, message: 'Server error' });
	  	        	              	                            	          }
	  	        	              	                            	          };

	  	        	              	                            	          // ===================== DEVICE STATUS =====================
// ===================== DEVICE STATUS =====================
// Frontend ye call karega poll karke -> device online hai ya nahi check
exports.getDeviceStatus = async (req, res) => {
    try {
        const { deviceId } = req.params;

        const device = await Meter.findOne({ deviceId });

        if (!device || !device.lastSeen) {
            return res.status(200).json({
                online: false,
                lastSeen: null,
                secondsSinceLastSeen: null
            });
        }

        const secondsSinceLastSeen =
            (Date.now() - new Date(device.lastSeen).getTime()) / 1000;

        const online = secondsSinceLastSeen <= 12;

        return res.status(200).json({
            online,
            lastSeen: device.lastSeen,
            secondsSinceLastSeen: Math.floor(secondsSinceLastSeen)
        });

    } catch (err) {
        console.error('Device status error:', err.message);

        return res.status(500).json({
            online: false,
            message: 'Server error'
        });
    }
};

// Frontend ye call karega poll karke -> device online hai ya nahi check karne ke liye
