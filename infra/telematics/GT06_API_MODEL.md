# GT06-first device and API model

Status: this documents the first physical-device integration target. The local
Traccar/Loadgistic path already passes a synthetic GT06 round trip; no physical
WhatsGPS model has been identified or certified, and no hosted listener is
deployed.

## Boundary: tracker protocol is not the application API

The tracker sends GT06 binary frames over a device-facing TCP connection to
Traccar. The tracker does not call a Loadgistic REST endpoint. Traccar owns
packet framing, checksum validation, login/heartbeat replies, reconnects and
protocol decoding. Loadgistic receives only the decoded, allowlisted position
fields through its server-to-server bridge. This avoids writing a second GT06
decoder and keeps model-specific packet differences behind Traccar.

GT06 is the first physical protocol to qualify because the owner's test device
is reported to use it. This is an implementation priority, not a claim that
every WhatsGPS or other white-label tracker uses the same GT06 variant. The
manufacturer name, exact model and firmware remain separate facts. “4G” names
the mobile network connection and does not identify the packet protocol.

## Tracker to Traccar

- Protocol listener: GT06 TCP port `5023` inside the gateway. The local Docker
  mapping is `127.0.0.1:15023`; it is intentionally unreachable from a cellular
  tracker. A physical test needs an isolated, public staging address and an
  owner-reviewed firewall rule before the device is pointed at it.
- Enrollment: Traccar must already contain the exact device identifier. Unknown
  device auto-registration stays disabled. A matching identifier or IMEI is
  not proof of ownership or sender authenticity.
- Initial physical scope: accepted login, heartbeat/status, location and alarm
  traffic. Preserve packet-derived event time separately from server receive
  time. Invalid, stale, duplicate, unregistered and out-of-order data must not
  become a current truck location.
- Raw packets and exact coordinates stay private. Do not enable packet dumps,
  coordinate-bearing logs, or public device identifiers for diagnosis.
- Do not send a real-device command during initial protocol qualification.
  GT06 command frames and acknowledgements vary among device models/firmware.
  Physical command capabilities remain empty until the exact model profile has
  manufacturer documentation and bench evidence. Synthetic commands are not
  hardware evidence.

## Traccar to Loadgistic bridge API

The existing internal endpoint is `POST /api/telematics/gateway`. It is a
private service contract, not a public customer or third-party API. The bridge
signs the exact request body with HMAC-SHA256 and sends these headers:

```text
x-telematics-gateway: <configured gateway UUID>
x-telematics-issued-at: <ISO timestamp>
x-telematics-nonce: <fresh UUID per request>
x-telematics-signature: <HMAC-SHA256 signature>
```

The signature binds the method, route, gateway, timestamp, nonce and SHA-256
body digest. The server checks the configured gateway, signature, timestamp
window and nonce before processing. The body is size-limited; protocol IDs and
device ownership must match the exact provisioned gateway binding.

For GT06, the bridge sends the following normalized event after Traccar has
decoded a valid position. Values are illustrative synthetic data:

```json
{
  "action": "POSITION",
  "positions": [
    {
      "eventKey": "position:12345",
      "gatewayDeviceId": 17,
      "protocol": "gt06",
  "protocolDeviceId": "990000000000004",
      "observedAt": "2026-10-21T15:04:05.000Z",
      "receivedAt": "2026-10-21T15:04:06.000Z",
      "valid": true,
      "latitude": 9.031,
      "longitude": 38.748,
      "speedKph": 24.08,
      "course": 92,
      "attributes": {
        "ignition": true,
        "battery": 84,
        "alarm": "overspeed"
      }
    }
  ]
}
```

Contract rules:

- `eventKey` is stable for a Traccar position so retries are idempotent.
- `gatewayDeviceId` is the numeric Traccar record; `protocolDeviceId` is the
  exact provisioned tracker identity. Both must agree with the app's device
  binding; neither value independently grants access.
- `observedAt` comes from the tracker fix; `receivedAt` comes from Traccar.
- `speedKph` is normalized by the bridge from Traccar's decoded speed unit.
- Only valid coordinates, bounded time/speed/course values, and the explicit
  ignition, battery, power and alarm allowlist cross the bridge. Raw packet,
  IMEI, arbitrary attributes and command-result positions are rejected or
  omitted.
- Batch size is at most 50 positions. The app persists telemetry privately;
  its selected-source, ownership, freshness and public-location obfuscation
  rules still determine which location can be displayed.

The endpoint also has internal `CLAIM_COMMANDS`, `RESULT` and `PRUNE` actions.
They remain authenticated service operations. A command HTTP response means
only `DISPATCHED`, not that a tracker executed it. A result is accepted only
when it is correlated with the exact command and device. Never turn a command
acknowledgement into a fresh position.

There is no explicit API version field today. This is a private bridge contract
deployed in lockstep with its gateway/application code, not a stable partner API.
Before onboarding third-party gateway implementations, add explicit contract
versioning and compatibility tests instead of treating this internal shape as a
public integration promise.

## First real-device qualification

Before claiming the WhatsGPS unit works, use an isolated staging gateway and
verify, in order:

1. Confirm the exact model and firmware from its label or device settings; use
   only that model's configuration instructions. Do not guess an SMS command.
2. Confirm the tracker connects to the staging GT06 listener and the exact
   provisioned identifier is accepted while an unknown identifier is refused.
3. Confirm login/heartbeat replies, at least one position, correct timestamp,
   coordinate and speed, and one available status/alarm field against the
   installed device and known location.
4. Confirm duplicate/replayed and stale positions do not change the current
   truck marker; disconnect and reconnect without losing the device binding.
5. Confirm the selected GPS source shows the expected marker and source icon,
   while public maps still show only the permitted obscured location.
6. Leave command capabilities disabled. Qualify commands later against the
   exact model/firmware and safe bench setup before exposing any control.

Synthetic GT06 round trips qualify the gateway and bridge code only. They do
not satisfy physical-device qualification or authorize hosted deployment.

## References

- [Traccar protocol identification and GT06 port/preamble](https://www.traccar.org/identify-protocol/)
- [Traccar supported protocol documentation](https://www.traccar.org/protocols/)
- [Concox GT06 communication protocol document hosted by Traccar](https://www.traccar.org/protocol/5023-gt06/GT06_GPS_Tracker_Communication_Protocol_v1.8.1.pdf)
- [Pinned Traccar 6.16.0 GT06 decoder](https://github.com/traccar/traccar/blob/v6.16.0/src/main/java/org/traccar/protocol/Gt06ProtocolDecoder.java)
