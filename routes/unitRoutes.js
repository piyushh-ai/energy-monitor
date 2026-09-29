const express = require('express');
const c = require('../controllers/unitController');

const router = express.Router();
router.post('/set-reading', c.setReading);
router.post('/get-unit', c.receiveUnit);
router.get('/get-data', c.getData);
router.post('/heartbeat', c.heartbeat);
router.get('/device-status/:deviceId', c.getDeviceStatus);

module.exports = router;
