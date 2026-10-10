# Dynamic features: Mein Shop

Evidence: `current/_dynamics.json` and `current/dynamic-features.generated.md`.
The following rows merge repeated detections while retaining all dispositions.

## Listings contract

Catalog/product text is authored into the page. Shopify Storefront API supplies
current price, availability and variants. Product links identify Shopify handles.
Search must include a local results route; a search modal without it is incomplete.

## Features

| id | feature | class | reach | disposition | reproducibility | status | decision / evidence |
|---|---|---|---|---|---|---|---|
| catalog | Shopify API and product data | A X | storefront | data-fed | self | in-progress | Verified public Storefront token; replace source-relative GraphQL with explicit Shopify origin. |
| cart | Cart add/update/remove and checkout | F X | products/cart | data-fed | self | in-progress | Storefront Cart API; serialized writes; hosted checkout. Live inventory is sold out. |
| recommendations | Related product band | CR R | products | data-fed | self | interim | Captured cards exist; currently static membership. Query productRecommendations before claiming dynamic parity. |
| filters | Desktop and mobile collection facets | F L | catalog | client-only | self | in-progress | Filter current API catalog; complete sort/layout and URL-state parity remain pending. |
| search | Search/predictive results and /search | S | chrome | data-fed | self | interim | Title-only local matching is not source-equivalent; full results route and backend search pending. |
| dialogs | Menu/search/cart/image/policies | M | storefront | rebuild-native | self | in-progress | Clean dialog implementations exist; runtime appearance/motion parity pending. |
| region | Region/currency selector | A I18N | chrome | data-fed | self | interim | Current DE/EUR display only; source selector behavior must be observed and implemented. |
| account | Customer account | X | chrome | embed-passthrough | self | in-progress | Shopify-hosted customer authentication URL retained; no AEM-hosted account session invented. |
| contact | Contact form | F | contact | embed-passthrough | needs-backend | scaffolded-awaiting-owner | Authored native POST targets Shopify; off-origin password/captcha/submission success unverified. |
| newsletter | Newsletter subscription | F | footer | embed-passthrough | needs-backend | scaffolded-awaiting-owner | Same native Shopify handoff limitation; no successful subscription claimed. |
| privacy | Optional cookies and preferences | T | storefront | rebuild-native | needs-business-decision | interim | No optional tracking is loaded; source preference UI/consent synchronization not yet equivalent. |
| telemetry | /api/collect, Shopify telemetry/settings | A T | storefront | decided-out | needs-business-decision | decided-out | Do not copy Shopify Online Store analytics onto AEM without an explicit tracking decision. |
| shop-app | shop.app SDK/account enhancement | T X | chrome | decided-out | needs-business-decision | decided-out | Hosted account handoff remains; no third-party SDK port approved. |
| payments | PayPal SDK and hidden runtime iframe | T V X | product | decided-out | self | decided-out | Payments stay in Shopify-hosted checkout; no second payment integration on AEM. |
| external-locale | privacy.shopify.com/en link | I18N | legal | embed-passthrough | self | pending | External privacy link is not evidence of an English storefront tree; retain its original URL. |

## Decision batch

Before production delivery: configure the AEM authoring destination; establish
and verify a supported off-origin contact/newsletter flow; decide whether any
optional analytics/CMP integration is required. Until then, forms are an
unverified hosted handoff, not a completed backend integration.

## Register: decided-out

| feature | reason | production statement |
|---|---|---|
| Online Store telemetry | Origin-bound Shopify theme analytics | Not loaded on AEM; requires an explicit tracking integration decision. |
| Shop app SDK | Shopify-origin theme enhancement | Account remains hosted; SDK embedding is not claimed. |
| PayPal iframe/SDK | Payment belongs to hosted checkout | Payment takes place only in Shopify checkout. |
