---
_provenance:
  writtenBy: stardust:replica
  mode: bounded-single
  synthesizedFrom:
    - stardust/current/pages/index.json
    - stardust/current/pages/collections-all.json
    - stardust/current/pages/products-road-bike-helmet.json
    - stardust/current/lifts/index-1440.json
    - stardust/current/lifts/index-360.json
---

# Mein Shop storefront replica

Source: https://t8bnc1-5b.myshopify.com/.

Recreate the existing sports-product storefront on AEM Edge Delivery Services,
with Shopify remaining the catalog, inventory, cart and hosted-checkout backend.
Preserve source copy, routes, images and responsive composition. No redesign
or fabricated inventory is approved.

The bounded capture contains the homepage, catalog, four product pages, contact,
empty cart and privacy policy. Inventory completeness is recorded separately in
`stardust/state.json`; this document does not assert full-site capture.

The source combines German navigation and commerce controls with English hero,
newsletter and product descriptions. Currency is EUR; the initial market is
Germany. All four captured products are sold out.

Completion requires measured archetype fidelity, observed interaction parity,
authorable AEM content, live Shopify API integration and a published-origin
delivery check. Local prototypes alone do not constitute a completed migration.
