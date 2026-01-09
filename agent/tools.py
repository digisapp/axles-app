"""
Tools for AxlesAI Voice Agent

Provides inventory search, lead capture, and settings functionality via Supabase.
"""

import os
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from supabase import create_client, Client

logger = logging.getLogger("axles-agent.tools")


# Default settings if database fetch fails
DEFAULT_SETTINGS = {
    "voice": "Sal",
    "agent_name": "Axles AI",
    "greeting_message": "Hello! Thanks for calling Axles AI, your marketplace for trucks, trailers, and heavy equipment. How can I help you find what you're looking for today?",
    "instructions": """You are a helpful AI assistant for AxlesAI, a marketplace for trucks, trailers, and heavy equipment.

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
    "model": "grok-2-public",
    "temperature": 0.7,
    "is_active": True,
}


def get_supabase() -> Client:
    """Get Supabase client."""
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

    if not url or not key:
        raise ValueError("Missing Supabase credentials")

    return create_client(url, key)


def get_ai_agent_settings() -> Dict[str, Any]:
    """Fetch AI agent settings from database."""
    try:
        supabase = get_supabase()
        result = supabase.table("ai_agent_settings").select("*").single().execute()

        if result.data:
            logger.info("Loaded AI agent settings from database")
            return result.data
        else:
            logger.warning("No AI agent settings found, using defaults")
            return DEFAULT_SETTINGS

    except Exception as e:
        logger.error(f"Error fetching AI agent settings: {e}")
        return DEFAULT_SETTINGS


class InventoryTools:
    """Tools for searching and retrieving inventory from Supabase."""

    async def search(
        self,
        category: Optional[str] = None,
        make: Optional[str] = None,
        min_price: Optional[int] = None,
        max_price: Optional[int] = None,
        condition: Optional[str] = None,
        limit: int = 5,
    ) -> str:
        """Search inventory based on filters."""
        try:
            supabase = get_supabase()

            # Build query
            query = supabase.table("listings").select(
                "id, title, price, year, make, model, condition, mileage, city, state"
            ).eq("status", "active")

            # Apply filters
            if category:
                # Join with categories table
                query = query.eq("category_slug", category)

            if make:
                query = query.ilike("make", f"%{make}%")

            if min_price:
                query = query.gte("price", min_price)

            if max_price:
                query = query.lte("price", max_price)

            if condition:
                query = query.eq("condition", condition)

            # Execute query
            result = query.order("created_at", desc=True).limit(limit).execute()

            if not result.data:
                return "No listings found matching your criteria. Would you like to try different filters?"

            # Format results for voice
            listings = result.data
            response_parts = [f"I found {len(listings)} listings:"]

            for i, listing in enumerate(listings, 1):
                price_str = f"${listing['price']:,}" if listing.get('price') else "Call for price"
                year = listing.get('year', '')
                make = listing.get('make', '')
                model = listing.get('model', '')
                condition = listing.get('condition', '')
                location = f"{listing.get('city', '')}, {listing.get('state', '')}".strip(', ')

                response_parts.append(
                    f"{i}. {year} {make} {model}, {condition}, {price_str}"
                    + (f", located in {location}" if location else "")
                )

            return " ".join(response_parts)

        except Exception as e:
            logger.error(f"Error searching inventory: {e}")
            return "I'm having trouble searching our inventory right now. Would you like me to take your information for a callback?"

    async def get_details(self, listing_id: str) -> str:
        """Get detailed information about a specific listing."""
        try:
            supabase = get_supabase()

            result = supabase.table("listings").select(
                """
                id, title, description, price, year, make, model, condition,
                mileage, hours, vin, stock_number, city, state,
                specs, features,
                profiles!user_id(company_name, phone, email)
                """
            ).eq("id", listing_id).single().execute()

            if not result.data:
                return "I couldn't find that listing. It may no longer be available."

            listing = result.data
            dealer = listing.get('profiles', {})

            # Build detailed response
            parts = []

            # Basic info
            title = listing.get('title', 'Unknown')
            price = f"${listing['price']:,}" if listing.get('price') else "Call for price"
            parts.append(f"This is a {title}, priced at {price}.")

            # Condition and mileage
            if listing.get('condition'):
                parts.append(f"It's in {listing['condition']} condition.")
            if listing.get('mileage'):
                parts.append(f"It has {listing['mileage']:,} miles.")
            if listing.get('hours'):
                parts.append(f"It has {listing['hours']:,} hours.")

            # Location
            location = f"{listing.get('city', '')}, {listing.get('state', '')}".strip(', ')
            if location:
                parts.append(f"Located in {location}.")

            # Dealer info
            if dealer.get('company_name'):
                parts.append(f"This is listed by {dealer['company_name']}.")

            # Description summary (first sentence)
            if listing.get('description'):
                desc = listing['description'].split('.')[0]
                if len(desc) < 200:
                    parts.append(desc + ".")

            return " ".join(parts)

        except Exception as e:
            logger.error(f"Error getting listing details: {e}")
            return "I'm having trouble getting the details right now. Would you like me to take your information for a callback?"

    async def get_dealer_phone(self, listing_id: str) -> Optional[str]:
        """Get the dealer's phone number for a listing."""
        try:
            supabase = get_supabase()

            result = supabase.table("listings").select(
                "profiles!user_id(phone)"
            ).eq("id", listing_id).single().execute()

            if result.data and result.data.get('profiles'):
                return result.data['profiles'].get('phone')
            return None

        except Exception as e:
            logger.error(f"Error getting dealer phone: {e}")
            return None


class LeadTools:
    """Tools for capturing and managing leads."""

    async def capture(
        self,
        name: str,
        phone: str,
        interest: str,
        email: Optional[str] = None,
        listing_id: Optional[str] = None,
        intent: Optional[str] = None,  # buy, lease, rent
        equipment_type: Optional[str] = None,
    ) -> str:
        """Capture a lead and save to Supabase."""
        result, _ = await self.capture_with_id(
            name=name,
            phone=phone,
            interest=interest,
            email=email,
            listing_id=listing_id,
            intent=intent,
            equipment_type=equipment_type,
        )
        return result

    async def capture_with_id(
        self,
        name: str,
        phone: str,
        interest: str,
        email: Optional[str] = None,
        listing_id: Optional[str] = None,
        intent: Optional[str] = None,  # buy, lease, rent
        equipment_type: Optional[str] = None,
    ) -> tuple[str, Optional[str]]:
        """Capture a lead and return both message and lead ID."""
        try:
            supabase = get_supabase()

            # If we have a listing_id, get the dealer's user_id
            user_id = None
            if listing_id:
                listing_result = supabase.table("listings").select(
                    "user_id"
                ).eq("id", listing_id).single().execute()

                if listing_result.data:
                    user_id = listing_result.data.get('user_id')

            # Create the lead with correct field names
            lead_data = {
                "buyer_name": name,
                "buyer_phone": phone,
                "buyer_email": email or "",
                "message": interest,
                "status": "new",
                "intent": intent,  # buy, lease, rent
                "equipment_type": equipment_type,
                "created_at": datetime.utcnow().isoformat(),
            }

            if listing_id:
                lead_data["listing_id"] = listing_id
            if user_id:
                lead_data["user_id"] = user_id

            result = supabase.table("leads").insert(lead_data).execute()

            if result.data:
                lead_id = result.data[0].get('id') if result.data else None
                logger.info(f"Lead captured successfully: {name} - {phone} - intent: {intent} - id: {lead_id}")
                intent_str = f" to {intent}" if intent else ""
                return f"I've captured your information. A dealer will reach out to you at {phone} soon about {interest}{intent_str}.", lead_id
            else:
                return "I've noted your information. A team member will follow up with you shortly.", None

        except Exception as e:
            logger.error(f"Error capturing lead: {e}")
            return "I've noted your information. Someone will be in touch with you soon.", None

    async def get_recent_leads(self, user_id: str, limit: int = 10) -> list:
        """Get recent leads for a dealer."""
        try:
            supabase = get_supabase()

            result = supabase.table("leads").select(
                "*"
            ).eq("user_id", user_id).order(
                "created_at", desc=True
            ).limit(limit).execute()

            return result.data or []

        except Exception as e:
            logger.error(f"Error getting leads: {e}")
            return []


async def update_lead_with_recording(
    lead_id: str,
    recording_url: Optional[str] = None,
    duration_seconds: Optional[int] = None,
    call_sid: Optional[str] = None,
) -> bool:
    """Update a lead with call recording information."""
    try:
        supabase = get_supabase()

        update_data = {}
        if recording_url:
            update_data["call_recording_url"] = recording_url
        if duration_seconds:
            update_data["call_duration_seconds"] = duration_seconds
        if call_sid:
            update_data["call_sid"] = call_sid

        if not update_data:
            return False

        result = supabase.table("leads").update(update_data).eq("id", lead_id).execute()

        if result.data:
            logger.info(f"Updated lead {lead_id} with recording: url={recording_url}, duration={duration_seconds}s")
            return True
        return False

    except Exception as e:
        logger.error(f"Error updating lead with recording: {e}")
        return False


class CallLogTools:
    """Tools for logging all calls."""

    async def create_call_log(
        self,
        caller_phone: str,
        call_sid: str,
    ) -> Optional[str]:
        """Create a call log entry when call starts. Returns call_log_id."""
        try:
            supabase = get_supabase()

            result = supabase.table("call_logs").insert({
                "caller_phone": caller_phone,
                "call_sid": call_sid,
                "status": "in_progress",
            }).execute()

            if result.data:
                call_log_id = result.data[0].get('id')
                logger.info(f"Created call log: {call_log_id} for {caller_phone}")
                return call_log_id
            return None

        except Exception as e:
            logger.error(f"Error creating call log: {e}")
            return None

    async def update_call_log(
        self,
        call_log_id: str,
        caller_name: Optional[str] = None,
        duration_seconds: Optional[int] = None,
        recording_url: Optional[str] = None,
        interest: Optional[str] = None,
        equipment_type: Optional[str] = None,
        intent: Optional[str] = None,
        lead_id: Optional[str] = None,
        summary: Optional[str] = None,
        status: str = "completed",
    ) -> bool:
        """Update call log when call ends."""
        try:
            supabase = get_supabase()

            update_data = {
                "status": status,
                "ended_at": datetime.utcnow().isoformat(),
            }

            if caller_name:
                update_data["caller_name"] = caller_name
            if duration_seconds:
                update_data["duration_seconds"] = duration_seconds
            if recording_url:
                update_data["recording_url"] = recording_url
            if interest:
                update_data["interest"] = interest
            if equipment_type:
                update_data["equipment_type"] = equipment_type
            if intent:
                update_data["intent"] = intent
            if lead_id:
                update_data["lead_id"] = lead_id
            if summary:
                update_data["summary"] = summary

            result = supabase.table("call_logs").update(update_data).eq("id", call_log_id).execute()

            if result.data:
                logger.info(f"Updated call log {call_log_id}")
                return True
            return False

        except Exception as e:
            logger.error(f"Error updating call log: {e}")
            return False
