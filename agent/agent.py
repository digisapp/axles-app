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

from tools import (
    InventoryTools,
    LeadTools,
    CallLogTools,
    StaffAuthTools,
    get_ai_agent_settings,
    get_dealer_voice_agent_by_phone,
    build_dealer_instructions,
    increment_dealer_minutes,
    update_lead_with_recording,
    is_within_business_hours,
    validate_e164_phone,
    transcribe_call_recording,
    summarize_call,
)

load_dotenv()

logger = logging.getLogger("axles-agent")
logger.setLevel(logging.INFO)

# Track active calls for recording
active_calls = {}


class AxlesAgent(Agent):
    """Voice AI agent for AxlesAI marketplace."""

    def __init__(
        self,
        settings: dict,
        room_name: str,
        caller_phone: str = None,
        dealer_id: str = None,
        business_name: str = None,
        can_transfer: bool = False,
        transfer_number: str = None,
    ) -> None:
        super().__init__(
            instructions=settings.get('instructions', 'You are a helpful AI assistant.'),
        )
        self.settings = settings
        self.room_name = room_name
        self.caller_phone = caller_phone
        self.dealer_id = dealer_id
        self.business_name = business_name
        self.can_transfer = can_transfer
        self.transfer_number = transfer_number

        # Initialize tools with dealer context if this is a dealer call
        self.inventory_tools = InventoryTools(dealer_id=dealer_id)
        self.lead_tools = LeadTools(dealer_id=dealer_id, business_name=business_name)
        self.staff_auth_tools = StaffAuthTools(dealer_id=dealer_id) if dealer_id else None

        self.captured_lead_id = None
        self.caller_name = None
        self.interest = None
        self.equipment_type = None
        self.intent = None
        self.is_staff_authenticated = False
        self.session = None  # Will be set after session starts

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

    @function_tool()
    async def verify_staff_pin(
        self,
        ctx: RunContext,
        name: str,
        pin: str,
    ) -> str:
        """Verify a staff member's identity using their name and PIN.

        Use this when someone identifies themselves as an employee or staff member
        and wants to access internal dealership data like inventory costs,
        margins, leads, or customer information.

        Args:
            name: The staff member's name
            pin: Their 4-6 digit access PIN
        """
        if not self.staff_auth_tools:
            return "Staff authentication is not available for this line."

        success, staff_info, message = await self.staff_auth_tools.verify_pin(
            name=name,
            pin=pin,
            caller_phone=self.caller_phone,
        )

        if success:
            self.is_staff_authenticated = True
            self.caller_name = staff_info.get('name')
            # Include what they can access
            permissions = []
            if staff_info.get('can_view_costs'):
                permissions.append("costs")
            if staff_info.get('can_view_margins'):
                permissions.append("margins")
            if staff_info.get('can_view_all_leads'):
                permissions.append("all leads")
            perm_str = ", ".join(permissions) if permissions else "standard inventory and leads"
            return f"{message} You have access to {perm_str}. What would you like to know?"

        return message

    @function_tool()
    async def query_internal_data(
        self,
        ctx: RunContext,
        query_type: str,
        query: str | None = None,
        filter_status: str | None = None,
        filter_today: bool = False,
    ) -> str:
        """Query internal dealership data. Only available after staff authentication.

        Args:
            query_type: What to query - 'inventory', 'leads', 'customer', 'pricing', or 'stats'
            query: For customer lookup: name or phone. For pricing: stock number.
            filter_status: Filter by status (e.g., 'active', 'new', 'sold')
            filter_today: For leads, only show today's leads
        """
        if not self.staff_auth_tools:
            return "Internal data access is not available for this line."

        if not self.is_staff_authenticated:
            return "You need to authenticate first. Please tell me your name and PIN."

        filters = {}
        if filter_status:
            filters['status'] = filter_status
        if filter_today:
            filters['today'] = True

        result = await self.staff_auth_tools.query_internal_data(
            query_type=query_type,
            query=query,
            filters=filters if filters else None,
        )

        # Log the query
        if self.staff_auth_tools.authenticated_staff:
            from tools import get_supabase
            try:
                supabase = get_supabase()
                supabase.table("dealer_staff_access_logs").insert({
                    "dealer_id": self.dealer_id,
                    "staff_id": self.staff_auth_tools.authenticated_staff['id'],
                    "query_type": query_type,
                    "query": query[:500] if query else None,
                    "response_summary": result[:200] if result else None,
                    "auth_success": True,
                }).execute()
            except Exception as e:
                logger.warning(f"Failed to log staff query: {e}")

        return result

    @function_tool()
    async def transfer_call(
        self,
        ctx: RunContext,
        reason: str = "Caller requested to speak with a person",
    ) -> str:
        """Transfer the call to a human representative.

        Use this when the caller explicitly asks to speak with a person,
        or when you cannot adequately help them with their request.

        Args:
            reason: Brief reason for the transfer
        """
        if not self.can_transfer or not self.transfer_number:
            return "I'm sorry, call transfers are not available right now. Would you like me to take your information so someone can call you back?"

        # Validate transfer number
        is_valid, normalized = validate_e164_phone(self.transfer_number)
        if not is_valid:
            logger.error(f"Invalid transfer number configured: {self.transfer_number}")
            return "I'm sorry, I'm unable to transfer the call right now. Would you like me to take your information for a callback?"

        try:
            # Create SIP participant for transfer
            livekit_api = api.LiveKitAPI(
                url=os.getenv("LIVEKIT_URL"),
                api_key=os.getenv("LIVEKIT_API_KEY"),
                api_secret=os.getenv("LIVEKIT_API_SECRET"),
            )

            # Create outbound SIP call to transfer number
            sip_trunk_id = os.getenv("LIVEKIT_SIP_TRUNK_ID", "")
            if not sip_trunk_id:
                logger.error("LIVEKIT_SIP_TRUNK_ID not configured for transfers")
                await livekit_api.aclose()
                return "I'm sorry, call transfers are not configured. Would you like me to take your information for a callback?"

            # Create SIP participant (dial out to transfer number)
            await livekit_api.sip.create_sip_participant(
                api.CreateSIPParticipantRequest(
                    sip_trunk_id=sip_trunk_id,
                    sip_call_to=normalized,
                    room_name=self.room_name,
                    participant_identity=f"transfer-{normalized}",
                    participant_name=self.business_name or "Transfer",
                )
            )

            await livekit_api.aclose()

            logger.info(f"Call transfer initiated to {normalized}: {reason}")

            # Update call log with transfer info
            if self.room_name in active_calls:
                active_calls[self.room_name]['transferred'] = True
                active_calls[self.room_name]['transfer_reason'] = reason

            return f"I'm connecting you now. Please hold while I transfer your call."

        except Exception as e:
            logger.error(f"Error transferring call: {e}")
            return "I'm sorry, I wasn't able to complete the transfer. Would you like me to take your information so someone can call you back?"


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
        service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

        # Configure S3-compatible upload for Supabase Storage
        # Supabase S3 uses project_ref as access_key and service_role_key as secret
        # See: https://supabase.com/docs/guides/storage/s3/authentication
        s3_upload = api.S3Upload(
            access_key=project_ref,
            secret=service_role_key,
            bucket="call-recordings",
            region="us-east-1",  # Required by S3 protocol but Supabase ignores it
            endpoint=f"{supabase_url}/storage/v1/s3",
            force_path_style=True,
        )

        if not project_ref or not service_role_key:
            logger.warning("Missing Supabase credentials for recording - skipping")
            await livekit_api.aclose()
            return None

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


def get_called_number(ctx: JobContext) -> str | None:
    """Extract the called number (DID) from SIP participant metadata.

    This is the number the caller dialed - used for multi-tenant routing.
    """
    for participant in ctx.room.remote_participants.values():
        if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP:
            # Try to get from metadata first
            if participant.metadata:
                import json
                try:
                    metadata = json.loads(participant.metadata)
                    # LiveKit SIP typically includes called number in metadata
                    if 'sip.calledNumber' in metadata:
                        return metadata['sip.calledNumber']
                    if 'calledNumber' in metadata:
                        return metadata['calledNumber']
                except json.JSONDecodeError:
                    pass

            # Try to get from name (some setups put DID there)
            if participant.name and participant.name.startswith('+'):
                return participant.name

    # Check room metadata as fallback
    if ctx.room.metadata:
        import json
        try:
            room_meta = json.loads(ctx.room.metadata)
            if 'sip.calledNumber' in room_meta:
                return room_meta['sip.calledNumber']
        except json.JSONDecodeError:
            pass

    return None


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the voice agent.

    Supports multi-tenant operation:
    - Detects the called number (DID) to determine if this is a dealer's line
    - If dealer line: uses dealer's custom settings, filters inventory to dealer only
    - If main line: uses global AxlesAI settings, searches all inventory
    """

    logger.info(f"Agent starting in room: {ctx.room.name}")
    call_start_time = time.time()
    egress_id = None
    call_log_id = None
    call_log_tools = CallLogTools()

    # Connect to the room first to access participant info
    await ctx.connect()

    # Get caller phone from SIP participant
    caller_phone = get_caller_phone(ctx)
    logger.info(f"Caller phone: {caller_phone}")

    # Get the called number (DID) to determine which agent to use
    called_number = get_called_number(ctx)
    logger.info(f"Called number (DID): {called_number}")

    # Check if this is a dealer's dedicated line
    dealer_agent = None
    dealer_id = None
    dealer_voice_agent_id = None
    business_name = None

    if called_number:
        dealer_agent = get_dealer_voice_agent_by_phone(called_number)

    # Transfer settings (will be set for dealer calls)
    can_transfer = False
    transfer_number = None
    is_after_hours = False

    if dealer_agent:
        # This is a dealer's dedicated line
        dealer_id = dealer_agent.get('dealer_id')
        dealer_voice_agent_id = dealer_agent.get('id')
        business_name = dealer_agent.get('business_name') or dealer_agent.get('dealer', {}).get('company_name')

        logger.info(f"Dealer call detected: {business_name} (dealer_id: {dealer_id})")

        # Check business hours
        business_hours = dealer_agent.get('business_hours')
        if business_hours:
            is_after_hours = not is_within_business_hours(business_hours)
            logger.info(f"Business hours check: {'CLOSED' if is_after_hours else 'OPEN'}")

        # Get transfer settings
        can_transfer = dealer_agent.get('can_transfer_calls', False)
        transfer_number = dealer_agent.get('transfer_phone_number')

        # Build settings from dealer agent config
        if is_after_hours:
            # Use after-hours greeting and simplified instructions
            after_hours_msg = dealer_agent.get('after_hours_message',
                'We are currently closed. Please leave your name and number and we will call you back.')
            settings = {
                'voice': dealer_agent.get('voice', 'Sal'),
                'greeting_message': after_hours_msg,
                'instructions': f"""You are {dealer_agent.get('agent_name', 'an AI assistant')} for {business_name}.

The business is currently CLOSED. Your role is to:
1. Let the caller know we are closed
2. Capture their name, phone number, and what they're interested in
3. Assure them someone will call them back during business hours

Keep the conversation brief and focused on capturing their information for a callback.
Do not search inventory or provide detailed information - just capture the lead.""",
                'is_active': dealer_agent.get('is_active', True),
            }
        else:
            settings = {
                'voice': dealer_agent.get('voice', 'Sal'),
                'greeting_message': dealer_agent.get('greeting', 'Thanks for calling! How can I help you today?'),
                'instructions': build_dealer_instructions(dealer_agent),
                'is_active': dealer_agent.get('is_active', True),
            }
    else:
        # This is the main AxlesAI line - use global settings
        logger.info("Main line call - using global AxlesAI settings")
        settings = get_ai_agent_settings()

    logger.info(f"Using voice: {settings.get('voice')}")

    # Check if agent is active
    if not settings.get('is_active', True):
        logger.warning("AI agent is disabled in settings")
        return

    # Create call log entry with dealer info if applicable
    if caller_phone:
        call_log_id = await call_log_tools.create_call_log(
            caller_phone=caller_phone,
            call_sid=ctx.room.name,
            dealer_id=dealer_id,
            dealer_voice_agent_id=dealer_voice_agent_id,
        )

    # Initialize call tracking
    active_calls[ctx.room.name] = {
        'start_time': call_start_time,
        'lead_id': None,
        'egress_id': None,
        'call_log_id': call_log_id,
        'caller_phone': caller_phone,
        'dealer_id': dealer_id,
        'dealer_voice_agent_id': dealer_voice_agent_id,
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

    # Create agent with dealer context if applicable
    agent = AxlesAgent(
        settings=settings,
        room_name=ctx.room.name,
        caller_phone=caller_phone,
        dealer_id=dealer_id,
        business_name=business_name,
        can_transfer=can_transfer,
        transfer_number=transfer_number,
    )

    # Create session with xAI model
    session = AgentSession(llm=model)

    # Start the session
    await session.start(room=ctx.room, agent=agent)

    # Generate greeting for inbound callers
    greeting = settings.get('greeting_message', 'Hello! How can I help you today?')
    await session.generate_reply(instructions=greeting)

    logger.info(f"xAI voice agent session started successfully" +
               (f" for {business_name}" if business_name else ""))

    # Wait for the session to end
    try:
        await session.wait()
    except asyncio.CancelledError:
        pass
    finally:
        # Calculate call duration
        call_duration = int(time.time() - call_start_time)
        call_minutes = max(1, (call_duration + 59) // 60)  # Round up to nearest minute
        logger.info(f"Call ended. Duration: {call_duration}s ({call_minutes} min)")

        # Stop recording and get URL
        recording_url = None
        call_info = active_calls.get(ctx.room.name, {})
        egress_id = call_info.get('egress_id')
        lead_id = call_info.get('lead_id') or agent.captured_lead_id
        call_log_id = call_info.get('call_log_id')
        dealer_voice_agent_id = call_info.get('dealer_voice_agent_id')

        if egress_id:
            recording_url, recorded_duration = await stop_recording(egress_id)
            if recorded_duration:
                call_duration = recorded_duration
                call_minutes = max(1, (call_duration + 59) // 60)

        # Update dealer minutes used (for billing)
        if dealer_voice_agent_id:
            await increment_dealer_minutes(dealer_voice_agent_id, call_minutes)

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

            # Transcribe recording in background (don't block cleanup)
            if recording_url and call_duration and call_duration > 5:
                # Only transcribe calls longer than 5 seconds
                asyncio.create_task(
                    transcribe_and_summarize(call_log_id, recording_url)
                )

        # Cleanup
        if ctx.room.name in active_calls:
            del active_calls[ctx.room.name]


async def transcribe_and_summarize(call_log_id: str, recording_url: str):
    """Background task to transcribe and summarize a call."""
    try:
        logger.info(f"Starting transcription for call {call_log_id}")
        transcript = await transcribe_call_recording(call_log_id, recording_url)

        if transcript:
            logger.info(f"Generating summary for call {call_log_id}")
            await summarize_call(call_log_id, transcript)
    except Exception as e:
        logger.error(f"Error in transcription task: {e}")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="axles-voice-agent",
        )
    )
