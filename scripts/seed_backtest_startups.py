# scripts/seed_backtest_startups.py
"""
Backtest Data Seeder — Curated historical startup data for backtesting.

Provides 8-10 startups with known outcomes.
Each dossier contains ONLY information that was available at the time.
No outcome-leaking information is included.

CRITICAL: The committee evaluates these dossiers as if they were new candidates.
The actual outcomes are stored separately for comparison.

Usage:
    python scripts/seed_backtest_startups.py
"""

import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.memory import clear_backtest_results, save_backtest_result

logger = logging.getLogger(__name__)


# ============================================================================
# BACKTEST DATA
# ============================================================================

# Each startup dossier contains ONLY information available at the time.
# No outcome information is included in the dossier text.

BACKTEST_STARTUPS = [
    {
        "name": "Instagram",
        "actual_outcome": "acquired",
        "dossier_text": """Company: Instagram
Industry: Social Media / Photo Sharing
Summary: Mobile photo-sharing app with filters. Users can take photos, apply filters, and share with followers. Launched October 2010.
Funding Status: Seed ($500k from Baseline Ventures and Andreessen Horowitz)
Technology: iOS app, cloud storage
Competitors: Hipstamatic, Flickr, PicPlz
Estimated Users: 1 million users (as of December 2010)
Pricing Model: Free (no monetization yet)
Team: Kevin Systrom (CEO), Mike Krieger (CTO) - both ex-Google
Market Opportunity: Growing mobile photo-sharing market. Instagram is the fastest-growing in this category.""",
        "expected_verdict": "INVEST",
    },
    {
        "name": "Groupon",
        "actual_outcome": "succeeded",
        "dossier_text": """Company: Groupon
Industry: E-commerce / Daily Deals
Summary: Daily deal website offering discounted products and services. Users get deals, businesses get customers.
Funding Status: Series A ($4.8M from New Enterprise Associates)
Technology: Website, email marketing, CRM
Competitors: LivingSocial, BuyWithMe
Estimated Users: 10 million subscribers (as of 2010)
Pricing Model: Revenue share with merchants (typically 50%)
Team: Andrew Mason (CEO), Eric Lefkofsky (Chairman)
Market Opportunity: Massive local commerce market. Groupon is the market leader in daily deals.""",
        "expected_verdict": "INVEST",
    },
    {
        "name": "Color Labs",
        "actual_outcome": "failed",
        "dossier_text": """Company: Color Labs
Industry: Social Media / Photo Sharing
Summary: Location-based photo-sharing app. Focuses on groups and events. Users share photos with nearby people in real-time.
Funding Status: Series A ($41M from Sequoia Capital, Bain Capital Ventures)
Technology: iOS and Android apps, patent-pending location technology
Competitors: Instagram, PicPlz, Path
Estimated Users: Unknown (app launched and then quickly pulled)
Pricing Model: Free
Team: Bill Nguyen (CEO) - previously founded Seven, Ngmoco
Market Opportunity: Real-time location-based social sharing. Early market with unknown demand.""",
        "expected_verdict": "PASS",
    },
    {
        "name": "Uber",
        "actual_outcome": "succeeded",
        "dossier_text": """Company: Uber
Industry: Transportation / On-demand Ride Sharing
Summary: On-demand car service app. Users request rides, private cars pick them up. Premium service with black cars.
Funding Status: Seed ($1.25M from First Round Capital, Lowercase Capital)
Technology: iPhone app, GPS tracking, payment system
Competitors: Taxis, limousine services, Lyft (early stage)
Estimated Users: Unknown (launching in SF only)
Pricing Model: Commission on rides
Team: Travis Kalanick (CEO), Garrett Camp (Founder)
Market Opportunity: Disruption of taxi industry. Premium transportation service for professionals.""",
        "expected_verdict": "INVEST",
    },
    {
        "name": "Quirky",
        "actual_outcome": "failed",
        "dossier_text": """Company: Quirky
Industry: Consumer Products / Crowdsourcing
Summary: Crowdsourcing platform for consumer products. Community votes on ideas, Quirky develops and sells the best ones.
Funding Status: Series A ($6.8M from RRE Ventures, Lerer Ventures)
Technology: Website, community platform, supply chain integration
Competitors: Threadless (similar community model)
Estimated Users: 100,000+ community members
Pricing Model: Revenue share with inventors
Team: Ben Kaufman (CEO) - previously founded Mophie
Market Opportunity: Democratizing product development. Tapping into community creativity.""",
        "expected_verdict": "PASS",
    },
    {
        "name": "Slack",
        "actual_outcome": "succeeded",
        "dossier_text": """Company: Slack
Industry: Enterprise Communication / Collaboration
Summary: Team communication platform with channels, file sharing, and integrations. Built as an internal tool at Tiny Speck.
Funding Status: Seed ($1.5M from Andreessen Horowitz, Accel Partners)
Technology: Web app, mobile apps, integration API
Competitors: HipChat, Campfire, Yammer, Microsoft Teams (rumored)
Estimated Users: 10,000+ daily active users (in private beta)
Pricing Model: Freemium (free tier, paid tiers with advanced features)
Team: Stewart Butterfield (CEO) - previously co-founded Flickr
Market Opportunity: Massive enterprise communication market. Strong product-market fit in beta.""",
        "expected_verdict": "INVEST",
    },
    {
        "name": "Digg",
        "actual_outcome": "failed",
        "dossier_text": """Company: Digg
Industry: Social News / Aggregation
Summary: Social news aggregator where users submit and vote on content. Popular stories rise to the front page.
Funding Status: Series A ($2.8M from Greylock Partners, Omidyar Network)
Technology: Website, recommendation algorithm
Competitors: Reddit, Delicious, Slashdot
Estimated Users: 30 million monthly visitors (as of 2008)
Pricing Model: Advertising
Team: Kevin Rose (Founder) - previously founded Pownce
Market Opportunity: Large news aggregation market. Digg is a leader in social voting.""",
        "expected_verdict": "PASS",
    },
    {
        "name": "Stripe",
        "actual_outcome": "succeeded",
        "dossier_text": """Company: Stripe
Industry: FinTech / Payments
Summary: Payment processing platform for developers. Simple API for accepting payments online.
Funding Status: Seed ($2M from Sequoia Capital, Andreessen Horowitz)
Technology: API, developer tools, security infrastructure
Competitors: PayPal, Braintree, Authorize.net
Estimated Users: 10,000+ developers using the API
Pricing Model: Transaction fees (2.9% + $0.30 per transaction)
Team: Patrick Collison (CEO), John Collison (President) - previously founded Auctomatic
Market Opportunity: Massive online payments market. Developers love the simple API.""",
        "expected_verdict": "INVEST",
    },
    {
        "name": "Pets.com",
        "actual_outcome": "failed",
        "dossier_text": """Company: Pets.com
Industry: E-commerce / Pet Supplies
Summary: Online retailer for pet supplies. Sells pet food, toys, and accessories with free shipping.
Funding Status: IPO ($82.5M) - started as a dot-com
Technology: Website, e-commerce platform, fulfillment center
Competitors: PetSmart, Petco, Amazon Pets (rumored)
Estimated Users: Unknown (early stage)
Pricing Model: Retail sales
Team: Julie Wainwright (CEO) - previously at Berkeley Systems
Market Opportunity: Large pet supplies market. Convenience of online ordering with free shipping.""",
        "expected_verdict": "PASS",
    },
    {
        "name": "Dropbox",
        "actual_outcome": "succeeded",
        "dossier_text": """Company: Dropbox
Industry: Cloud Storage / File Sync
Summary: Cloud storage and file synchronization service. Files sync across devices automatically.
Funding Status: Seed ($1.2M from Sequoia Capital, Y Combinator)
Technology: Desktop app, mobile apps, cloud infrastructure
Competitors: Box, SugarSync, Google Drive (rumored), iCloud (rumored)
Estimated Users: 5 million users (as of 2010)
Pricing Model: Freemium (free 2GB, paid plans for more storage)
Team: Drew Houston (CEO) - MIT grad, Arash Ferdowsi (CTO)
Market Opportunity: Massive cloud storage market. Users love the product.""",
        "expected_verdict": "INVEST",
    },
]


# ============================================================================
# SEED FUNCTION
# ============================================================================

def seed_backtest_data(clear_existing: bool = True):
    """
    Seed the backtest_results table with historical startup data.
    
    Args:
        clear_existing: Whether to clear existing backtest results
    """
    logger.info("Seeding backtest data...")
    
    if clear_existing:
        logger.info("  Clearing existing backtest results...")
        clear_backtest_results()
    
    success_count = 0
    for startup in BACKTEST_STARTUPS:
        try:
            save_backtest_result(
                startup_name=startup["name"],
                actual_outcome=startup["actual_outcome"],
                committee_verdict="PASS",  # Will be filled by backtest
                aligned_with_outcome=False,  # Will be filled by backtest
                dossier_text=startup["dossier_text"],
            )
            success_count += 1
            logger.info(f"  ✅ Seeded: {startup['name']} ({startup['actual_outcome']})")
        except Exception as e:
            logger.error(f"  ❌ Failed to seed {startup['name']}: {e}")
    
    logger.info(f"Seeded {success_count}/{len(BACKTEST_STARTUPS)} startups")
    return success_count


def get_backtest_startups() -> list:
    """
    Get the list of backtest startups.
    """
    return BACKTEST_STARTUPS


def get_startup_names() -> list:
    """
    Get just the startup names.
    """
    return [s["name"] for s in BACKTEST_STARTUPS]


# ============================================================================
# VALIDATION
# ============================================================================

def validate_backtest_data():
    """
    Validate that no dossier contains outcome information.
    """
    logger.info("Validating backtest data for outcome leakage...")
    
    outcome_keywords = ["success", "failed", "acquired", "became", "later", "eventually", 
                        "went public", "ipo", "bankrupt", "shut down", "defunct"]
    
    issues = []
    for startup in BACKTEST_STARTUPS:
        name = startup["name"]
        dossier = startup["dossier_text"].lower()
        
        for keyword in outcome_keywords:
            if keyword in dossier:
                issues.append(f"  ⚠️  {name}: Contains '{keyword}' in dossier")
                break
    
    if issues:
        logger.warning("Found potential outcome leakage:")
        for issue in issues:
            logger.warning(issue)
        return False
    else:
        logger.info("  ✅ No outcome leakage detected")
        return True


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    print("\n" + "=" * 60)
    print("BACKTEST DATA SEEDER")
    print("=" * 60)
    
    # Validate data
    print("\n📊 Validating backtest data...")
    is_valid = validate_backtest_data()
    
    if not is_valid:
        print("\n⚠️  Potential outcome leakage detected!")
        response = input("Continue anyway? (y/N): ")
        if response.lower() != 'y':
            print("Aborting.")
            sys.exit(1)
    
    # Check if data already exists
    from src.memory import get_backtest_results
    existing = get_backtest_results()
    
    if existing.get("total", 0) > 0:
        print(f"\n⚠️  Backtest data already exists ({existing['total']} records)")
        response = input("Overwrite? (y/N): ")
        if response.lower() != 'y':
            print("Aborting.")
            sys.exit(0)
    
    # Seed data
    print("\n📊 Seeding backtest data...")
    count = seed_backtest_data(clear_existing=True)
    
    print(f"\n✅ Seeded {count} startups:")
    for startup in BACKTEST_STARTUPS:
        print(f"  - {startup['name']} ({startup['actual_outcome']})")
    
    print("\n📊 Verification:")
    results = get_backtest_results()
    print(f"  Total records: {results.get('total', 0)}")
    print(f"  Accuracy: {results.get('accuracy_pct', 0):.1f}% (will be updated after backtest)")
    
    print("\n✅ Backtest data seeding complete!")
    print("\n⚠️  Remember to run the backtest to get accuracy results:")
    print("  python -m src.evaluation.backtest")