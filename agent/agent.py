"""
AxlesAI Voice Agent - LiveKit + xAI

A voice AI agent that answers phone calls about truck and trailer inventory.
Uses xAI's Grok Realtime API for native voice-to-voice conversation.
"""

import os
import json
import logging
from dotenv import load_dotenv

from livekit import api, rtc
from livekit.agents import (
    JobContext,
    RunContext,
    WorkerOptions,
    function_tool,
    cli,
    get_job_context,
)
from livekit.plugins.openai import realtime

from tools import InventoryTools, LeadTools

load_dotenv()

logger = logging.getLogger("axles-agent")
logger.setLevel(logging.INFO)

# Agent instructions for xAI Realtime
AGENT_INSTRUCTIONS = """You are a helpful AI assistant for AxlesAI, a marketplace for trucks, trailers, and heavy equipment.

Your role is to:
1. Answer questions about available inventory (trucks, trailers, heavy equipment)
2. Help callers find equipment that matches their needs
3. Provide pricing and specification information
4. Capture lead information for follow-up by dealers
5. Transfer calls to dealers when requested

Guidelines:
- Be friendly, professional, and knowledgeable about commercial trucks and trailers
- Ask clarifying questions to understand what the caller is looking for
- When discussing equipment, mention key specs like year, make, model, price, and condition
- If a caller is interested in a specific unit, offer to capture their information for a callback
- Keep responses concise for phone conversation (2-3 sentences max)
- If you don't have information, offer to connect them with a dealer

Common equipment types:
- Trailers: flatbed, dry van, reefer, lowboy, drop deck, dump, tanker
- Trucks: semi trucks, day cabs, sleeper cabs, box trucks, dump trucks
- Heavy equipment: excavators, loaders, bulldozers, cranes
"""


class AxlesTools:
    """Function tools for the voice agent."""

    def __init__(self) -> None:
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

    # Connect to the room
    await ctx.connect()

    # Check if this is an outbound call
    phone_number = None
    if ctx.job.metadata:
        try:
            dial_info = json.loads(ctx.job.metadata)
            phone_number = dial_info.get("phone_number")
        except json.JSONDecodeError:
            pass

    # Create xAI Realtime model (native voice-to-voice)
    xai_model = realtime.RealtimeModel(
        model="grok-2-public",
        base_url="wss://api.x.ai/v1/realtime",
        api_key=os.getenv("XAI_API_KEY"),
        voice="alloy",
        temperature=0.7,
    )

    # Create tools
    tools = AxlesTools()

    # Create realtime session
    session = realtime.RealtimeSession(realtime_model=xai_model)

    # Set instructions
    session.session_update(instructions=AGENT_INSTRUCTIONS)

    # Start the session with the room
    session.start(ctx.room, fnc_ctx=tools)

    # Greet inbound callers
    if phone_number is None:
        session.conversation.item.create(
            type="message",
            role="assistant",
            content=[{
                "type": "text",
                "text": "Hello! Thanks for calling Axles AI, your marketplace for trucks, trailers, and heavy equipment. How can I help you find what you're looking for today?"
            }]
        )
        session.response.create()

    logger.info("Agent session started successfully")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="axles-voice-agent",
        )
    )
