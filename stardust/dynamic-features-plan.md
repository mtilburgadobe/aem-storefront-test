# Dynamic implementation plan

1. Keep captured authored content usable before API hydration. Complete
   catalog, variant, cart and search data access through the public Storefront
   API. Cart writes must be serialized; API failures must remain visible.
2. Observe and reproduce source menu, filters, layout switches, account
   controls, search, cart drawer, image dialog, region selector and cookie
   preferences at 360px and 1440px. Do not infer motion from CSS alone.
3. Convert gated sections to authorable AEM blocks. Preserve the original
   authored semantic nodes; API hydration must not silently replace author
   text. Select the Shopify runtime using explicit page metadata, leaving
   existing Adobe Commerce boot behavior unchanged.
4. Establish the AEM content destination and verify forms, checkout/account
   handoffs and all dynamic checks on the published origin. Mock form-routing
   tests prove routing only, not that Shopify accepted the submission.

All rows have dispositions. This is a triage gate output, not a dynamic
parity approval. Outstanding owner decisions are batched in the inventory.
