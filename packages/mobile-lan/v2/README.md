# Mobile LAN v2

Frozen consumer copies of the independent mobile application's `src/core/lan-wire.ts` and `lan-client.ts`.
The desktop does not import the mobile checkout or its dependencies. When changing the wire protocol,
copy both files from the mobile source and update both adapters and the receiver integration test.

QR offers retain the original pinned HTTPS endpoint for installed native clients. The additional LAN
endpoint is ciphertext-only HTTP for Expo Go: AES-256-GCM, HKDF-SHA-256 direction keys, authenticated
pairing/request IDs, unique request IDs, desktop confirmation, expiring sessions and bounded chunks.
