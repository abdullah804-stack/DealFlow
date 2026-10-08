"""
LLM Client — Unified interface for Groq (primary) and OpenRouter (fallback).

All agents use this single entry point for LLM calls.
Provides automatic fallback, retry logic, and consistent response formatting.
"""

import json
import logging
import time
from typing import Optional, Dict, Any, List

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

logger = logging.getLogger(__name__)


# ============================================================================
# CLIENT INITIALIZATION (lazy-loaded)
# ============================================================================

_groq_client: Optional[OpenAI] = None
_openrouter_client: Optional[OpenAI] = None


def _get_groq_client() -> OpenAI:
    global _groq_client
    if _groq_client is None:
        if not GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY not set")
        _groq_client = OpenAI(api_key=GROQ_API_KEY, base_url=GROQ_BASE_URL)
    return _groq_client


def _get_openrouter_client() -> OpenAI:
    global _openrouter_client
    if _openrouter_client is None:
        if not OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY not set")
        _openrouter_client = OpenAI(
            api_key=OPENROUTER_API_KEY, base_url=OPENROUTER_BASE_URL
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
    Returns the LLM's response text.
    """
    messages: List[Dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

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
    last_error: Optional[Exception] = None

    # Pre-build the "safe" messages once — Groq requires the literal
    # substring "json" in the messages when response_format is json_object.
    safe_messages = list(messages)
    if response_format and response_format.get("type") == "json_object":
        hint = "Respond with valid json only."
        if safe_messages and safe_messages[0].get("role") == "system":
            if "json" not in safe_messages[0]["content"].lower():
                safe_messages[0] = {
                    "role": "system",
                    "content": safe_messages[0]["content"].rstrip() + "\n\n" + hint,
                }
        else:
            safe_messages.insert(0, {"role": "system", "content": hint})

        if safe_messages and "json" not in safe_messages[-1]["content"].lower():
            safe_messages[-1] = {
                "role": safe_messages[-1]["role"],
                "content": safe_messages[-1]["content"].rstrip()
                + "\n\nRespond with valid json only.",
            }

    for attempt in range(retries + 1):
        try:
            kwargs: Dict[str, Any] = {
                "model": model,
                "messages": safe_messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if response_format and response_format.get("type") == "json_object":
                kwargs["response_format"] = response_format

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
                sleep_time = retry_delay * (2 ** attempt)
                logger.info(f"Retrying in {sleep_time:.1f}s...")
                time.sleep(sleep_time)

    raise last_error or RuntimeError("Unknown LLM call error")


# ============================================================================
# JSON EXTRACTION HELPERS
# ============================================================================

def _strip_json_fence(text: str) -> str:
    """
    Strip markdown code fences that LLMs sometimes wrap JSON in.

    Handles:
        ```json\\n{...}\\n```
        ```\\n{...}\\n```
        {plain json}
        Prose before/after the JSON block

    Returns a string whose first non-whitespace character should be { or [.
    """
    if not text:
        return text

    stripped = text.strip()

    # Strip leading ```json or ``` fences
    if stripped.startswith("```"):
        first_newline = stripped.find("\n")
        if first_newline != -1:
            stripped = stripped[first_newline + 1:]
        else:
            stripped = stripped.lstrip("`")
            if stripped.lower().startswith("json"):
                stripped = stripped[4:]

    # Strip trailing ```
    if stripped.rstrip().endswith("```"):
        stripped = stripped.rstrip()[:-3]

    stripped = stripped.strip()

    # If there's prose around the JSON, extract the first balanced block
    if stripped and not (stripped.startswith("{") or stripped.startswith("[")):
        for opener, closer in (("{", "}"), ("[", "]")):
            start = stripped.find(opener)
            end = stripped.rfind(closer)
            if start != -1 and end != -1 and end > start:
                stripped = stripped[start:end + 1]
                break

    return stripped.strip()


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

    cleaned = _strip_json_fence(response)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response: {cleaned[:200]}...")
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
    """
    responses: List[str] = []
    for i, prompt in enumerate(prompts):
        logger.info(f"Processing batch item {i + 1}/{len(prompts)}")
        responses.append(
            call_llm(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                retries=retries,
                retry_delay=retry_delay,
            )
        )
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
    """
    responses = call_llm_batch(
        prompts=prompts,
        system_prompt=system_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        retries=retries,
        retry_delay=retry_delay,
    )

    parsed: List[Dict[str, Any]] = []
    for response in responses:
        cleaned = _strip_json_fence(response)
        try:
            parsed.append(json.loads(cleaned))
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse batch item: {cleaned[:200]}...")
            raise ValueError(f"Batch item is not valid JSON: {e}")

    return parsed


# ============================================================================
# TESTING / DEBUG
# ============================================================================

if __name__ == "__main__":
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
        print("LLM client works!")
    except Exception as e:
        print(f"LLM client failed: {e}")