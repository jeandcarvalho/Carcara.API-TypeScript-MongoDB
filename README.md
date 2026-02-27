# CarCará API 🦅🚗  
### Data Storage & Distribution Module

The **CarCará API** is the cloud distribution layer of the CarCará platform. It centralizes processed multimodal automotive acquisitions in **MongoDB** and provides a clean, query-driven interface for **search**, **media/dataset distribution**, **user collections**, and **LLM-based research evaluation**.

---

## 🧩 Architecture Context

CarCará is organized into three modules:

1. **Data Processing & Ingestion Module (Local Software)**  
   Validates acquisitions, enriches metadata (reverse geocode + manual labels), and pushes processed data to the cloud.

2. **Data Storage & Distribution Module (This API)**  
   Stores and exposes processed data through structured endpoints.

3. **View & Access Module (Website)**  
   A web UI that consumes the API for filtering, inspection, and downloads.

---

## 📦 What This API Provides

### 🔎 1) Multimodal Search (1 Hz dataset)
The API supports **scene-level filtering** over a unified 1 Hz dataset (`big_1hz`), allowing queries that combine:

- **Block-level metadata**: vehicle, weather period/condition  
- **CAN telemetry**: speed, steering wheel angle, brake status  
- **OSM/Overpass context**: highway class, landuse, lanes, maxspeed, oneway, surface, sidewalk, cycleway  
- **Semantic segmentation ratios**: building %, vegetation %, sidewalk-left/right %  
- **YOLO detections**: class, confidence range, distance range, relative position  

✅ **Important behavior:** the search endpoint **refuses full scans**. If no filters are provided, it returns **empty results** (by design).

---

### 🎥 2) Media & Dataset Distribution
CarCará assets are exposed at two levels:

#### A) Acquisition catalog (FilesProcessed)
The endpoint returns a high-level record describing what exists for each 5-minute acquisition block (datasets + cameras + context).

- CSV export  
- MF4 measurement file  
- IMU / Radar / OBD-II references  
- 6 camera views (front/rear: left/center/right)  
- 360 stitched view  
- reverse-geocoded fields (city/state/country/street)  
- manual classification labels (period, road type, traffic, weather, etc.)

#### B) Per-second assets (Links)
Per-second files are modeled as:

```json
{
  "acq_id": "string",
  "sec": 120,
  "ext": "avi|csv|mf4|blf|jpg|png|...",
  "link": "https://..."
}
