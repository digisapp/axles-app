"""
AxlesAI Voice Agent - LiveKit + xAI

A voice AI agent that answers phone calls about truck and trailer inventory.
Uses xAI's native Grok Voice API for speech-to-speech conversation.
Settings are loaded from the database (configurable via admin panel).
Includes automatic call recording.
"""

import os
import logging
import time
import asyncio
from dotenv import load_dotenv

from livekit import api, rtc
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

from tools import InventoryTools, LeadTools, get_ai_agent_settings, update_lead_with_recording

load_dotenv()

logger = logging.getLogger("axles-agent")
logger.setLevel(logging.INFO)

# Track active calls for recording
active_calls = {}


class AxlesAgent(Agent):
    """Voice AI agent for AxlesAI marketplace."""

    def __init__(self, settings: dict, room_name: str) -> None:
        super().__init__(
            instructions=settings.get('instructions', 'You are a helpful AI assistant.'),
        )
        self.settings = settings
        self.room_name = room_name
        self.inventory_tools = InventoryTools()
        self.lead_tools = LeadTools()
        self.captured_lead_id = None

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
        intent: str | None = None,
        equipment_type: str | None = None,
    ) -> str:
        """Capture caller's information as a lead for dealer follow-up.

        Args:
            name: Caller's name
            phone: Caller's phone number
            interest: What they're looking for or interested in
            email: Caller's email (optional)
            listing_id: Specific listing they're interested in (optional)
            intent: Whether they want to 'buy', 'lease', or 'rent'
            equipment_type: Type of equipment (e.g., 'flatbed trailer', 'semi truck')
        """
        result, lead_id = await self.lead_tools.capture_with_id(
            name=name,
            phone=phone,
            interest=interest,
            email=email,
            listing_id=listing_id,
            intent=intent,
            equipment_type=equipment_type,
            source="phone_call",
        )

        # Store lead ID for recording association
        if lead_id:
            self.captured_lead_id = lead_id
            # Store in active_calls for later recording update
            if self.room_name in active_calls:
                active_calls[self.room_name]['lead_id'] = lead_id

        return result


async def start_recording(ctx: JobContext) -> str | None:
    """Start recording the call using LiveKit Egress."""
    try:
        livekit_api = api.LiveKitAPI(
            url=os.getenv("LIVEKIT_URL"),
            api_key=os.getenv("LIVEKIT_API_KEY"),
            api_secret=os.getenv("LIVEKIT_API_SECRET"),
        )

        # Configure S3 output (or use LiveKit's default storage)
        s3_upload = api.S3Upload(
            access_key=os.getenv("AWS_ACCESS_KEY_ID", ""),
            secret=os.getenv("AWS_SECRET_ACCESS_KEY", ""),
            bucket=os.getenv("S3_BUCKET", "axles-recordings"),
            region=os.getenv("AWS_REGION", "us-east-1"),
        )

        # Start room composite egress (records audio)
        egress_request = api.RoomCompositeEgressRequest(
            room_name=ctx.room.name,
            audio_only=True,
            file_outputs=[
                api.EncodedFileOutput(
                    file_type=api.EncodedFileType.MP3,
                    filepath=f"calls/{ctx.room.name}-{int(time.time())}.mp3",
                    s3=s3_upload,
                )
            ],
        )

        egress_info = await livekit_api.egress.start_room_composite_egress(egress_request)
        logger.info(f"Started recording: {egress_info.egress_id}")

        await livekit_api.aclose()
        return egress_info.egress_id

    except Exception as e:
        logger.error(f"Failed to start recording: {e}")
        return None


async def stop_recording(egress_id: str) -> tuple[str | None, int | None]:
    """Stop recording and get the recording URL."""
    try:
        livekit_api = api.LiveKitAPI(
            url=os.getenv("LIVEKIT_URL"),
            api_key=os.getenv("LIVEKIT_API_KEY"),
            api_secret=os.getenv("LIVEKIT_API_SECRET"),
        )

        # Stop the egress
        egress_info = await livekit_api.egress.stop_egress(api.StopEgressRequest(egress_id=egress_id))

        # Get the recording URL from file results
        recording_url = None
        if egress_info.file_results:
            for file_result in egress_info.file_results:
                if file_result.location:
                    recording_url = file_result.location
                    break

        # Calculate duration
        duration = None
        if egress_info.ended_at and egress_info.started_at:
            duration = int((egress_info.ended_at - egress_info.started_at) / 1_000_000_000)  # nanoseconds to seconds

        logger.info(f"Recording stopped: {recording_url}, duration: {duration}s")

        await livekit_api.aclose()
        return recording_url, duration

    except Exception as e:
        logger.error(f"Failed to stop recording: {e}")
        return None, None


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the voice agent."""

    logger.info(f"Agent starting in room: {ctx.room.name}")
    call_start_time = time.time()
    egress_id = None

    # Load settings from database
    settings = get_ai_agent_settings()
    logger.info(f"Using voice: {settings.get('voice')}")

    # Check if agent is active
    if not settings.get('is_active', True):
        logger.warning("AI agent is disabled in settings")
        return

    # Connect to the room
    await ctx.connect()

    # Initialize call tracking
    active_calls[ctx.room.name] = {
        'start_time': call_start_time,
        'lead_id': None,
        'egress_id': None,
    }

    # Start recording if S3 is configured
    if os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("S3_BUCKET"):
        egress_id = await start_recording(ctx)
        if egress_id:
            active_calls[ctx.room.name]['egress_id'] = egress_id
    else:
        logger.info("Recording disabled - S3 not configured")

    # Create xAI Realtime model with voice from settings
    model = xai.realtime.RealtimeModel(
        voice=settings.get('voice', 'Sal'),
        api_key=os.getenv("XAI_API_KEY"),
    )

    # Create agent with instructions from settings
    agent = AxlesAgent(settings, ctx.room.name)

    # Create session with xAI model
    session = AgentSession(llm=model)

    # Start the session
    await session.start(room=ctx.room, agent=agent)

    # Generate greeting for inbound callers
    greeting = settings.get('greeting_message', 'Hello! How can I help you today?')
    await session.generate_reply(instructions=greeting)

    logger.info("xAI voice agent session started successfully")

    # Wait for the session to end
    try:
        await session.wait()
    except asyncio.CancelledError:
        pass
    finally:
        # Calculate call duration
        call_duration = int(time.time() - call_start_time)
        logger.info(f"Call ended. Duration: {call_duration}s")

        # Stop recording and get URL
        recording_url = None
        call_info = active_calls.get(ctx.room.name, {})
        egress_id = call_info.get('egress_id')
        lead_id = call_info.get('lead_id') or agent.captured_lead_id

        if egress_id:
            recording_url, recorded_duration = await stop_recording(egress_id)
            if recorded_duration:
                call_duration = recorded_duration

        # Update lead with recording info
        if lead_id and (recording_url or call_duration):
            await update_lead_with_recording(
                lead_id=lead_id,
                recording_url=recording_url,
                duration_seconds=call_duration,
                call_sid=ctx.room.name,
            )
            logger.info(f"Updated lead {lead_id} with recording info")

        # Cleanup
        if ctx.room.name in active_calls:
            del active_calls[ctx.room.name]


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="axles-voice-agent",
        )
    )
