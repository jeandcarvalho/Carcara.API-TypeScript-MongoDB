# CarCará API 🦅🚗
**Data Storage & Distribution Module**

The CarCará API is responsible for storing and distributing automotive data processed by the local Data Processing & Ingestion Module.  
It exposes structured endpoints consumed by the CarCará Website (View & Access Module).

---

## 🧠 System Context

CarCará is structured in three modules:

1. **Data Processing & Ingestion Module (Local Software)**
2. **Data Storage & Distribution Module (This API)**
3. **View & Access Module (Website)**

The API acts as a cloud-based bridge between processed acquisitions and end users.

Each acquisition represents a **5-minute data block**, containing:

- File metadata (FileName, Timestamp)
- GPS coordinates
- Sensor data (IMU, radar, OBD-II)
- Camera references (6 cameras + 360 view)
- Contextual classifications (city, road type, traffic, weather, etc.)
- Cloud links for datasets and videos

---

## ⚙️ Tech Stack

- **Node.js**
- **TypeScript**
- **Fastify**
- **Prisma ORM**
- **MongoDB (Cloud / Atlas)**
- Deployment: **Render.com**

---
