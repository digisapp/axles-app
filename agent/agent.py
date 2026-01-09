"""
AxlesAI Voice Agent - LiveKit + xAI

A voice AI agent that answers phone calls about truck and trailer inventory.
Uses xAI's native Grok Voice API for speech-to-speech conversation.
Settings are loaded from the database (configurable via admin panel).
"""

import os
import logging
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RunContext,
    WorkerOptions,
    function_tool,
    cli,
)
from livekit.plugins import xai

from tools import InventoryTools, LeadTools, get_ai_agent_settings

load_dotenv()

logger = logging.getLogger("axles-agent")
logger.setLevel(logging.INFO)


class AxlesAgent(Agent):
    """Voice AI agent for AxlesAI marketplace."""

    def __init__(self, settings: dict) -> None:
        super().__init__(
            instructions=settings.get('instructions', 'You are a helpful AI assistant.'),
        )
        self.settings = settings
        self.inventory_tools = InventoryTools()
        self.lead_tools = LeadTools()

    @function_tool()
    async def search_inventory(
        self,
        ctx: RunContext,
        category: str | None = None,
        make: str | None = None,
        min_price: int | None = None,
        max_price: int | None = None,
        condition: str | None = None,
        limit: int = 5,
    ) -> str:
        """Search available inventory based on criteria.

        Args:
            category: Type of equipment (trailers, trucks, heavy-equipment)
            make: Manufacturer name (e.g., Great Dane, Peterbilt, Kenworth)
            min_price: Minimum price filter
            max_price: Maximum price filter
            condition: 'new' or 'used'
            limit: Maximum number of results to return
        """
        results = await self.inventory_tools.search(
            category=category,
            make=make,
            min_price=min_price,
            max_price=max_price,
            condition=condition,
            limit=limit,
        )
        return results

    @function_tool()
    async def get_listing_details(self, ctx: RunContext, listing_id: str) -> str:
        """Get detailed information about a specific listing.

        Args:
            listing_id: The unique ID of the listing
        """
        details = await self.inventory_tools.get_details(listing_id)
        return details

    @function_tool()
    async def capture_lead(
        self,
        ctx: RunContext,
        name: str,
        phone: str,
        interest: str,
        email: str | None = None,
        listing_id: str | None = None,
    ) -> str:
        """Capture caller's information as a lead for dealer follow-up.

        Args:
            name: Caller's name
            phone: Caller's phone number
            interest: What they're looking for or interested in
            email: Caller's email (optional)
            listing_id: Specific listing they're interested in (optional)
        """
        result = await self.lead_tools.capture(
            name=name,
            phone=phone,
            interest=interest,
            email=email,
            listing_id=listing_id,
            source="phone_call",
        )
        return result


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the voice agent."""

    logger.info(f"Agent starting in room: {ctx.room.name}")

    # Load settings from database
    settings = get_ai_agent_settings()
    logger.info(f"Using voice: {settings.get('voice')}")

    # Check if agent is active
    if not settings.get('is_active', True):
        logger.warning("AI agent is disabled in settings")
        return

    # Connect to the room
    await ctx.connect()

    # Create xAI Realtime model with voice from settings
    model = xai.realtime.RealtimeModel(
        voice=settings.get('voice', 'Sal'),
        api_key=os.getenv("XAI_API_KEY"),
    )

    # Create agent with instructions from settings
    agent = AxlesAgent(settings)

    # Create session with xAI model
    session = AgentSession(llm=model)

    # Start the session
    await session.start(room=ctx.room, agent=agent)

    # Generate greeting for inbound callers
    greeting = settings.get('greeting_message', 'Hello! How can I help you today?')
    await session.generate_reply(instructions=greeting)

    logger.info("xAI voice agent session started successfully")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="axles-voice-agent",
        )
    )
