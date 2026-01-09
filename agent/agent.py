"""
AxlesAI Voice Agent - LiveKit + xAI

A voice AI agent that answers phone calls about truck and trailer inventory.
Uses xAI's Grok for conversation and connects to Supabase for live inventory data.
"""

import os
import json
import logging
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
    get_job_context,
)
from livekit.agents.llm import ChatContext, ChatMessage
from livekit.plugins import deepgram, silero, openai as lk_openai

from tools import InventoryTools, LeadTools

load_dotenv()

logger = logging.getLogger("axles-agent")
logger.setLevel(logging.INFO)


class AxlesAssistant(Agent):
    """Voice AI assistant for AxlesAI truck and trailer marketplace."""

    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful AI assistant for AxlesAI, a marketplace for trucks, trailers, and heavy equipment.

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
""",
        )
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
        await ctx.session.generate_reply(
            instructions="Let the caller know you're transferring them to a dealer now."
        )

        job_ctx = get_job_context()
        if job_ctx is None:
            return "Unable to transfer call - not in call context"

        try:
            # Get the SIP participant identity (the caller)
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

    @function_tool()
    async def end_call(self, ctx: RunContext) -> None:
        """End the call when the conversation is complete."""
        await ctx.session.generate_reply(
            instructions="Thank the caller for calling AxlesAI and wish them well."
        )

        job_ctx = get_job_context()
        if job_ctx:
            await job_ctx.api.room.delete_room(
                api.DeleteRoomRequest(room=job_ctx.room.name)
            )


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

    # Create xAI client (compatible with OpenAI SDK)
    xai_llm = lk_openai.LLM(
        model="grok-beta",  # or grok-2-latest
        base_url="https://api.x.ai/v1",
        api_key=os.getenv("XAI_API_KEY"),
    )

    # Create the agent session
    session = AgentSession(
        stt=deepgram.STT(),
        llm=xai_llm,
        tts=deepgram.TTS(voice="aura-asteria-en"),  # or use elevenlabs
        vad=silero.VAD.load(),
    )

    # Create assistant and start session
    assistant = AxlesAssistant()
    await session.start(ctx.room, agent=assistant)

    # Greet inbound callers (outbound waits for recipient to speak first)
    if phone_number is None:
        await session.generate_reply(
            instructions="Greet the caller warmly and ask how you can help them find trucks or trailers today."
        )

    logger.info("Agent session started successfully")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="axles-voice-agent",
        )
    )
