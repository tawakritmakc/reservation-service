require('dotenv').config();
const express = require('express');
const { initDB } = require('./db');
const { connectKafka, subscribeToTopics } = require('./kafka');
const {
  handleQuotationCreated,
  handleAdvertisementAnnounced,
  expireReservations,
} = require('./services/reservation.service');
const reservationRoutes = require('./routes/reservation.routes');

const app = express();
app.use(express.json());

// Routes
app.use('/api/reservations', reservationRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'reservation-service' }));

// Kafka event handler
const kafkaHandler = async (topic, payload) => {
  switch (topic) {
    case 'sale.quotationcreated.complete':
      await handleQuotationCreated(payload);
      break;
    case 'marketing.advertisement.announcement':
      await handleAdvertisementAnnounced(payload);
      break;
    case 'marketing.customer.created':
      // รับรู้ว่ามี lead ใหม่ (optional: log หรือ sync ข้อมูล)
      console.log('📌 New lead created:', payload);
      break;
    default:
      console.warn(`⚠️ Unhandled topic: ${topic}`);
  }
};

// Auto-expire reservations ทุก 1 ชั่วโมง
const startExpireCron = () => {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  setInterval(async () => {
    console.log('⏰ Running reservation expire check...');
    await expireReservations();
  }, INTERVAL_MS);
};

const start = async () => {
  try {
    await initDB();

    await connectKafka();
    await subscribeToTopics(
      ['sale.quotationcreated.complete', 'marketing.advertisement.announcement', 'marketing.customer.created'],
      kafkaHandler
    );

    startExpireCron();

    const PORT = process.env.PORT || 3002;
    app.listen(PORT, () => {
      console.log(`🚀 Reservation Service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start service:', err);
    process.exit(1);
  }
};

start();
