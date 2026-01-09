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

from tools import InventoryTools, LeadTools, CallLogTools, get_ai_agent_settings, update_lead_with_recording

load_dotenv()

logger = logging.getLogger("axles-agent")
logger.setLevel(logging.INFO)

# Track active calls for recording
active_calls = {}


class AxlesAgent(Agent):
    """Voice AI agent for AxlesAI marketplace."""

    def __init__(self, settings: dict, room_name: str, caller_phone: str = None) -> None:
        super().__init__(
            instructions=settings.get('instructions', 'You are a helpful AI assistant.'),
        )
        self.settings = settings
        self.room_name = room_name
        self.caller_phone = caller_phone
        self.inventory_tools = InventoryTools()
        self.lead_tools = LeadTools()
        self.captured_lead_id = None
        self.caller_name = None
        self.interest = None
        self.equipment_type = None
        self.intent = None

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
        interest: str,
        email: str | None = None,
        phone: str | None = None,
        listing_id: str | None = None,
        intent: str | None = None,
        equipment_type: str | None = None,
    ) -> str:
        """Capture caller's information as a lead for dealer follow-up.

        Args:
            name: Caller's name
            interest: What they're looking for or interested in
            email: Caller's email for follow-up (optional but try to get it)
            phone: Caller's phone number (optional - we have caller ID)
            listing_id: Specific listing they're interested in (optional)
            intent: Whether they want to 'buy', 'lease', or 'rent'
            equipment_type: Type of equipment (e.g., 'flatbed trailer', 'semi truck')
        """
        # Use caller ID if phone not provided
        actual_phone = phone or self.caller_phone or "unknown"

        result, lead_id = await self.lead_tools.capture_with_id(
            name=name,
            phone=actual_phone,
            interest=interest,
            email=email,
            listing_id=listing_id,
            intent=intent,
            equipment_type=equipment_type,
        )

        # Store info for call log
        self.caller_name = name
        self.interest = interest
        self.equipment_type = equipment_type
        self.intent = intent

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

        # Get Supabase project ref from URL (e.g., https://abc123.supabase.co -> abc123)
        supabase_url = os.getenv("SUPABASE_URL", "")
        project_ref = supabase_url.replace("https://", "").split(".")[0] if supabase_url else ""

        # Configure S3-compatible upload for Supabase Storage
        s3_upload = api.S3Upload(
            access_key=project_ref,  # Supabase project ref as access key
            secret=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
            bucket="call-recordings",  # Supabase storage bucket name
            region="us-east-1",  # Required but not used by Supabase
            endpoint=f"{supabase_url}/storage/v1/s3",  # Supabase S3-compatible endpoint
            force_path_style=True,
        )

        # Start room composite egress (records audio)
        filename = f"{ctx.room.name}-{int(time.time())}.mp3"
        egress_request = api.RoomCompositeEgressRequest(
            room_name=ctx.room.name,
            audio_only=True,
            file_outputs=[
                api.EncodedFileOutput(
                    file_type=api.EncodedFileType.MP3,
                    filepath=filename,
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


def get_caller_phone(ctx: JobContext) -> str | None:
    """Extract caller phone number from SIP participant."""
    for participant in ctx.room.remote_participants.values():
        if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP:
            # SIP identity is usually the phone number
            identity = participant.identity
            # Clean up the phone number (remove sip: prefix if present)
            if identity.startswith("sip:"):
                identity = identity[4:]
            if "@" in identity:
                identity = identity.split("@")[0]
            return identity
    return None


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the voice agent."""

    logger.info(f"Agent starting in room: {ctx.room.name}")
    call_start_time = time.time()
    egress_id = None
    call_log_id = None
    call_log_tools = CallLogTools()

    # Load settings from database
    settings = get_ai_agent_settings()
    logger.info(f"Using voice: {settings.get('voice')}")

    # Check if agent is active
    if not settings.get('is_active', True):
        logger.warning("AI agent is disabled in settings")
        return

    # Connect to the room
    await ctx.connect()

    # Get caller phone from SIP participant
    caller_phone = get_caller_phone(ctx)
    logger.info(f"Caller phone: {caller_phone}")

    # Create call log entry
    if caller_phone:
        call_log_id = await call_log_tools.create_call_log(
            caller_phone=caller_phone,
            call_sid=ctx.room.name,
        )

    # Initialize call tracking
    active_calls[ctx.room.name] = {
        'start_time': call_start_time,
        'lead_id': None,
        'egress_id': None,
        'call_log_id': call_log_id,
        'caller_phone': caller_phone,
    }

    # Start recording if Supabase is configured
    if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        egress_id = await start_recording(ctx)
        if egress_id:
            active_calls[ctx.room.name]['egress_id'] = egress_id
    else:
        logger.info("Recording disabled - Supabase not configured")

    # Create xAI Realtime model with voice from settings
    model = xai.realtime.RealtimeModel(
        voice=settings.get('voice', 'Sal'),
        api_key=os.getenv("XAI_API_KEY"),
    )

    # Create agent with instructions from settings and caller phone
    agent = AxlesAgent(settings, ctx.room.name, caller_phone)

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
        call_log_id = call_info.get('call_log_id')

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

        # Update call log with all info
        if call_log_id:
            await call_log_tools.update_call_log(
                call_log_id=call_log_id,
                caller_name=agent.caller_name,
                duration_seconds=call_duration,
                recording_url=recording_url,
                interest=agent.interest,
                equipment_type=agent.equipment_type,
                intent=agent.intent,
                lead_id=lead_id,
                status="completed",
            )
            logger.info(f"Updated call log {call_log_id}")

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
