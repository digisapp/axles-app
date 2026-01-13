# AxlesAI Voice Agent

Voice AI agent powered by LiveKit and xAI (Grok) for handling phone calls about truck and trailer inventory. Uses xAI's native Grok Voice API for speech-to-speech conversation.

## Architecture

```
Phone Call → LiveKit SIP → Agent Room → AxlesAgent
                                              ↓
                                         xAI (Grok Voice API)
                                              ↓
                                    Supabase (Inventory/Leads)
```

## Features

- **Inbound Calls**: Answer calls and help callers find equipment
- **Multi-Tenant**: Route calls to dealer-specific agents based on called number (DID)
- **Inventory Search**: Query live Supabase inventory by category, make, price, condition
- **Lead Capture**: Save caller information for dealer follow-up
- **Call Recording**: Automatic recording to Supabase Storage via LiveKit Egress
- **Staff Authentication**: PIN-based verification for internal dealership data access
- **xAI Powered**: Uses Grok Voice API for natural speech-to-speech conversation

## Setup

### 1. Install Dependencies

```bash
cd agent
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required credentials:
- **LiveKit**: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` from [LiveKit Cloud](https://cloud.livekit.io)
- **xAI**: `XAI_API_KEY` from [x.ai](https://x.ai)
- **Supabase**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (same as Next.js app)

### 3. Get a Phone Number

Option A: LiveKit Phone Numbers (easiest)
```bash
# Install LiveKit CLI
brew install livekit-cli

# List available numbers
lk sip phone list-available --country US --region TX

# Purchase a number
lk sip phone purchase --number +1234567890
```

Option B: Bring your own SIP trunk (Twilio, etc.)
- Follow [LiveKit SIP setup guide](https://docs.livekit.io/agents/telephony/sip-trunk/)

### 4. Create Dispatch Rule

Create a file `dispatch-rule.json`:
```json
{
    "dispatch_rule": {
        "rule": {
            "dispatchRuleIndividual": {
                "roomPrefix": "call-"
            }
        },
        "roomConfig": {
            "agents": [{
                "agentName": "axles-voice-agent"
            }]
        }
    }
}
```

Apply the rule:
```bash
lk sip dispatch create dispatch-rule.json
```

### 5. Run the Agent

Development mode (auto-reload):
```bash
python agent.py dev
```

Production mode:
```bash
python agent.py start
```

## Making Outbound Calls

To have the agent call a number:

```bash
lk dispatch create \
    --new-room \
    --agent-name axles-voice-agent \
    --metadata '{"phone_number": "+15105550123"}'
```

## Customization

### Change the Voice

The voice is configured in the database via the admin panel, or you can modify it directly in `agent.py`:

```python
# xAI Grok Voice options
model = xai.realtime.RealtimeModel(
    voice="Sal",  # Available: Sal, Chloe, etc.
    api_key=os.getenv("XAI_API_KEY"),
)
```

### Modify Agent Behavior

Agent behavior is configured per-dealer in the database (`dealer_voice_agents` table) or globally via AI agent settings. The instructions are built dynamically based on dealer configuration.

### Add More Tools

Add new `@function_tool()` methods to the `AxlesAgent` class for additional capabilities.

## Troubleshooting

**Agent doesn't answer**
- Check that dispatch rule is created
- Verify `LIVEKIT_*` credentials are correct
- Check agent logs for errors

**Can't hear agent**
- Verify `XAI_API_KEY` is set and valid
- Check xAI API status

**Inventory search not working**
- Verify `SUPABASE_*` credentials
- Check that listings table has data with status='active'

**Recording not working**
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Ensure `call-recordings` bucket exists in Supabase Storage

## Deployment

For production, deploy the agent to:
- LiveKit Cloud (managed)
- Your own server (Docker)
- Railway, Fly.io, etc.

Example Dockerfile:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "agent.py", "start"]
```
