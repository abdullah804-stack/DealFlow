# src/llm/client.py
"""
LLM Client — Unified interface for Groq (primary) and OpenRouter (fallback).

All agents use this single entry point for LLM calls.
Provides automatic fallback, retry logic, and consistent response formatting.
"""

import json
import logging
import time
from typing import Optional, Dict, Any, List, Union

import openai
from openai import OpenAI

from config.settings import (
    GROQ_API_KEY,
    GROQ_MODEL,
    GROQ_BASE_URL,
    OPENROUTER_API_KEY,
    OPENROUTER_MODEL,
    OPENROUTER_BASE_URL,
    LLM_TEMPERATURE,
    LLM_MAX_TOKENS,
)

# Set up logging
logger = logging.getLogger(__name__)

# ============================================================================
# CLIENT INITIALIZATION (lazy-loaded)
# ============================================================================

_groq_client: Optional[OpenAI] = None
_openrouter_client: Optional[OpenAI] = None


def _get_groq_client() -> OpenAI:
    """Initialize and return Groq client (lazy-loaded)."""
    global _groq_client
    if _groq_client is None:
        if not GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY not set")
        _groq_client = OpenAI(
            api_key=GROQ_API_KEY,
            base_url=GROQ_BASE_URL,
        )
    return _groq_client


def _get_openrouter_client() -> OpenAI:
    """Initialize and return OpenRouter client (lazy-loaded)."""
    global _openrouter_client
    if _openrouter_client is None:
        if not OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY not set")
        _openrouter_client = OpenAI(
            api_key=OPENROUTER_API_KEY,
            base_url=OPENROUTER_BASE_URL,
        )
    return _openrouter_client


# ============================================================================
# MAIN LLM CALL FUNCTION
# ============================================================================

def call_llm(
    prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = LLM_TEMPERATURE,
    max_tokens: int = LLM_MAX_TOKENS,
    response_format: Optional[Dict[str, str]] = None,
    retries: int = 2,
    retry_delay: float = 2.0,
) -> str:
    """
    Unified LLM call with Groq primary and OpenRouter fallback.
    
    Args:
        prompt: User prompt / instructions
        system_prompt: System prompt (optional)
        temperature: Controls randomness (0.0 - 1.0)
        max_tokens: Maximum tokens in response
        response_format: For JSON mode, pass {"type": "json_object"}
        retries: Number of retry attempts per provider
        retry_delay: Delay in seconds between retries (exponential backoff)
    
    Returns:
        str: The LLM's response text
    
    Raises:
        RuntimeError: If both providers fail after all retries
    """
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    # Try primary (Groq) first
    try:
        logger.info(f"Calling Groq LLM (model: {GROQ_MODEL})")
        response = _call_openai_compatible(
            client=_get_groq_client(),
            model=GROQ_MODEL,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
            retries=retries,
            retry_delay=retry_delay,
        )
        logger.info("Groq call successful")
        return response
    except Exception as e:
        logger.warning(f"Groq failed: {e}. Falling back to OpenRouter...")
    
    # Fallback to OpenRouter
    try:
        logger.info(f"Calling OpenRouter LLM (model: {OPENROUTER_MODEL})")
        response = _call_openai_compatible(
            client=_get_openrouter_client(),
            model=OPENROUTER_MODEL,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
            retries=retries,
            retry_delay=retry_delay,
        )
        logger.info("OpenRouter call successful")
        return response
    except Exception as e:
        logger.error(f"OpenRouter also failed: {e}")
        raise RuntimeError(f"Both LLM providers failed. Last error: {e}")


# ============================================================================
# INTERNAL HELPER
# ============================================================================

def _call_openai_compatible(
    client: OpenAI,
    model: str,
    messages: List[Dict[str, str]],
    temperature: float,
    max_tokens: int,
    response_format: Optional[Dict[str, str]] = None,
    retries: int = 2,
    retry_delay: float = 2.0,
) -> str:
    """
    Internal: Call an OpenAI-compatible API with retry logic.
    """
    last_error = None
    
    for attempt in range(retries + 1):
        try:
            # Build request arguments
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            
            # Add response_format for JSON mode if requested
            if response_format and response_format.get("type") == "json_object":
                kwargs["response_format"] = response_format
            
            # Make the API call
            response = client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content
            
            if content is None:
                raise ValueError("LLM returned empty response")
            
            return content.strip()
            
        except Exception as e:
            last_error = e
            logger.warning(
                f"LLM call attempt {attempt + 1}/{retries + 1} failed: {e}"
            )
            if attempt < retries:
                sleep_time = retry_delay * (2 ** attempt)  # Exponential backoff
                logger.info(f"Retrying in {sleep_time:.1f}s...")
                time.sleep(sleep_time)
    
    raise last_error or RuntimeError("Unknown LLM call error")


# ============================================================================
# CONVENIENCE: JSON MODE
# ============================================================================

def call_llm_json(
    prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = LLM_TEMPERATURE,
    max_tokens: int = LLM_MAX_TOKENS,
    retries: int = 2,
    retry_delay: float = 2.0,
) -> Dict[str, Any]:
    """
    Call LLM and parse response as JSON.
    
    Returns:
        Dict[str, Any]: Parsed JSON response
    
    Raises:
        ValueError: If response is not valid JSON
    """
    response = call_llm(
        prompt=prompt,
        system_prompt=system_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
        retries=retries,
        retry_delay=retry_delay,
    )
    
    try:
        return json.loads(response)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response: {response[:200]}...")
        raise ValueError(f"LLM response is not valid JSON: {e}")


# ============================================================================
# BATCH UTILITY
# ============================================================================

def call_llm_batch(
    prompts: List[str],
    system_prompt: Optional[str] = None,
    temperature: float = LLM_TEMPERATURE,
    max_tokens: int = LLM_MAX_TOKENS,
    retries: int = 2,
    retry_delay: float = 2.0,
) -> List[str]:
    """
    Call LLM for multiple prompts in sequence (not parallel).
    
    This is simpler than parallelization and avoids rate limits.
    For batched discovery/validation, this is the recommended approach.
    
    Args:
        prompts: List of user prompts
        
    Returns:
        List[str]: Responses in the same order
    """
    responses = []
    for i, prompt in enumerate(prompts):
        logger.info(f"Processing batch item {i + 1}/{len(prompts)}")
        response = call_llm(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            retries=retries,
            retry_delay=retry_delay,
        )
        responses.append(response)
    return responses


def call_llm_batch_json(
    prompts: List[str],
    system_prompt: Optional[str] = None,
    temperature: float = LLM_TEMPERATURE,
    max_tokens: int = LLM_MAX_TOKENS,
    retries: int = 2,
    retry_delay: float = 2.0,
) -> List[Dict[str, Any]]:
    """
    Call LLM for multiple prompts and parse each as JSON.
    
    Returns:
        List[Dict[str, Any]]: Parsed JSON responses
    """
    responses = call_llm_batch(
        prompts=prompts,
        system_prompt=system_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        retries=retries,
        retry_delay=retry_delay,
    )
    
    parsed = []
    for response in responses:
        try:
            parsed.append(json.loads(response))
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse batch item: {response[:100]}...")
            raise ValueError(f"Batch item is not valid JSON: {e}")
    
    return parsed


# ============================================================================
# TESTING / DEBUG
# ============================================================================

if __name__ == "__main__":
    # Quick test - requires environment variables set
    logging.basicConfig(level=logging.INFO)
    
    try:
        print("Testing LLM client...")
        response = call_llm(
            prompt="Say 'Hello, DealFlow!' in exactly 5 words.",
            system_prompt="You are a helpful assistant.",
            temperature=0.0,
            max_tokens=50,
        )
        print(f"Response: {response}")
        print("✅ LLM client works!")
    except Exception as e:
        print(f"❌ LLM client failed: {e}")