"""
Tools for AxlesAI Voice Agent

Provides inventory search and lead capture functionality via Supabase.
"""

import os
import logging
from datetime import datetime
from typing import Optional
from supabase import create_client, Client

logger = logging.getLogger("axles-agent.tools")


def get_supabase() -> Client:
    """Get Supabase client."""
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

    if not url or not key:
        raise ValueError("Missing Supabase credentials")

    return create_client(url, key)


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
        source: str = "phone_call",
    ) -> str:
        """Capture a lead and save to Supabase."""
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

            # Create the lead
            lead_data = {
                "name": name,
                "phone": phone,
                "email": email,
                "message": interest,
                "source": source,
                "status": "new",
                "created_at": datetime.utcnow().isoformat(),
            }

            if listing_id:
                lead_data["listing_id"] = listing_id
            if user_id:
                lead_data["user_id"] = user_id

            result = supabase.table("leads").insert(lead_data).execute()

            if result.data:
                logger.info(f"Lead captured successfully: {name} - {phone}")
                return f"I've captured your information. A dealer will reach out to you at {phone} soon about {interest}."
            else:
                return "I've noted your information. A team member will follow up with you shortly."

        except Exception as e:
            logger.error(f"Error capturing lead: {e}")
            return "I've noted your information. Someone will be in touch with you soon."

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
