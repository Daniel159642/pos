# DoorDash Rx (Prescription) Deeplink format

This document describes the **deeplink format** for DoorDash prescription (Rx) flows. It is separate from the Retail Marketplace integration ([DOORDASH_RETAIL.md](./DOORDASH_RETAIL.md)) and Restaurant integration ([DOORDASH_SETUP.md](./DOORDASH_SETUP.md)).

---

## Anatomy of a deeplink

```
https://www.doordash.com/rx/{merchant_tag}?store_id=...&item=...&signature=...
```

**IMPORTANT:** Merchants must **not** provide DoorDash with any identifying patient data or Protected Health Information (PHI) related to the prescription order within the deeplink.

---

## Path parameters

| Parameter      | Type   | Required | Description                                      |
|----------------|--------|----------|--------------------------------------------------|
| merchant_tag   | string | Yes      | The unique pharmacy identifier for the merchant. |

---

## Query parameters

| Parameter  | Type   | Required | Repeatable | Description |
|------------|--------|----------|------------|-------------|
| store_id   | string | Yes      | No         | The unique identifier for the merchant's store. |
| item       | string | Yes      | Yes        | Encodes prescription details: `<prefix>:<copay>:<expiry>`. See [Item parameter format](#item-parameter-format). |
| signature  | string | No       | No         | Used to verify authenticity and integrity of the URL. **Must be the last parameter in the URL.** See [Signature details](#signature-details). |

---

## Item parameter format

```
<3-letter prefix>:<copay in cents>:<expiration in Unix time (seconds)>
```

| Component  | Description |
|------------|-------------|
| prefix     | The first 3 letters of the prescription name. |
| copay      | Cost in cents. Example: `500` = $5.00. |
| expiration | Unix timestamp for expiration (seconds). Example: `1749225600`. |

---

## Signature details

DoorDash verifies signed URLs using **RSA digital signatures** with **SHA-256**. Signatures must be generated with a standards-compliant RSA scheme: **PKCS#1 v1.5** (RFC 8017, Section 9.2), often named **SHA256withRSA** or **RSA-SHA256** in libraries.

### Steps to generate a valid signature

1. **Generate an RSA public/private key pair** (X.509/PKCS#8) and provide DoorDash with the **public key in PEM format**.
2. **Build the string to be signed:** Start from the **unsigned URL** (no `signature` parameter). Take the substring beginning with `<merchant_tag>` through the **last non-signature parameter**. Do **not** include scheme, host, or leading slash.
3. **Compute the SHA-256 digest** of that string exactly as it appears (exact characters, punctuation, and encoding).
4. **Sign with the private key** using **RSASSA-PKCS1-v1_5 with SHA-256**. The signing library wraps the hash in the ASN.1 DigestInfo structure and applies PKCS #1 v1.5 padding. Result is a **binary signature value**.
5. **Base64-encode** the binary signature.
6. **Append** the query parameter `signature=<base64_value>` to the end of the unsigned URL to produce the final signed URL.

DoorDash verifies using the public key you provided.

### Library references

- **Java:** `Signature.getInstance("SHA256withRSA")`
- **Python:** `private_key.sign(..., padding.PKCS1v15(), hashes.SHA256())`
- **Node.js:** `crypto.createSign('RSA-SHA256')`

---

## Example #1 – Single item with signature

**Deeplink (line breaks for readability only; in production use a single uninterrupted URL):**

```
https://www.doordash.com/rx/abc?store_id=123&item=PRO:500:1749225600
&signature=LxJ4yLpA0kRWDk6DASS9cg5C2yCezGmxROEsj+5IaaVO1qIb2HdEmcKTz
XbTgV3Pxp0N9MvmRBpS9Dx8wuFJVcGp9pQlUBfsFsyS8OtvqQQ1zGkGZiWipKSmAigsg
pLYJrn4Y4EzG18u/7ff1duEySdcJTB0QB6tHtipAe2HpUON5Xto8PnXtpBp+7BnsTpzq
k+c9vhnrt702QvlfEGCTbePmvOI5FD75jKvMK/SwhAdcwxnTkxuZku/2I9wQyWCC9mBe
EhZ90ugIy76bchO5VqLPR2oPugTQfJx0XWr0K6loVndu78DtA1DBXRfyGBaHde7udBDM
zV0G+uU7MFhEA==
```

| Parameter     | Value | Explanation |
|---------------|-------|-------------|
| merchant_tag  | abc   | — |
| store_id      | 123   | — |
| item          | PRO:500:1749225600 | Prescription starting with PRO, $5.00 copay, expires Unix 1749225600 (e.g. June 6, 2025, 12:00 PM ET). |
| signature     | (base64 string above) | See [How the signature was generated](#how-the-signature-was-generated-example-1). |

### How the signature was generated (Example 1)

- **String to be signed:** `abc?store_id=123&item=PRO:500:1749225600`
- **SHA-256 hash** of that string (for illustration only; do not manually hash—libraries handle it): `a9bcf63278a337644700c11a8262cb6238c9765af55044bb90a2affe0675cdf0`
- **Sign** with the private key using PKCS#1 v1.5 RSA-SHA256, then **Base64-encode** the binary signature to get the `signature` value.
- DoorDash verifies using the public key you provided.

**Example key pair (for this walkthrough only):**

**Public key (PEM):**

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiVkjeAuoqZTVcAl6lKWF
j912B+DeXneq6wCGnwl2PUBt9+tVE5vkOUIjolMe1ac2r+jSrh8p2YkcMgl5EyVP
kHxeiCWqVblm0dP0VKnw/T/IDWE7o4vhdCSaaWUmfng3ZDUyzt3kaC4lXBCYsy1i
MVD0AeAg52fEDZkI+7x5i2x7rs6XO6yGwzPlKBiMJ1l5os09gmLfIoLlGsUH0ZLK
iq1D2ieCVVd/qemQ+vUW78BVFo9dRif79LOTC3SZksTLnQ2MlUDXM1jQOcqngOhI
l76RkQn2xk6kSkODz0CEdzWCxOibxUTQPdoNqXAegOOA9FqoPEsNIRwBKYBqYnhn
CwIDAQAB
-----END PUBLIC KEY-----
```

**Private key (PEM):** Omitted here; use your own key pair and share only the public key with DoorDash.

---

## Example #2 – Multiple items

**Deeplink (no signature in this example):**

```
https://www.doordash.com/rx/abc?store_id=123&item=PRO:500:1749225600&item=MET:1295:1749398400
```

| Parameter     | Value | Explanation |
|---------------|-------|-------------|
| merchant_tag  | abc   | — |
| store_id      | 123   | — |
| item          | PRO:500:1749225600 | Prescription starting with PRO, $5.00 copay, expires 1749225600 (e.g. June 6, 2025, 12:00 PM ET). |
| item          | MET:1295:1749398400 | Prescription starting with MET, $12.95 copay, expires 1749398400 (e.g. June 8, 2025, 12:00 PM ET). |

If the URL is signed, the string to be signed includes all query parameters except `signature`, and `signature` must be the last parameter.
