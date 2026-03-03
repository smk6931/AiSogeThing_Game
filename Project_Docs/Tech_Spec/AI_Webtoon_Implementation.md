# AI Webtoon Generation System Implementation Guide

## 1. System Architecture
The system is built on a **Modular Monolith** architecture, integrating a FastAPI backend with a React frontend and PostgreSQL database.

### Key Components:
- **Backend**: FastAPI (Python)
- **Frontend**: React (Vite)
- **Database**: PostgreSQL (Store novels, cuts, and status)
- **AI Engine**: Google Gemini 2.0 Flash (via LangChain/LangGraph)
- **Orchestration**: LangGraph (Stateful workflow management)

---

## 2. AI Generation Pipeline (LangGraph)
The core logic resides in `back/novel/langgraph_workflow.py`. It uses a **StateGraph** to manage the generation lifecycle.

### Workflow Steps (Nodes):
1.  **ScriptWriter**:
    -   Input: Topic/Prompt
    -   Action: Generates a full romance script in Korean using Gemini 2.0.
    -   Output: Script with `[Summary]` and `[Scene]` tags.
2.  **CoverDesigner**:
    -   Action: Generates a thumbnail image based on the topic.
    -   Output: Saves image to `static/generated/covers`.
3.  **CharacterDesigner**:
    -   Action: Analyzes the script to extract character visual descriptions.
    -   Output: JSON array of characters (Name, Visual Description in Korean).
4.  **CharacterImageGenerator**:
    -   Action: Generates profile images for each character.
    -   Output: Updates Character JSON with image paths.
5.  **SceneSplitter**:
    -   Action: Parses the script into individual scenes (cuts).
    -   Output: Creates `novel_cuts` records in DB (text only initially).
6.  **SceneImageGenerator**:
    - Action: Generates a high-quality single-panel webtoon illustration for each scene.
    - Feature: Injects character visual descriptions into prompts to maintain consistency.
    - Output: Updates `novel_cuts` with image paths.

---

## 3. Real-time Progress & Feedback
To provide a responsive UX without long loading times:
-   **Async Background Task**: The layout generation runs in a background thread via FastAPI `BackgroundTasks`.
-   **Incremental DB Updates**: Each node in the LangGraph workflow updates the database immediately upon completion.
-   **Frontend Polling**: The React client polls `GET /novel/{id}` every 2 seconds to reflect changes (Cover -> Script -> Characters -> Scenes) in real-time.

## 4. Error Handling & Rollback
-   **Failure State**: Any exception in the workflow triggers a catch block.
-   **Rollback**: The system automatically calls `delete_novel(id)` to remove partial data if generation fails, ensuring the user doesn't see broken states.
-   **Client-side Handling**: The frontend detects `404 Not Found` during polling (caused by rollback) and alerts the user before redirecting to the list.

## 5. Directory Structure
-   `back/novel/`: Domain-specific logic (Router, Service, Workflow).
-   `static/generated/`: Stores generated images (served via Nginx/FastAPI).
