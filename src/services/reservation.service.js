const dayjs = require('dayjs');
const { pool } = require('../db');
const { publishEvent } = require('../kafka');
const axios = require('axios');

// Generate Reservation ID เช่น RES-20260430-0001
const generateReservationId = async () => {
  const dateStr = dayjs().format('YYYYMMDD');
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM reservations WHERE reservation_id LIKE $1`,
    [`RES-${dateStr}-%`]
  );
  const seq = String(Number(result.rows[0].count) + 1).padStart(4, '0');
  return `RES-${dateStr}-${seq}`;
};

// Lock inventory (แจ้ง inventory service ว่า property ถูก reserve)
const lockInventory = async (propertyId, reservationId) => {
  try {
    await axios.patch(`${process.env.INVENTORY_SERVICE_URL}/api/inventory/${propertyId}/status`, {
      status: 'Reserved',
      reservationId,
    });
    console.log(`🔒 Inventory locked: ${propertyId}`);
  } catch (err) {
    console.error('❌ Failed to lock inventory:', err.message);
  }
};

// ดึงข้อมูล inventory
const getInventoryData = async (propertyId) => {
  try {
    const res = await axios.get(`${process.env.INVENTORY_SERVICE_URL}/api/inventory/${propertyId}`);
    return res.data?.data || null;
  } catch (err) {
    console.error('❌ Failed to get inventory data:', err.message);
    return null;
  }
};

// ดึงข้อมูล marketing (promotion/campaign)
const getMarketingData = async (propertyId) => {
  try {
    const res = await axios.get(`${process.env.MARKETING_SERVICE_URL}/api/marketing`, {
      params: { propertyId },
    });
    return res.data?.data || null;
  } catch (err) {
    console.error('❌ Failed to get marketing data:', err.message);
    return null;
  }
};

// สร้าง Reservation
const createReservation = async (data) => {
  const {
    quotationId,
    customerId,
    propertyId,
    projectName,
    location,
    areaUnitLayout,
    roomType,
    roomNumber,
    price,
    pricePerUnit,
    bookingCost,
    paymentAmount,
    promotion,
  } = data;

  const reservationId = await generateReservationId();
  const expireDate = dayjs()
    .add(Number(process.env.RESERVATION_EXPIRE_DAYS || 30), 'day')
    .toDate();

  const result = await pool.query(
    `INSERT INTO reservations
      (reservation_id, quotation_id, customer_id, property_id, project_name, location,
       area_unit_layout, room_type, room_number, price, price_per_unit, booking_cost,
       payment_amount, promotion, expire_date, property_status, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'Reserved','ACTIVE')
     RETURNING *`,
    [
      reservationId, quotationId, customerId, propertyId, projectName, location,
      areaUnitLayout, roomType, roomNumber, price, pricePerUnit, bookingCost,
      paymentAmount, promotion, expireDate,
    ]
  );

  return result.rows[0];
};

// ดึง Reservation ทั้งหมด
const getReservations = async ({ customerId, propertyId, status } = {}) => {
  let query = 'SELECT * FROM reservations WHERE 1=1';
  const params = [];

  if (customerId) { params.push(customerId); query += ` AND customer_id = $${params.length}`; }
  if (propertyId) { params.push(propertyId); query += ` AND property_id = $${params.length}`; }
  if (status)     { params.push(status);     query += ` AND status = $${params.length}`; }

  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
};

// ดึง Reservation by ID
const getReservationById = async (id) => {
  const result = await pool.query(
    'SELECT * FROM reservations WHERE id = $1 OR reservation_id = $1',
    [id]
  );
  return result.rows[0] || null;
};

// อัปเดต status
const updateReservationStatus = async (id, status) => {
  const result = await pool.query(
    `UPDATE reservations SET status = $1, updated_at = NOW() WHERE id = $2 OR reservation_id = $2 RETURNING *`,
    [status, id]
  );
  return result.rows[0] || null;
};

// อัปเดต first payment status
const updateFirstPaymentStatus = async (id, paymentStatus) => {
  const result = await pool.query(
    `UPDATE reservations SET payment_first_status = $1, updated_at = NOW()
     WHERE id = $2 OR reservation_id = $2 RETURNING *`,
    [paymentStatus, id]
  );
  return result.rows[0] || null;
};

// ตรวจสอบ reservation ที่หมดอายุ
const expireReservations = async () => {
  const result = await pool.query(
    `UPDATE reservations SET status = 'EXPIRED', updated_at = NOW()
     WHERE status = 'ACTIVE' AND expire_date < NOW()
     RETURNING *`
  );
  if (result.rows.length > 0) {
    console.log(`⏰ Expired ${result.rows.length} reservation(s)`);
  }
  return result.rows;
};

// Handle Kafka: sale.quotationcreated.complete
const handleQuotationCreated = async (payload) => {
  const { customerId, propertyId, price, promotion } = payload;

  const [inventoryData, marketingData] = await Promise.all([
    getInventoryData(propertyId),
    getMarketingData(propertyId),
  ]);

  const reservation = await createReservation({
    quotationId: payload.id,
    customerId,
    propertyId,
    projectName: inventoryData?.projectName,
    location: inventoryData?.location,
    areaUnitLayout: inventoryData?.areaUnitLayout,
    roomType: inventoryData?.roomType,
    roomNumber: inventoryData?.roomNumber,
    price,
    pricePerUnit: inventoryData?.pricePerUnit,
    bookingCost: inventoryData?.bookingCost,
    paymentAmount: inventoryData?.paymentAmount,
    promotion: promotion || marketingData?.promotion,
  });

  // Lock inventory
  await lockInventory(propertyId, reservation.reservation_id);
// Publish sale.availableunit.completed → แจ้ง payment, inventory, marketing
await publishEvent('sale.availableunit.completed', {
  reservationId: reservation.reservation_id,
  customerId: reservation.customer_id,
  propertyId: reservation.property_id,
  projectName: reservation.project_name,
  price: reservation.price,
  pricePerUnit: reservation.price_per_unit,
  bookingCost: reservation.booking_cost,
  paymentAmount: reservation.payment_amount,
  promotion: reservation.promotion,
  propertyStatus: reservation.property_status,
  expireDate: reservation.expire_date,
  createdAt: reservation.created_at,
});

// Publish sale.reservationcreated.complete
  await publishEvent('sale.reservationcreated.complete', {
    reservationId: reservation.reservation_id,
    customerId: reservation.customer_id,
    propertyId: reservation.property_id,
    projectName: reservation.project_name,
    price: reservation.price,
    promotion: reservation.promotion,
    expireDate: reservation.expire_date,
    propertyStatus: reservation.property_status,
    status: reservation.status,
    createdAt: reservation.created_at,
  });

  return reservation;
};

// Handle Kafka: marketing.advertisement.announced
const handleAdvertisementAnnounced = async (payload) => {
  // อัปเดต promotion ใน reservation ที่ยังไม่หมดอายุ
  const { propertyId, promotion, campaign } = payload;
  await pool.query(
    `UPDATE reservations SET promotion = $1, updated_at = NOW()
     WHERE property_id = $2 AND status = 'ACTIVE'`,
    [promotion || campaign, propertyId]
  );
  console.log(`📢 Updated promotion for property ${propertyId}`);
};

module.exports = {
  createReservation,
  getReservations,
  getReservationById,
  updateReservationStatus,
  updateFirstPaymentStatus,
  expireReservations,
  handleQuotationCreated,
  handleAdvertisementAnnounced,
};
