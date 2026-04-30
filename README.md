# Reservation Service

Sale Service — Reservation Module  
**Stack:** Node.js + Express + PostgreSQL + KafkaJS

---

## โครงสร้างไฟล์

```
reservation-service/
├── src/
│   ├── index.js                           # Entry point + Kafka + Expire cron
│   ├── db/index.js                        # PostgreSQL connection + migration
│   ├── kafka/index.js                     # Producer & Consumer
│   ├── routes/reservation.routes.js
│   ├── controllers/reservation.controller.js
│   └── services/reservation.service.js    # Business logic ทั้งหมด
├── .env.example
└── package.json
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reservations` | ดึง reservation ทั้งหมด (filter: customerId, propertyId, status) |
| GET | `/api/reservations/:id` | ดึงด้วย UUID หรือ reservation_id (RES-YYYYMMDD-XXXX) |
| POST | `/api/reservations` | สร้าง reservation ใหม่ (manual) |
| PATCH | `/api/reservations/:id/status` | อัปเดต status |
| PATCH | `/api/reservations/:id/payment-status` | อัปเดต first payment status |
| POST | `/api/reservations/expire` | Trigger ตรวจสอบ reservation หมดอายุ (manual) |
| GET | `/health` | Health check |

---

## Kafka Topics

| Direction | Topic | Description |
|-----------|-------|-------------|
| Subscribe | `sale.quotationcreated.complete` | สร้าง reservation อัตโนมัติหลัง quotation สำเร็จ |
| Subscribe | `marketing.advertisement.announced` | อัปเดต promotion ใน reservation ที่ active |
| Subscribe | `marketing.lead.created` | รับรู้ lead ใหม่ |
| Publish | `sale.reservationcreated.complete` | แจ้ง service อื่นว่า reservation ถูกสร้างแล้ว |

---

## Features พิเศษ

- **Auto-generate Reservation ID** รูปแบบ `RES-YYYYMMDD-0001`
- **Auto-expire** ตรวจสอบทุก 1 ชั่วโมง (ตั้งค่าวันหมดอายุผ่าน `RESERVATION_EXPIRE_DAYS`)
- **Lock Inventory** แจ้ง inventory service ให้ lock property ทันทีหลังสร้าง reservation

---

## วิธีรัน

```bash
npm install
cp .env.example .env
npm run dev
```

---

## ตัวอย่าง Request Body (POST /api/reservations)

```json
{
  "customerId": "CUST-001",
  "propertyId": "PROP-001",
  "projectName": "The Grand",
  "location": "Bangkok",
  "areaUnitLayout": "A1",
  "roomType": "2BR",
  "roomNumber": "101",
  "price": 5000000,
  "pricePerUnit": 100000,
  "bookingCost": 50000,
  "paymentAmount": 500000,
  "promotion": "PROMO-2026"
}
```
