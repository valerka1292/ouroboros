"""
Ouroboros Web Server — FastAPI backend.
Replaces colab_launcher.py and supervisor.telegram.
"""

import os
import sys
import uuid
import time
import json
import logging
import pathlib
import datetime
import threading
import queue as _queue_mod
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Ensure repo root is in sys.path
REPO_DIR = pathlib.Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(REPO_DIR))

# Default paths (migration from /content for local use)
DRIVE_ROOT = pathlib.Path(os.environ.get("OUROBOROS_DRIVE_ROOT", REPO_DIR / "data")).resolve()

# Pre-create directories
for sub in ["state", "logs", "memory", "index", "locks", "archive", "task_results"]:
    (DRIVE_ROOT / sub).mkdir(parents=True, exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(DRIVE_ROOT / "logs" / "server.log", encoding="utf-8"),
    ]
)
log = logging.getLogger("ouroboros.server")

# ---------------------------------------------------------------------------
# Initialize Ouroboros Supervisor
# ---------------------------------------------------------------------------
from supervisor.state import init as state_init, load_state, save_state, append_jsonl, init_state, update_budget_from_usage
from supervisor.git_ops import init as git_ops_init, ensure_repo_present
from supervisor.queue import restore_pending_from_snapshot, persist_queue_snapshot, enqueue_task, enforce_task_timeouts, enqueue_evolution_task_if_needed
from supervisor.workers import init as workers_init, spawn_workers, kill_workers, assign_tasks, ensure_workers_healthy, get_event_q
from supervisor.events import dispatch_event
from ouroboros.consciousness import BackgroundConsciousness

# Standard config (formerly in colab_launcher.py)
TOTAL_BUDGET_LIMIT = float(os.environ.get("LLM_TOTAL_BUDGET", "10.0"))
MAX_WORKERS = int(os.environ.get("OUROBOROS_MAX_WORKERS", "5"))
SOFT_TIMEOUT_SEC = int(os.environ.get("OUROBOROS_SOFT_TIMEOUT_SEC", "600"))
HARD_TIMEOUT_SEC = int(os.environ.get("OUROBOROS_HARD_TIMEOUT_SEC", "1800"))
BRANCH_DEV = os.environ.get("OUROBOROS_BRANCH_DEV", "ouroboros")
BRANCH_STABLE = os.environ.get("OUROBOROS_BRANCH_STABLE", "ouroboros-stable")

state_init(DRIVE_ROOT, TOTAL_BUDGET_LIMIT)
init_state()

git_ops_init(
    repo_dir=REPO_DIR, drive_root=DRIVE_ROOT, 
    remote_url="", # Local mode: no automatic remote sync for now
    branch_dev=BRANCH_DEV, branch_stable=BRANCH_STABLE,
)

workers_init(
    repo_dir=REPO_DIR, drive_root=DRIVE_ROOT, max_workers=MAX_WORKERS,
    soft_timeout=SOFT_TIMEOUT_SEC, hard_timeout=HARD_TIMEOUT_SEC,
    total_budget_limit=TOTAL_BUDGET_LIMIT,
    branch_dev=BRANCH_DEV, branch_stable=BRANCH_STABLE,
)

app = FastAPI(title="Ouroboros API")

# ---------------------------------------------------------------------------
# Background Infrastructure
# ---------------------------------------------------------------------------

_consciousness = BackgroundConsciousness(
    drive_root=DRIVE_ROOT,
    repo_dir=REPO_DIR,
    event_queue=get_event_q(),
    owner_chat_id_fn=lambda: 1001, # Dummy ID for web mode
)

_event_ctx = type('obj', (object,), {
    'DRIVE_ROOT': DRIVE_ROOT,
    'REPO_DIR': REPO_DIR,
    'BRANCH_DEV': BRANCH_DEV,
    'BRANCH_STABLE': BRANCH_STABLE,
    'WORKERS': {}, # Populated by supervisor.workers
    'PENDING': [], # Populated by supervisor.workers
    'RUNNING': {}, # Populated by supervisor.workers
    'MAX_WORKERS': MAX_WORKERS,
    'update_budget_from_usage': update_budget_from_usage,
    'load_state': load_state,
    'save_state': save_state,
    'append_jsonl': append_jsonl,
    'enqueue_task': enqueue_task,
    'persist_queue_snapshot': persist_queue_snapshot,
    'kill_workers': kill_workers,
    'spawn_workers': spawn_workers,
    'consciousness': _consciousness,
})

def supervisor_loop():
    """Main supervisor loop, formerly in colab_launcher.py."""
    log.info("Supervisor loop started")
    _consciousness.start()
    
    # Register supervisor structures in ctx
    from supervisor.workers import WORKERS, PENDING, RUNNING
    _event_ctx.WORKERS = WORKERS
    _event_ctx.PENDING = PENDING
    _event_ctx.RUNNING = RUNNING

    while True:
        try:
            ensure_workers_healthy()
            
            # Drain worker events
            event_q = get_event_q()
            while True:
                try:
                    evt = event_q.get_nowait()
                    dispatch_event(evt, _event_ctx)
                except _queue_mod.Empty:
                    break

            enforce_task_timeouts()
            enqueue_evolution_task_if_needed()
            assign_tasks()
            persist_queue_snapshot(reason="server_loop")
            
            time.sleep(1.0)
        except Exception:
            log.exception("Error in supervisor_loop")
            time.sleep(5.0)

# Background threads and processes will be started in if __name__ == "__main__" block below

# ---------------------------------------------------------------------------
# API Models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    text: str

# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@app.get("/api/status")
async def get_status():
    st = load_state()
    from supervisor.workers import WORKERS, PENDING, RUNNING
    return {
        "version": st.get("version", "v6.2.0"),
        "spent_usd": st.get("spent_usd", 0.0),
        "total_budget": TOTAL_BUDGET_LIMIT,
        "workers_alive": sum(1 for w in WORKERS.values() if w.proc.is_alive()),
        "pending_tasks": len(PENDING),
        "running_tasks": len(RUNNING),
        "evolution_enabled": st.get("evolution_mode_enabled", False),
        "consciousness_running": _consciousness.is_running
    }

@app.post("/api/chat")
async def post_chat(req: ChatRequest):
    task = {
        "id": uuid.uuid4().hex[:8],
        "type": "task",
        "chat_id": 1001,
        "text": req.text,
    }
    enqueue_task(task)
    return {"task_id": task["id"], "status": "queued"}

@app.get("/api/logs/events")
async def get_event_logs():
    path = DRIVE_ROOT / "logs" / "events.jsonl"
    if not path.exists():
        return {"logs": []}
    lines = path.read_text(encoding="utf-8").strip().split("\n")
    return {"logs": [json.loads(ln) for ln in lines[-100:]]}

@app.get("/api/logs/supervisor")
async def get_supervisor_logs():
    path = DRIVE_ROOT / "logs" / "supervisor.jsonl"
    if not path.exists():
        return {"logs": []}
    lines = path.read_text(encoding="utf-8").strip().split("\n")
    return {"logs": [json.loads(ln) for ln in lines[-100:]]}

# Serve SPA
FRONTEND_DIST = REPO_DIR / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
else:
    @app.get("/")
    async def root():
        return {"message": "Ouroboros Backend Online. Frontend not built yet. Run 'npm run build' in frontend/."}

if __name__ == "__main__":
    # Start background services
    threading.Thread(target=supervisor_loop, daemon=True).start()
    spawn_workers(MAX_WORKERS)
    
    # Start web server
    uvicorn.run(app, host="0.0.0.0", port=8000)
