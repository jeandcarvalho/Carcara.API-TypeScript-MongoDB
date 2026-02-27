# CarCará API 🦅🚗

### Data Storage & Distribution Module

The **CarCará API** is the cloud distribution layer of the CarCará
platform. It centralizes processed multimodal automotive acquisitions in
**MongoDB** and provides a clean, query-driven interface for **search**,
**media/dataset distribution**, **user collections**, and **LLM-based
research evaluation**.

------------------------------------------------------------------------

## 🧩 Architecture Context

CarCará is organized into three modules:

1.  **Data Processing & Ingestion Module (Local Software)**\
    Validates acquisitions, enriches metadata (reverse geocode + manual
    labels), and pushes processed data to the cloud.

2.  **Data Storage & Distribution Module (This API)**\
    Stores and exposes processed data through structured endpoints.

3.  **View & Access Module (Website)**\
    A web UI that consumes the API for filtering, inspection, and
    downloads.

------------------------------------------------------------------------

## 📦 What This API Provides

### 🔎 Multimodal Search (1 Hz dataset)

The API supports scene-level filtering over a unified 1 Hz dataset
(`big_1hz`), allowing queries that combine:

-   Vehicle metadata
-   CAN telemetry (speed, steering, brake state)
-   OSM / Overpass road context
-   Semantic segmentation ratios
-   YOLO detections (class, confidence, distance)

Range queries use `min..max` syntax:

    c.v=10..30
    y.conf=0.6..1.0
    y.dist_m=5..25

Comma-separated lists are supported:

    y.class=car,truck,person
    b.vehicle=Captur,Renegade

The search endpoint intentionally prevents full database scans. If no
filters are provided, it returns empty results.

------------------------------------------------------------------------

### 🎥 Media & Dataset Distribution

Assets are exposed at two levels.

#### Acquisition Catalog (FilesProcessed)

Includes:

-   CSV export
-   MF4 measurement file
-   IMU / Radar / OBD-II references
-   6 camera views
-   360° stitched view
-   Reverse-geocoded metadata
-   Manual classification labels

Endpoint:

    GET /videofiles

------------------------------------------------------------------------

#### Per-Second Assets (Links)

Each second may include downloadable assets:

``` json
{
  "acq_id": "string",
  "sec": 120,
  "ext": "avi|csv|mf4|blf|jpg|png",
  "link": "https://..."
}
```

Supported formats include:

-   AVI (video segments)
-   CSV (structured exports)
-   MF4 (measurement files)
-   BLF (binary logs)
-   JPG / PNG (per-second images)

------------------------------------------------------------------------

## 👤 Authentication (JWT)

    POST /auth/register
    POST /auth/login
    GET  /auth/me

Protected routes require:

    Authorization: Bearer <token>

Environment variable:

    JWT_SECRET

------------------------------------------------------------------------

## 📁 Collections

Allows users to store specific moments (`acq_id + sec`) into curated
scenario groups.

    GET    /collections
    POST   /collections
    DELETE /collections/:id
    POST   /collections/:collectionId/items/add
    POST   /collections/:collectionId/items/remove
    GET    /collections/:collectionId/seconds-with-links

------------------------------------------------------------------------

## 🤖 LLM Experiment Support

Stores structured LLM test results and evaluation scores.

    GET    /api/llm/tests/:collectionId
    GET    /api/llm/test-docs/:collectionId
    DELETE /api/llm/tests/:collectionId
    POST   /api/llm/eval
    GET    /api/llm/eval
    GET    /public/llmresult/context

------------------------------------------------------------------------

## 🗄 Data Model Overview

Main collections:

-   FilesProcessed
-   big_1hz
-   links
-   User
-   Collection
-   LLMResult
-   LLMTestEval

------------------------------------------------------------------------

## 🛠 Tech Stack

-   Node.js
-   TypeScript
-   Fastify
-   Prisma ORM
-   MongoDB Atlas
-   JWT Authentication

------------------------------------------------------------------------

## 🚀 Deployment

Default server configuration:

-   Host: 0.0.0.0
-   Port: 8080

Environment variables:

    DATABASE_URL=
    JWT_SECRET=
    NODE_ENV=production

------------------------------------------------------------------------

## 🎯 Purpose

The CarCará API enables:

-   Structured multimodal automotive dataset distribution
-   Scene-level semantic filtering
-   Per-second asset retrieval
-   Collection-based scenario curation
-   LLM-based traffic reasoning experiments

It transforms processed acquisitions into a scalable and research-ready
distribution infrastructure.
