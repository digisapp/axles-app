"""
AxlesAI Voice Agent - LiveKit + xAI

A voice AI agent that answers phone calls about truck and trailer inventory.
Uses xAI's native Grok Voice API for speech-to-speech conversation.
Settings are loaded from the database (configurable via admin panel).
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
from livekit.plugins import xai as lk_xai

from tools import InventoryTools, LeadTools, get_ai_agent_settings

load_dotenv()

logger = logging.getLogger("axles-agent")
logger.setLevel(logging.INFO)


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

    @function_tool()
    async def transfer_to_dealer(self, ctx: RunContext, dealer_phone: str) -> str:
        """Transfer the call to a dealer's phone number.

        Args:
            dealer_phone: The dealer's phone number to transfer to
        """
        job_ctx = get_job_context()
        if job_ctx is None:
            return "Unable to transfer call - not in call context"

        try:
            caller_identity = None
            for p in job_ctx.room.remote_participants.values():
                if p.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP:
                    caller_identity = p.identity
                    break

            if caller_identity:
                await job_ctx.api.sip.transfer_sip_participant(
                    api.TransferSIPParticipantRequest(
                        room_name=job_ctx.room.name,
                        participant_identity=caller_identity,
                        transfer_to=f"tel:{dealer_phone}",
                    )
                )
                return "Call transferred successfully"
            else:
                return "Could not find caller to transfer"
        except Exception as e:
            logger.error(f"Error transferring call: {e}")
            return f"Could not transfer call: {str(e)}"


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the voice agent."""

    logger.info(f"Agent starting in room: {ctx.room.name}")

    # Load settings from database
    settings = get_ai_agent_settings()
    logger.info(f"Using voice: {settings.get('voice')}, model: {settings.get('model')}")

    # Check if agent is active
    if not settings.get('is_active', True):
        logger.warning("AI agent is disabled in settings")
        return

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

    # Create xAI Realtime model with settings from database
    # Note: xAI RealtimeModel only accepts 'voice' and 'api_key' as main parameters
    xai_model = lk_xai.realtime.RealtimeModel(
        voice=settings.get('voice', 'Sal'),
        api_key=os.getenv("XAI_API_KEY"),
    )

    # Create tools instance
    tools = AxlesTools()

    # Create realtime session
    session = lk_xai.realtime.RealtimeSession(realtime_model=xai_model)

    # Set instructions from database
    session.session_update(instructions=settings.get('instructions', ''))

    # Start session with room and tools
    session.start(ctx.room, fnc_ctx=tools)

    # Greet inbound callers with message from database
    if phone_number is None:
        greeting = settings.get('greeting_message', 'Hello! How can I help you?')
        session.conversation.item.create(
            type="message",
            role="assistant",
            content=[{
                "type": "text",
                "text": greeting
            }]
        )
        session.response.create()

    logger.info("xAI voice agent session started successfully")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="axles-voice-agent",
        )
    )
