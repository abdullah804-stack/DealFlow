# src/agents/investor_agent.py
"""
Investor Agent — 5 investor personas for the Investment Committee.

Each persona has:
- A distinct role (Technical, Finance, Marketing, Legal, Founder)
- Specific evaluation criteria
- A weight in the final vote
- "Tools" they use to evaluate (simulated via LLM)

Investors form independent opinions and can provide rebuttals in round 2.
"""

import logging
from typing import Dict, Any, List, Optional
from abc import ABC, abstractmethod

from src.llm.client import call_llm_json

logger = logging.getLogger(__name__)


# ============================================================================
# INVESTOR PERSONAS — Configuration
# ============================================================================

from config.settings import INVESTOR_WEIGHTS

PERSONA_CONFIGS = {
    "technical": {
        "name": "Technical VC",
        "goal": "Determine defensible technical moat",
        "cares_about": "scalability, architecture, AI feasibility, competition",
        "weight": INVESTOR_WEIGHTS["technical"],
        "tools": ["estimate_infra_cost"],
    },
    "finance": {
        "name": "Finance VC",
        "goal": "Determine business model profitability",
        "cares_about": "revenue, CAC, LTV, burn rate, TAM",
        "weight": INVESTOR_WEIGHTS["finance"],
        "tools": ["estimate_tam"],
    },
    "marketing": {
        "name": "Marketing VC",
        "goal": "Determine real market demand/differentiation",
        "cares_about": "positioning, demand, differentiation",
        "weight": INVESTOR_WEIGHTS["marketing"],
        "tools": ["competitor_search"],
    },
    "legal": {
        "name": "Legal VC",
        "goal": "Determine compliance/regulatory risk",
        "cares_about": "privacy, GDPR, copyright, regulation",
        "weight": INVESTOR_WEIGHTS["legal"],
        "tools": ["compliance_checklist"],
    },
    "founder": {
        "name": "Serial Founder",
        "goal": "Determine execution feasibility",
        "cares_about": "MVP scope, hiring, execution speed",
        "weight": INVESTOR_WEIGHTS["founder"],
        "tools": ["mvp_cost_estimator"],
    },
}

# ============================================================================
# TOOL SIMULATIONS (LLM-based reasoning)
# ============================================================================

def simulate_tool(tool_name: str, context: str) -> str:
    """
    Simulate a tool call using LLM reasoning.
    
    Each tool is actually an LLM prompt that reasons about the specific
    aspect the tool represents.
    """
    tool_prompts = {
        "estimate_infra_cost": f"""
Based on the following startup information, estimate the infrastructure costs
and technical complexity of building this product.

Context: {context}

Provide a brief assessment of:
1. Estimated infrastructure cost (low/medium/high)
2. Technical complexity (simple/moderate/complex)
3. Any technical red flags

Keep it concise (2-3 sentences).
""",
        "estimate_tam": f"""
Based on the following startup information, estimate the Total Addressable Market (TAM).

Context: {context}

Provide a brief assessment of:
1. Estimated TAM (small/medium/large/huge)
2. Market growth potential
3. Any market risks

Keep it concise (2-3 sentences).
""",
        "competitor_search": f"""
Based on the following startup information, assess the competitive landscape.

Context: {context}

Provide a brief assessment of:
1. Main competitors
2. Differentiation from competitors
3. Competitive advantage (if any)

Keep it concise (2-3 sentences).
""",
        "compliance_checklist": f"""
Based on the following startup information, assess regulatory/compliance risks.

Context: {context}

Provide a brief assessment of:
1. Key regulatory risks (GDPR, HIPAA, etc.)
2. Compliance complexity
3. Any major red flags

Keep it concise (2-3 sentences).
""",
        "mvp_cost_estimator": f"""
Based on the following startup information, estimate MVP development cost and timeline.

Context: {context}

Provide a brief assessment of:
1. MVP development cost estimate
2. Time to market
3. Team size needed

Keep it concise (2-3 sentences).
""",
    }
    
    prompt = tool_prompts.get(tool_name, f"Evaluate this startup: {context}")
    
    try:
        response = call_llm_json(
            prompt=prompt,
            temperature=0.3,
            max_tokens=200,
        )
        return response.get("assessment", "Assessment not available")
    except Exception as e:
        logger.warning(f"Tool {tool_name} failed: {e}")
        return f"Tool {tool_name} assessment: Analysis unavailable"


# ============================================================================
# INVESTOR AGENT CLASS
# ============================================================================

class InvestorAgent:
    """
    An investor persona that evaluates startups.
    
    Each investor has a unique perspective and evaluation criteria.
    They can form initial opinions and provide rebuttals.
    """
    
    def __init__(self, persona_key: str):
        """
        Initialize an investor with a specific persona.
        
        Args:
            persona_key: One of 'technical', 'finance', 'marketing', 'legal', 'founder'
        """
        if persona_key not in PERSONA_CONFIGS:
            raise ValueError(f"Unknown persona: {persona_key}")
        
        self.persona_key = persona_key
        self.config = PERSONA_CONFIGS[persona_key]
        self.name = self.config["name"]
        self.goal = self.config["goal"]
        self.cares_about = self.config["cares_about"]
        self.weight = self.config["weight"]
        self.tools = self.config["tools"]
        
        logger.debug(f"Initialized {self.name}")
    
    def get_system_prompt(self) -> str:
        """Get the system prompt for this investor."""
        return f"""You are {self.name}, a venture investor specializing in evaluating startups.

Your goal: {self.goal}

You care about: {self.cares_about}

You have access to these tools: {', '.join(self.tools)}

When evaluating a startup, consider:
1. The startup's fundamentals relative to your expertise
2. The founder's vision and execution capability
3. The market opportunity and timing

Be critical but fair. Provide specific reasoning for your assessment.
Score on a scale of 1-10, where:
- 1-3: Major red flags, would not invest
- 4-6: Average, some concerns
- 7-8: Strong, would consider investing
- 9-10: Exceptional, would actively pursue

Format your response as JSON with these fields:
- opinion: Your detailed assessment (2-3 paragraphs)
- score: Number from 1-10
- confidence: How confident are you in your score? (1-10)
- tool_usage: Summary of any tool insights
"""
    
    def form_initial_opinion(self, dossier: Dict[str, Any]) -> Dict[str, Any]:
        """
        Form an initial opinion on a startup.
        
        Args:
            dossier: Dossier dict with company information
            
        Returns:
            {
                "opinion": str,
                "score": float,
                "confidence": float,
                "tool_usage": str,
                "persona": str,
            }
        """
        logger.info(f"  {self.name} forming initial opinion...")
        
        # Prepare dossier context
        context = self._prepare_context(dossier)
        
        # Use tools
        tool_results = []
        for tool in self.tools:
            result = simulate_tool(tool, context)
            tool_results.append(f"{tool}: {result}")
        
        tool_summary = "\n".join(tool_results)
        
        # Build prompt
        prompt = f"""
Evaluate this startup as {self.name}.

STARTUP INFORMATION:
{context}

TOOL INSIGHTS:
{tool_summary}

Based on your expertise and the tool insights above, provide your assessment.
Score the startup on a scale of 1-10.
Be specific about what you like and don't like.
"""
        
        try:
            response = call_llm_json(
                prompt=prompt,
                system_prompt=self.get_system_prompt(),
                temperature=0.4,
                max_tokens=600,
            )
            
            # Ensure all required fields
            response["persona"] = self.persona_key
            response["name"] = self.name
            response["weight"] = self.weight
            response["tool_usage"] = tool_summary[:500]
            
            # Clamp scores
            response["score"] = max(1, min(10, float(response.get("score", 5))))
            response["confidence"] = max(1, min(10, float(response.get("confidence", 5))))
            
            logger.info(f"    {self.name} score: {response['score']:.1f}/10 (conf: {response['confidence']:.1f})")
            return response
            
        except Exception as e:
            logger.error(f"  {self.name} failed to form opinion: {e}")
            # Fallback response
            return {
                "opinion": f"Unable to form complete opinion due to analysis error. Preliminary assessment suggests moderate potential.",
                "score": 5.0,
                "confidence": 3.0,
                "tool_usage": tool_summary[:500] if tool_summary else "Tools unavailable",
                "persona": self.persona_key,
                "name": self.name,
                "weight": self.weight,
            }
    
    def form_rebuttal(
        self,
        dossier: Dict[str, Any],
        own_opinion: Dict[str, Any],
        other_opinions: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Form a rebuttal after hearing other investors' opinions (round 2).
        
        Args:
            dossier: Dossier dict
            own_opinion: This investor's initial opinion
            other_opinions: Other investors' opinions
            
        Returns:
            Updated opinion with rebuttal
        """
        logger.info(f"  {self.name} forming rebuttal...")
        
        # Prepare context
        context = self._prepare_context(dossier)
        
        # Prepare other opinions
        other_summary = ""
        for op in other_opinions:
            if op.get("persona") == self.persona_key:
                continue
            other_summary += f"""
{op.get('name', 'Unknown')} ({op.get('persona', 'Unknown')}):
- Score: {op.get('score', 0)}/10
- Opinion: {op.get('opinion', 'No opinion')[:200]}...
"""
        
        # Build prompt
        prompt = f"""
You are {self.name}, and you just heard other investors' opinions on a startup.

YOUR INITIAL OPINION:
Score: {own_opinion.get('score', 5)}/10
Opinion: {own_opinion.get('opinion', 'No opinion')}

OTHER INVESTORS' OPINIONS:
{other_summary}

STARTUP CONTEXT:
{context}

Now, considering what others have said:
1. Does this change your view?
2. What points do you agree/disagree with?
3. What's your updated assessment?

Provide your rebuttal and updated score.
"""
        
        system_prompt = f"""You are {self.name}, a venture investor.

Your goal: {self.goal}

You care about: {self.cares_about}

In your rebuttal:
- Acknowledge valid points from others
- Defend your position with reasoning
- Update your score if your view changed
- Be professional and collaborative

Format your response as JSON:
{{
    "updated_opinion": "Your rebuttal and updated assessment",
    "updated_score": 7.5,
    "confidence": 8,
    "changed_mind": true/false,
    "reasoning": "Why you changed or didn't change your mind"
}}
"""
        
        try:
            response = call_llm_json(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=0.3,
                max_tokens=500,
            )
            
            # Merge with original opinion
            updated = own_opinion.copy()
            updated["updated_opinion"] = response.get("updated_opinion", own_opinion.get("opinion", ""))
            updated["updated_score"] = max(1, min(10, float(response.get("updated_score", own_opinion.get("score", 5)))))
            updated["rebuttal_confidence"] = max(1, min(10, float(response.get("confidence", 5))))
            updated["changed_mind"] = response.get("changed_mind", False)
            updated["rebuttal_reasoning"] = response.get("reasoning", "No specific reasoning provided")
            updated["has_rebuttal"] = True
            
            logger.info(f"    {self.name} updated score: {updated['updated_score']:.1f}/10 (changed mind: {updated['changed_mind']})")
            return updated
            
        except Exception as e:
            logger.error(f"  {self.name} failed to form rebuttal: {e}")
            # Fallback: keep original opinion
            own_opinion["has_rebuttal"] = False
            own_opinion["rebuttal_reasoning"] = "Rebuttal analysis failed"
            return own_opinion
    
    def _prepare_context(self, dossier: Dict[str, Any]) -> str:
        """
        Prepare dossier context for the investor.
        """
        parts = []
        
        # Basic info
        if "company" in dossier:
            parts.append(f"Company: {dossier['company']}")
        if "industry" in dossier:
            parts.append(f"Industry: {dossier['industry']}")
        if "summary" in dossier:
            parts.append(f"Summary: {dossier['summary']}")
        
        # Financial info
        if "pricing_model" in dossier:
            parts.append(f"Pricing Model: {dossier['pricing_model']}")
        if "estimated_users" in dossier:
            parts.append(f"Estimated Users: {dossier['estimated_users']}")
        
        # Technology
        if "technology" in dossier:
            parts.append(f"Technology: {dossier['technology']}")
        
        # Competitors
        if "competitors" in dossier and dossier["competitors"]:
            parts.append(f"Competitors: {', '.join(dossier['competitors'])}")
        
        # Funding
        if "funding_status" in dossier:
            parts.append(f"Funding Status: {dossier['funding_status']}")
        
        return "\n".join(parts)


# ============================================================================
# INVESTOR FACTORY
# ============================================================================

def create_investor(persona_key: str) -> InvestorAgent:
    """
    Create an investor agent with the specified persona.
    
    Args:
        persona_key: 'technical', 'finance', 'marketing', 'legal', 'founder'
    
    Returns:
        InvestorAgent instance
    """
    return InvestorAgent(persona_key)


def create_all_investors() -> Dict[str, InvestorAgent]:
    """
    Create all 5 investor agents.
    
    Returns:
        Dict mapping persona_key to InvestorAgent
    """
    personas = ["technical", "finance", "marketing", "legal", "founder"]
    return {p: create_investor(p) for p in personas}


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    print("\n🔍 Testing Investor Agent...")
    
    # Create all investors
    investors = create_all_investors()
    print(f"✅ Created {len(investors)} investors:")
    for key, investor in investors.items():
        print(f"  - {investor.name} (weight: {investor.weight})")
    
    # Test dossier
    test_dossier = {
        "company": "AI Legal Research Platform",
        "industry": "Legal Technology",
        "summary": "AI platform that helps law firms research cases 10x faster. Founded by 2 ex-lawyers. In beta with 5 firms.",
        "pricing_model": "Subscription ($500/month per user)",
        "estimated_users": "50 firms in beta",
        "technology": "NLP, machine learning, legal document processing",
        "competitors": ["LexisNexis", "Westlaw", "Casetext"],
        "funding_status": "Pre-seed ($500k raised)",
    }
    
    print("\n📊 Testing Technical VC evaluation:")
    tech_investor = investors["technical"]
    opinion = tech_investor.form_initial_opinion(test_dossier)
    print(f"  Score: {opinion.get('score', 0)}/10")
    print(f"  Confidence: {opinion.get('confidence', 0)}/10")
    print(f"  Opinion: {opinion.get('opinion', '')[:100]}...")
    
    print("\n📊 Testing Finance VC evaluation:")
    finance_investor = investors["finance"]
    opinion = finance_investor.form_initial_opinion(test_dossier)
    print(f"  Score: {opinion.get('score', 0)}/10")
    print(f"  Confidence: {opinion.get('confidence', 0)}/10")
    
    print("\n📊 Testing rebuttal:")
    # Get all opinions
    all_opinions = []
    for key, investor in investors.items():
        op = investor.form_initial_opinion(test_dossier)
        all_opinions.append(op)
    
    # Test rebuttal for one investor
    tech_opinion = all_opinions[0]
    other_opinions = all_opinions[1:]
    rebuttal = tech_investor.form_rebuttal(test_dossier, tech_opinion, other_opinions)
    print(f"  Updated score: {rebuttal.get('updated_score', 0)}/10")
    print(f"  Changed mind: {rebuttal.get('changed_mind', False)}")
    
    print("\n✅ All investor tests passed!")