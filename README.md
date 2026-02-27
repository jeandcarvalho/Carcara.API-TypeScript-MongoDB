CarCará API 🦅🚗
Data Storage & Distribution Module

The CarCará API is the cloud-based distribution layer of the CarCará platform.
It centralizes processed multimodal automotive data in MongoDB and exposes structured endpoints for search, file access, collections, authentication, and research workflows (LLM-based evaluation).

This API connects:

Data Processing & Ingestion Module (Local Software)

Data Storage & Distribution Module (This API)

View & Access Module (Web Platform)

🧠 System Overview

Each acquisition in CarCará represents a 5-minute automotive data block, composed of:

GPS coordinates

CAN telemetry

IMU / Radar / OBD-II data

6 synchronized cameras + 360 stitched view

Semantic segmentation (1 Hz)

YOLO detections (1 Hz)

OSM / Overpass map context

Reverse geocoded metadata

Dataset exports (CSV, MF4, etc.)

Downloadable per-second assets

The API provides structured and filtered access to all these layers.

🚀 Core Capabilities
1️⃣ Advanced Multimodal Search

The API enables rich filtering over the main 1 Hz dataset (big_1hz).

Supported Filter Domains
Domain	Description
Vehicle	Captur, Renegade, DAF, etc.
CAN Telemetry	Speed, steering wheel angle, brake status
YOLO	Object class, confidence range, distance range
Map Context	Highway class, landuse, lanes, maxspeed
Semantic Segmentation	Building %, vegetation %, sidewalk
Meteorological	Weather period / condition
Range Query Support

Range filters use min..max syntax:

c.v=10..30
y.dist_m=5..25
y.conf=0.6..1.0

Multiple ranges supported (OR behavior):

c.swa=-10..-5,5..10

Comma-separated lists are supported for categorical filters:

y.class=car,truck,person
b.vehicle=Captur,Renegade
2️⃣ Acquisition-Level Distribution

Endpoint:

GET /api/acquisition

Returns:

All matching seconds of one acquisition

Associated links (videos, CSV, MF4, etc.)

Per-second assets

YOLO detections

CAN telemetry

Designed for detailed exploration and dataset extraction.

3️⃣ File & Media Distribution 📦🎥

Two levels of file access:

A) Acquisition Catalog Layer (FilesProcessed)

Endpoint:

GET /videofiles

Returns high-level acquisition records containing:

CSV export

MF4 file

IMU

Radar

OBII

Front cameras (Left / Center / Right)

Rear cameras (Left / Center / Right)

360 stitched view

Reverse geocoding metadata

Manual classification labels

This allows the Website to render what assets exist for a 5-minute block.

B) Per-Second Links (links)

Each second may contain downloadable assets:

Model:

{
  acq_id,
  sec,
  ext,
  link
}

Common file types:

avi (camera video segments)

csv

mf4

blf

jpg / png (per-second images)

This enables moment-level extraction.

4️⃣ User Authentication 🔐

JWT-based authentication.

Routes
POST /auth/register
POST /auth/login
GET  /auth/me

Protected routes require:

Authorization: Bearer <token>

Environment variable:

JWT_SECRET
5️⃣ Collections (Moment Bookmarking) 📌

Users can store specific moments using:

acq_id

sec

Routes
GET    /collections
POST   /collections
DELETE /collections/:id
GET    /collections/:collectionId/items
POST   /collections/:collectionId/items/add
POST   /collections/:collectionId/items/remove
GET    /collections/:collectionId/seconds-with-links

This supports:

Dataset curation

LLM evaluation workflows

Research scenario grouping

6️⃣ LLM Experimentation & Evaluation 🤖📊

The API includes structured support for storing and evaluating LLM-based scene interpretation.

LLM Results

Stored fields:

collectionId

acq_id

center_sec

secs[]

test_name

llm_model

prompt_type

prompt

answer

tokens

latency_ms

Routes:

GET    /api/llm/tests/:collectionId
GET    /api/llm/test-docs/:collectionId
DELETE /api/llm/tests/:collectionId
LLM Evaluation (Scoring 0–5)

Routes:

POST /api/llm/eval
GET  /api/llm/eval
GET  /public/llmresult/context

Used for benchmarking interpretability and traffic rule reasoning.

🗄 Data Architecture
Collections
FilesProcessed

High-level acquisition metadata + links.

big_1hz

1 Hz multimodal structured dataset:

acq_id
sec
block
can
laneego
overpass
semseg
yolo[]
links[]
links

Explicit file references per second.

Users & Collections

User authentication and bookmarking.

LLMResult / LLMTestEval

Research-oriented evaluation storage.

📊 Example Search Request
GET /api/search?b.vehicle=Captur&c.v=20..50&y.class=car,truck&o.highway=primary

Response (simplified):

{
  "acq_id": 105,
  "representative_seconds": [
    {
      "sec": 45,
      "links": [...]
    }
  ]
}
🧩 Technology Stack

Node.js

TypeScript

Fastify

Prisma ORM

MongoDB Atlas

JWT Authentication

Render Deployment

🌐 Deployment

Default server:

port: 8080
host: 0.0.0.0

Environment variables recommended:

DATABASE_URL=
JWT_SECRET=
NODE_ENV=production
🔬 Research & Engineering Focus

The CarCará API is designed for:

Multimodal automotive dataset distribution

Scene-level semantic search

Per-second asset retrieval

LLM-driven traffic reasoning experiments

Structured collection-based evaluation

It bridges raw automotive acquisition and intelligent interpretation systems.
