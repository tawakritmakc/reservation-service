const reservationService = require('../services/reservation.service');

// GET /api/reservations
const getReservations = async (req, res) => {
  try {
    const { customerId, propertyId, status } = req.query;
    const data = await reservationService.getReservations({ customerId, propertyId, status });
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/reservations/:id
const getReservationById = async (req, res) => {
  try {
    const data = await reservationService.getReservationById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Reservation not found' });
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/reservations
const createReservation = async (req, res) => {
  try {
    const data = await reservationService.createReservation(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/reservations/:id/status
const updateReservationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'status is required' });
    const data = await reservationService.updateReservationStatus(req.params.id, status);
    if (!data) return res.status(404).json({ success: false, message: 'Reservation not found' });
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/reservations/:id/payment-status
const updateFirstPaymentStatus = async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    if (!paymentStatus) return res.status(400).json({ success: false, message: 'paymentStatus is required' });
    const data = await reservationService.updateFirstPaymentStatus(req.params.id, paymentStatus);
    if (!data) return res.status(404).json({ success: false, message: 'Reservation not found' });
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/reservations/expire (trigger manual expire check)
const expireReservations = async (req, res) => {
  try {
    const expired = await reservationService.expireReservations();
    res.json({ success: true, expiredCount: expired.length, data: expired });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getReservations,
  getReservationById,
  createReservation,
  updateReservationStatus,
  updateFirstPaymentStatus,
  expireReservations,
};
