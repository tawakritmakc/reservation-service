const express = require('express');
const router = express.Router();
const controller = require('../controllers/reservation.controller');

// GET /api/reservations
router.get('/', controller.getReservations);

// GET /api/reservations/:id
router.get('/:id', controller.getReservationById);

// POST /api/reservations
router.post('/', controller.createReservation);

// PATCH /api/reservations/:id/status
router.patch('/:id/status', controller.updateReservationStatus);

// PATCH /api/reservations/:id/payment-status
router.patch('/:id/payment-status', controller.updateFirstPaymentStatus);

// POST /api/reservations/expire
router.post('/expire', controller.expireReservations);

module.exports = router;
