# Vendor Badge Notices

DGM080 vendor-only registry, researched 2026-10-09.

**Classification: 17 original named integration badges; 0 official logos.**
Every catalog subtitle is `Named integration badge`. The identical neutral
connector panel and ordinary monospace letters are original diagram artwork,
not copies, tracings, recolorings, corporate logotypes, certification badges,
or official architecture icons. Letters are compact diagram identifiers, not
new corporate marks. All badges use neutral gray, not vendor brand palettes.
Kubernetes and PostgreSQL are project identities, not companies.

No affiliation, sponsorship, or endorsement by any named organization is implied.
Names identify entities that a diagram author chooses to describe. A diagram
does not establish a tested integration, compatibility, partnership, or license.
These badges never replace Azure Diagram Studio or Visual Studio product branding.

SVG artwork is generated offline from the fixed identity definitions by
`app/scripts/generate-vendor.mjs`. Exact UTF-8 SHA-256 hashes and local source
paths are recorded in `app/src/vendor-icons/catalog.generated.json`. The compact
`assets.generated.json` registry contains embedded SVG data URLs. No vendor
websites, fonts, logo CDNs, or other resources are requested at runtime.

## Required Identities and Rights Research

The URLs in catalog provenance are identity/rights references, **not sources of
copied artwork and not redistribution licenses**. No corporate logo permission
was obtained or inferred. Research retrieval outcomes are recorded honestly:

| Key | Identity / attribution | Sources and disposition |
| --- | --- | --- |
| `vendor-oracle` | Oracle Corporation | [Trademark guidelines](https://www.oracle.com/legal/trademarks.html) and [logo guidelines](https://www.oracle.com/legal/logos/) retrieved. Logo/O Tag use requires written authorization; no authorization held. Use original badge, not red Oracle logotype. |
| `vendor-sap` | SAP SE or an SAP affiliate company | [Trademark page](https://www.sap.com/about/legal/trademark.html) retrieved; lists trademark guidelines and attribution. No general logo redistribution grant established. Use original badge, not SAP's corporate shape. |
| `vendor-ibm` | International Business Machines Corporation | [Copyright/trademark guidelines](https://www.ibm.com/legal/copytrade) retrieved (redirects to `/legal/copyright-trademark`). IBM limits logos to express written permission/license and describes fair use as text-only. Plain company identification, not the eight-bar logo or a new IBM corporate mark. |
| `vendor-aws` | Amazon.com, Inc. or its affiliates | [AWS trademark guidelines](https://aws.amazon.com/trademark-guidelines/) retrieved. Logo licenses are conditional and generally not transferable/sublicensable; fair-use references are plain text. Use original badge, not the smile or Powered by AWS logo. Official cloud architecture asset availability is not treated as an AWS corporate-logo redistribution grant. |
| `vendor-gcp` | Google LLC | [Brand Resource Center guidance](https://about.google/brand-resource-center/guidance/) retrieved. Informational plain-text references are distinguished from product icon/partnership permissions; no imitation or implied endorsement. Use original badge, not the multicolor cloud or Google logotype. |
| `vendor-hp` | HP Inc.; HP name belongs to its respective trademark owner | [HP identity](https://www.hp.com/). Attempts to retrieve `https://www.hp.com/us-en/hp-information/legal.html` and `https://www.hp.com/us-en/hp-information/legal/terms-of-use.html` returned HTTP 404. Logo permission remains unverified; original badge only. HP is not Hewlett Packard Enterprise. |
| `vendor-hpe` | Hewlett Packard Enterprise and its respective trademark owners | [HPE trademark reference](https://www.hpe.com/us/en/about/legal/trademarks.html). Fetch returned an unrelated DoubleClick tracker redirect rather than readable terms; it was not followed. Logo permission remains unverified; original badge only, not HPE's green rectangle. HPE is not HP Inc. |

Oracle, Java, MySQL, and NetSuite are registered trademarks of Oracle and/or its
affiliates. SAP and other SAP product/service names are trademarks or registered
trademarks of SAP SE or an SAP affiliate company in Germany and other countries.
IBM is a trademark of International Business Machines Corporation, registered in
many jurisdictions worldwide. Amazon Web Services and AWS are trademarks of
Amazon.com, Inc. or its affiliates. Google and Google Cloud are trademarks of
Google LLC. HP and HPE names are trademarks of their respective owners; they are
separate identities. This registry uses company/project labels, not product branding.

## Additional Named Identities

These are original badges as well. The following official identity/legal
references are supplied for further review, not represented as fetched logo
licenses or established redistribution permissions.

| Key | Label | Official reference |
| --- | --- | --- |
| `vendor-red-hat` | Red Hat | https://www.redhat.com/en/about/trademark-guidelines-and-policies |
| `vendor-salesforce` | Salesforce | https://www.salesforce.com/company/legal/ |
| `vendor-servicenow` | ServiceNow | https://www.servicenow.com/company/legal.html |
| `vendor-snowflake` | Snowflake | https://www.snowflake.com/en/legal/ |
| `vendor-docker` | Docker | https://www.docker.com/legal/ |
| `vendor-kubernetes` | Kubernetes (CNCF project) | https://www.cncf.io/brand-guidelines/ |
| `vendor-postgresql` | PostgreSQL (open source project) | https://www.postgresql.org/about/policies/trademarks/ |
| `vendor-vmware` | VMware | https://www.broadcom.com/company/legal/trademarks |
| `vendor-broadcom` | Broadcom | https://www.broadcom.com/company/legal/trademarks |
| `vendor-databricks` | Databricks | https://www.databricks.com/legal |

All names and trademarks remain the property of their respective owners.
VMware and Broadcom are separate selectable identities despite their business
relationship. Red Hat and IBM are likewise separate identities. No third-party
artwork or Simple Icons artwork was copied; no Simple Icons dependency was added.

## Publication Caveat

Badge fallback avoids redistributing restricted corporate artwork; it is not a
legal opinion or a blanket trademark clearance for every jurisdiction or use.
Logo replacement requires a separately documented applicable permission/license.
Do not describe these badges as official vendor icons. External publication and
distribution review remains with the PO; HP/HPE source gaps remain explicit.
This vendor-only evidence does not certify desktop packaging, full editor
integration, third-party logo licenses, or public release readiness.