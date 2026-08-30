# MentalWelfare - Complete Project Context & Architecture Documentation

## 1. Project Overview & Problem Statement
**MentalWelfare** is an AI-powered, highly secure mental health support platform designed specifically for the Indian Armed Forces and Central Armed Police Forces (CAPF). 

### The Crisis
Forces face severe operational stress, prolonged deployments, isolation, and domestic tensions, leading to tragic spikes in **suicide and fratricide**. The military environment highly stigmatizes mental health issues, preventing personnel from seeking help. Medical officers currently lack an early-warning system and only react *after* a catastrophic event.

### The Solution
MentalWelfare provides a totally anonymous, AI-driven "squadmate" where personnel can vent frustrations via voice or text. The system provides real-time, empathetic grounding, while a neural network silently evaluates morale trajectories in the background. It only alerts command/medical officers when a soldier reaches a statistical crisis point, enabling proactive, life-saving intervention without breaking everyday trust.

---

## 2. Technical Stack & Standalone Architecture
The platform is packaged as a **Fully Standalone Desktop Executable (.exe)** for Windows, meaning it requires zero installation, no `.env` setup, and bundles the Node.js runtime, Python ML backend, and database bindings directly into one 160MB binary.

### Core Stack
* **Client Interface:** PyWebView running Edge WebView2 (Native Windows Desktop App).
* **Frontend:** Next.js (Standalone build), React 19, TypeScript, Tailwind CSS, shadcn/ui.
* **Backend:** FastAPI (Python 3) for ML microservices, Next.js API Routes (Node.js).
* **Database:** Neon PostgreSQL (Cloud DB) accessed via Prisma ORM. Local JSON-based Vector DB for RAG.
* **Security & Auth:** Google OAuth 2.0 (native account chooser), JWT.

---

## 3. The Custom Machine Learning & AI Pipeline
The AI pipeline runs **100% locally** inside the application. No data is sent to external API providers like OpenAI, ensuring absolute military data sovereignty and compliance.

### A. The Custom LLM (135M Parameter Causal LLM)
We built and fine-tuned a custom **135 Million Parameter LLaMA-architecture model** from scratch/base specifically for this project. 
* **Training Focus:** Empathetic active listening, trauma de-escalation, and grounding techniques.
* **Performance:** Highly optimized to run on standard CPU laptops without requiring heavy GPUs, making it deployable on standard military-issue hardware.

### B. DistilBERT Intent Router
Before the LLM generates a response, the user's input is classified by a fine-tuned DistilBERT transformer. It categorizes the input into three risk states:
1. **JOY / NORMAL:** Routine operational stress or venting.
2. **TRIAGE:** Severe frustration, anger (potential fratricide indicators), or deep depression.
3. **EMERGENCY:** Active self-harm language or imminent threat.

### C. Retrieval-Augmented Generation (RAG)
Using the **MiniLM-L6-v2** SentenceTransformer, the system matches the user's distress signals against a local vector database of standardized clinical protocols. These protocols are injected directly into the LLM's context window so it responds with medically sound advice during crises.

### D. Multi-Modal Voice Journaling
* **Speech-to-Text (STT):** Local **Whisper** models transcribe the soldier's spoken audio into text.
* **Text-to-Speech (TTS):** **Edge-TTS** generates a soothing, human-like voice for the AI companion.
* **Processing:** Bundled **FFmpeg** binaries handle audio conversions instantly on-device.

### E. VADER Sentiment Scoring
Produces a "Micro Lexical Score" to track sudden drops in morale, which feeds into the user's aggregate risk profile.

---

## 4. User and Admin Workflows

### The Soldier (User) Flow
1. **Access:** The Jawan opens the `MentalWelfare.exe` and authenticates via Google OAuth. 
2. **Journaling:** They use the "Voice Journal" or text chat to discuss their day, operational stress, or family issues.
3. **AI Support:** The Custom LLM acts as an empathetic listener, providing psychological first-aid.
4. **Crisis Interception:** If the user types "I can't take this anymore, I'm going to use my rifle," the DistilBERT router flags **EMERGENCY**, bypasses normal chatter, and initiates grounding protocols while alerting the backend.
5. **Assessments:** The user can take optional clinical tests (PHQ-9 for Depression, GAD-7 for Anxiety).

### The Medical Officer (Admin) Flow
1. **Access:** Secure RBAC (Role-Based Access Control) login into the Admin Dashboard.
2. **Anonymized Telemetry:** The Admin sees battalion-wide morale trends (e.g., "Platoon C has a 40% drop in morale this week").
3. **Risk Matrix:** Individual journals are hidden to protect privacy, but the dashboard highlights specific "Risk IDs" when their trajectory hits critical.
4. **Intervention:** The Medical Officer verifies the SOS alert and can deploy physical intervention, mandate a psychiatric evaluation, or recommend leave approval.

---

## 5. Security & Privacy Architecture
Due to the sensitive nature of military personnel data, privacy is enforced at the cryptographic level.

* **Military-Grade Encryption:** All text journals are encrypted at rest using **AES-256-GCM**.
* **Identity Protection:** IP addresses and network identifiers are salted and hashed using **Argon2 / scrypt**. 
* **Zero-Knowledge Design:** The command structure cannot read a soldier's daily complaints unless the AI's statistical threshold triggers a severe clinical emergency, balancing extreme privacy with life-saving intervention.
* **Local Processing:** The heaviest data processing (intent classification, sentiment scoring, and LLM generation) happens entirely on the local device, minimizing the payload sent over the network to the central DB.
