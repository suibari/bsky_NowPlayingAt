// One-time OAuth client signing key generator (confidential client).
//
// Generates an ES256 (P-256) key pair for `private_key_jwt` client
// authentication and prints:
//   - PRIVATE JWK  -> store as the `OAUTH_PRIVATE_KEY_JWK` secret (DO NOT commit)
//   - PUBLIC  JWK  -> paste into static/client-metadata.json `jwks.keys`
//
// Usage:  node scripts/gen-oauth-key.mjs
import { JoseKey } from '@atproto/jwk-jose';

// Stable, unique key id so the public jwks entry and the private secret match.
const kid = `nowplayingat-${Date.now()}`;

const key = await JoseKey.generate(['ES256'], kid);

const privateJwk = key.privateJwk;
const publicJwk = key.publicJwk;

if (!privateJwk || !publicJwk) {
  console.error('Failed to derive JWKs from generated key');
  process.exit(1);
}

console.log('=== kid ===');
console.log(kid);
console.log();
console.log('=== PRIVATE JWK (secret OAUTH_PRIVATE_KEY_JWK — DO NOT commit) ===');
console.log(JSON.stringify(privateJwk));
console.log();
console.log('=== PUBLIC JWK (paste into static/client-metadata.json jwks.keys) ===');
console.log(JSON.stringify(publicJwk, null, 2));
