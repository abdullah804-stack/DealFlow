# src/api/main.py
"""
FastAPI Backend — VentureScout AI API.

Endpoints:
- GET /reports?days=7 — Daily reports
- GET /funnel — Discovery funnel statistics
- GET /backtest — Backtest results
- POST /chat — Chat interface over memory
- GET /health — Health check
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.memory import (
    get_recent_reports_by_days,
    get_funnel_stats,
    get_backtest_results,
    get_rag_response,
    ChatHistory,
)
from src.evaluation.scorecard import get_funnel_report, get_investment_summary

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    sources: List[Dict[str, Any]]
    session_id: str

class ReportResponse(BaseModel):
    reports: List[Dict[str, Any]]

class FunnelResponse(BaseModel):
    discovered: int
    validated: int
    escalated: int
    invested: int
    period_days: int
    conversion_rates: Optional[Dict[str, float]] = None

class BacktestResponse(BaseModel):
    total: int
    aligned: int
    accuracy_pct: float
    per_startup: List[Dict[str, Any]]

class HealthResponse(BaseModel):
    status: str
    timestamp: str

# ============================================================================
# FASTAPI APP
# ============================================================================

app = FastAPI(
    title="VentureScout AI API",
    description="Autonomous VC Analyst - Daily startup evaluation and reporting",
    version="1.0.0",
)

# CORS - Allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://venturescout-ai.vercel.app",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Chat history storage (simple in-memory for demo)
chat_histories: Dict[str, ChatHistory] = {}

# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
    }

@app.get("/reports", response_model=ReportResponse)
async def get_reports(days: int = Query(7, ge=1, le=90)):
    """
    Get daily reports for the last N days.
    
    Returns full VC-memo-style reports with all committee details.
    """
    try:
        reports = get_recent_reports_by_days(days)
        
        # Format reports for API
        formatted_reports = []
        for report in reports:
            # Parse dossier JSON
            dossier = report.get("dossier_json", {})
            
            formatted_reports.append({
                "candidate_id": report.get("candidate_id"),
                "title": report.get("title", "Unknown"),
                "url": report.get("url", ""),
                "source": report.get("source", "unknown"),
                "company": dossier.get("company", "Unknown"),
                "industry": dossier.get("industry", "Unknown"),
                "summary": dossier.get("summary", "No summary available"),
                "decision": report.get("decision", "PASS"),
                "weighted_score": report.get("weighted_score", 0),
                "fast_path": report.get("fast_path"),
                "debate_summary": report.get("debate_summary", "No debate summary"),
                "timestamp": report.get("timestamp"),
                "round1_opinions": report.get("round1_opinions", []),
                "round2_opinions": report.get("round2_opinions"),
            })
        
        return {"reports": formatted_reports}
        
    except Exception as e:
        logger.error(f"Failed to get reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/funnel", response_model=FunnelResponse)
async def get_funnel(days: int = Query(30, ge=1, le=90)):
    """
    Get discovery funnel statistics.
    
    Shows how many candidates were found, validated, escalated, and invested.
    """
    try:
        stats = get_funnel_stats(days)
        
        # Get conversion rates
        report = get_funnel_report(days)
        conversion_rates = report.get("conversion_rates", {})
        
        return {
            "discovered": stats.get("discovered", 0),
            "validated": stats.get("validated", 0),
            "escalated": stats.get("escalated", 0),
            "invested": stats.get("invested", 0),
            "period_days": stats.get("period_days", days),
            "conversion_rates": conversion_rates,
        }
        
    except Exception as e:
        logger.error(f"Failed to get funnel stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/backtest", response_model=BacktestResponse)
async def get_backtest():
    """
    Get backtest results.
    
    Shows historical accuracy of the committee against known outcomes.
    """
    try:
        results = get_backtest_results()
        
        return {
            "total": results.get("total", 0),
            "aligned": results.get("aligned", 0),
            "accuracy_pct": results.get("accuracy_pct", 0.0),
            "per_startup": results.get("per_startup", []),
        }
        
    except Exception as e:
        logger.error(f"Failed to get backtest: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat with the system's memory.
    
    Uses RAG to retrieve relevant past decisions and generate a response.
    """
    try:
        session_id = request.session_id or "default"
        
        # Get or create chat history
        if session_id not in chat_histories:
            chat_histories[session_id] = ChatHistory()
        
        history = chat_histories[session_id]
        history.add_user_message(request.message)
        
        # Get RAG response
        result = get_rag_response(request.message, history)
        
        # Add assistant message to history
        history.add_assistant_message(result.get("response", ""))
        
        return {
            "response": result.get("response", "No response generated."),
            "sources": result.get("sources", []),
            "session_id": session_id,
        }
        
    except Exception as e:
        logger.error(f"Chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str):
    """
    Get chat history for a session.
    """
    if session_id not in chat_histories:
        return {"history": []}
    
    history = chat_histories[session_id]
    return {"history": history.get_history()}

@app.delete("/chat/history/{session_id}")
async def clear_chat_history(session_id: str):
    """
    Clear chat history for a session.
    """
    if session_id in chat_histories:
        chat_histories[session_id].clear()
        del chat_histories[session_id]
    
    return {"status": "cleared"}

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "src.api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )