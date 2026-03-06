# Apple Container Networking Setup

Apple Container may need manual host networking setup before NanoClaw containers can reach external APIs.

## Quick Setup

```bash
# Enable IP forwarding
sudo sysctl -w net.inet.ip.forwarding=1

# Enable NAT for the default vmnet range
echo "nat on en0 from 192.168.64.0/24 to any -> (en0)" | sudo pfctl -ef -
```

Replace `en0` with your active interface:

```bash
route get 8.8.8.8 | grep interface
```

## Verification

```bash
# Confirm forwarding
sysctl net.inet.ip.forwarding

# Test outbound HTTPS from the container
container run --rm --entrypoint curl nanoclaw-agent:latest \
  -sS --connect-timeout 5 -o /dev/null -w "%{http_code}" \
  https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models
```

An auth error such as `401` or `403` is fine here. It proves outbound networking works.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| connection timeout | forwarding or NAT missing | re-run the setup commands |
| DNS lookup failure | bridge/NAT setup incomplete | verify `bridge100` and pf rules |
| host reachable but internet not reachable | NAT on wrong interface | replace `en0` with the active interface |

## Notes

- These settings can reset after reboot.
- NanoClaw’s Qwen harness only needs normal outbound HTTPS access.
- This doc is about container networking only; provider auth is still configured through `.env`.
