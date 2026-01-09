# AxlesAI Voice Agent

Voice AI agent powered by LiveKit and xAI (Grok) for handling phone calls about truck and trailer inventory.

## Features

- **Inbound Calls**: Answer calls and help callers find equipment
- **Inventory Search**: Query live Supabase inventory by category, make, price, condition
- **Lead Capture**: Save caller information for dealer follow-up
- **Call Transfer**: Transfer calls to dealers when requested
- **xAI Powered**: Uses Grok for natural conversation

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
- **LiveKit**: Get from [LiveKit Cloud](https://cloud.livekit.io)
- **xAI**: Get from [x.ai](https://x.ai)
- **Deepgram**: Get from [Deepgram](https://deepgram.com)
- **Supabase**: Use same credentials as the Next.js app

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

In `agent.py`, modify the TTS configuration:

```python
# Deepgram voices
tts=deepgram.TTS(voice="aura-asteria-en")  # Female
tts=deepgram.TTS(voice="aura-orion-en")    # Male

# Or use ElevenLabs for more natural voices
from livekit.plugins import elevenlabs
tts=elevenlabs.TTS(voice_id="your-voice-id")
```

### Modify Agent Behavior

Edit the `instructions` in `AxlesAssistant.__init__()` to change how the agent behaves.

### Add More Tools

Add new `@function_tool()` methods to `AxlesAssistant` class for additional capabilities.

## Architecture

```
Phone Call → LiveKit SIP → Agent Room → AxlesAssistant
                                              ↓
                                         xAI (Grok)
                                              ↓
                                    Supabase (Inventory/Leads)
```

## Troubleshooting

**Agent doesn't answer**
- Check that dispatch rule is created
- Verify LIVEKIT_* credentials are correct
- Check agent logs for errors

**Can't hear agent**
- Verify DEEPGRAM_API_KEY is set
- Check TTS configuration

**Inventory search not working**
- Verify SUPABASE_* credentials
- Check that listings table has data with status='active'

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
