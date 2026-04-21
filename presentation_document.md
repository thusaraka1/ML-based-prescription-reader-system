# CareConnect: Smart Healthcare System
## Presentation Document & Technical Architecture

---

### 1. Project Overview
**CareConnect** is a fully mobile-responsive healthcare management application designed to bridge the gap between patients, caretakers, and administrators. Our system provides AI-powered prescription scanning, emotional wellness tracking, and comprehensive care management facilities under a single platform.

The primary goals of the system are:
- **Automation of Medical Processes:** Reducing manual entry errors via AI-powered prescription scanning.
- **Proactive Wellness Monitoring:** Using multimodal emotion detection (facial and vocal) to track resident wellness continuously.
- **Comprehensive Management:** Providing tailored, role-based access for Patients, Caretakers, and System Admins.

---

### 2. High-Level Architecture
CareConnect is built using a decoupled, modular, microservice-inspired architecture. We divided the system into **four independent modules** to ensure scalability, ease of maintenance, and isolated deployment lines:
1. **UI/UX Frontend**
2. **Emotion Detection (Edge ML)**
3. **Prescription Reader (Backend ML & AI Ensemble)**
4. **System Engine (Core Backend API)**

---

### 3. Technology Stack & Tools Used

#### Frontend (UI/UX)
- **Framework:** React 18 with TypeScript setup via Vite 6.
- **Styling UI:** Tailwind CSS 4, Radix UI (shadcn primitives) for building an aesthetic, accessible, and responsive user layout.
- **Data Visualization:** Recharts for emotional wellness trend tracking and analytics.
- **Edge Inference:** ONNX Runtime Web and TensorFlow.js for client-side ML operations without lagging the server.

#### Artificial Intelligence & Machine Learning (AI/ML)
- **Emotion Engine:** 
  - `face-api.js` for real-time facial expression tracking.
  - TensorFlow.js Speech Commands for vocal tone analysis.
- **Prescription Reader (The Ensemble Model):**
  - **Primary Model:** Custom Fine-tuned **Donut Model** (Swin Transformer Encoder + BART Decoder) via Python FastAPI. Trained specifically for reading handwritten text.
  - **Auxiliary Models:** Cloud-based **Gemini AI** for extremely complex/multi-page parsing, and **ONNX CRNN OCR** as a fast client-side fallback.

#### Backend System Engine
- **Framework:** Node.js with Express.js REST API.
- **Database:** MySQL for structured relational data mapping (Users, Prescriptions, Appointments, Leaves, etc.).
- **Authentication:** Firebase Auth and Firebase Admin SDK for robust JWT-based secure routing.

---

### 4. How We Built It (Module Breakdown)

#### 4.1 Frontend Development (UI/UX)
We focused heavily on the user experience, ensuring the application is fluid and responsive across desktop and mobile devices. We built **three role-based dashboards**:
- **Patient View:** Focuses on tracking own medications, appointments, and wellness graphs.
- **Caretaker View:** Designed for action. Enables managing multiple residents at once, uploading prescriptions on their behalf, and sending emergency alerts.
- **Admin View:** System oversight. Approves caretaker leave requests, tracks system diagnostics, and registers new members.

#### 4.2 Building the Emotion Detector
To implement proactive mental health tracking, we avoided forcing users to fill out surveys. Instead, our app leverages device hardware (webcams and microphones).
- We wrote a custom **EmotionAnalysisEngine** that orchestrates facial (face-api.js) and vocal (TF.js) inferences directly on the browser using WebAssembly/WebGL to preserve privacy (no raw video/audio leaves the device).
- This computes a live composite wellness score (0-100) and plots trend lines.

#### 4.3 Creating the Prescription Reader Ensemble
OCR on varied medical handwriting is notoriously difficult. Our solution leverages an **Ensemble Architecture**:
- Instead of relying on a single engine, we set up a multimodal workflow. We fine-tuned the `naver-clova-ix/donut-base` model using custom medical training data on a Python FastAPI server.
- The results from the Donut model are checked against the Gemini Vision AI API to cross-validate quantities and medicine names.
- We also integrated a fallback ONNX CRNN OCR for offline processing. An orchestrator on the frontend stitches the most confident outputs together into a structured JSON.

#### 4.4 Developing the System Engine
The backend was developed as a stateless Express.js REST server.
- Built a secure SQL schema to safely handle relational ties between residents and caretakers.
- Implemented robust error handling and JWT-based request gating through Firebase Admin.
- Included supplementary AI wrappers (e.g., AI meal plan generation for residents based on their health records).

---

### 5. Final Takeaways
By decoupling our architecture, CareConnect leverages the best technologies for the job where they fit best — utilizing lightweight React/Tailwind on the edge, robust Express/MySQL on the server, and heavy Python Transformers optimized for prescription translation. The outcome is a highly performant and secure healthcare aid.
