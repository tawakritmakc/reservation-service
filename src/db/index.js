const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reservation_id VARCHAR(50) UNIQUE NOT NULL,
        quotation_id VARCHAR(100),
        customer_id VARCHAR(100) NOT NULL,
        property_id VARCHAR(100) NOT NULL,
        project_name VARCHAR(255),
        location VARCHAR(255),
        area_unit_layout VARCHAR(100),
        room_type VARCHAR(100),
        room_number VARCHAR(50),
        price NUMERIC(15, 2),
        price_per_unit NUMERIC(15, 2),
        booking_cost NUMERIC(15, 2),
        payment_amount NUMERIC(15, 2),
        promotion VARCHAR(255),
        payment_first_status VARCHAR(50) DEFAULT 'PENDING',
        property_status VARCHAR(50) DEFAULT 'Reserved',
        status VARCHAR(50) DEFAULT 'ACTIVE',
        expire_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Database initialized');
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
