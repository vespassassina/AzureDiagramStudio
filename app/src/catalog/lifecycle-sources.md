# DGM-060 Presentation and Lifecycle Sources

Checked: 2026-10-09. Policy snapshot, not a complete worldwide retirement audit.

## Boundary and Editorial Defaults

`presentation.ts` owns browsing and new-selection policy; the raw catalog still owns document validation and rendering. No assets, saved keys, JSON schema, source hashes, or provenance objects are changed. All 24 legacy Azure labels/subtitles/hashes remain unchanged. All 2,235 keys remain allowlisted: 639 Azure, 1,584 Fabric, 12 Software.

Seven Azure menus contain 10, 10, 8, 8, 8, 10, and 12 entries (66 total). The first four are editorial pins from the PO refinement; AI & Analytics pins Azure OpenAI, Azure Machine Learning, Azure AI Search, and Azure Databricks. Remaining menu entries are case-insensitively alphabetic. There is no measured global popularity ranking available, and none is claimed. Software has 12 separate entries.

Search/selection currently expose 665 entries: 607 Azure, 46 Fabric product/component/workload families, and 12 Software. Of the raw Azure entries, 32 are excluded by lifecycle/editorial/artwork rules. The 46 Fabric entries are derived from the checked-in official semantic mapping, not a claim that all 1,584 SVGs represent services. Seven permission/display synonyms are collapsed into their actual family; unrelated interface controls and every other size/theme variant remain raw-only. Datamart availability remains an explicit research gap below.

Canonical Fabric selection parses exact published family/size/style filenames, preferring 20-pixel item, then color, then filled, then regular. A deterministic published fallback is used only if those are absent. There are no substituted or recolored glyphs. Descriptions use workload/category names instead of size/theme clutter. The source object is the original raw provenance object. Folded search text is built once over the canonical library; menus, results and policy-owned aliases/keywords are frozen. Key lookup is constant-time; a one-query cache avoids repeated work without unbounded caching.

Primary collection/identity references fetched during this refinement:

- [Fabric official icon collection and usage terms](https://learn.microsoft.com/en-us/fabric/fundamentals/icons): product, experience, and item collection, with unchanged-glyph requirements.
- [Azure AI Search overview](https://learn.microsoft.com/en-us/azure/search/search-what-is-azure-search): current Search display name; raw Cognitive Search filename is retained as an alias/provenance.
- [Foundry Tools overview](https://learn.microsoft.com/en-us/azure/ai-services/what-are-ai-services): current service umbrella. Cognitive Services and Azure AI services remain search aliases, not evidence that all underlying services retired.
- [Azure architecture icon collection](https://learn.microsoft.com/en-us/azure/architecture/icons/): archive provenance; the exact Container Services (Deprecated) glyph is not offered for new selection. This is not a blanket container-service retirement rule.

## Effective Exclusions

Rules in `lifecycle.json` match explicit source basenames, not query substrings or broad label matching. Historical subresource associations are stated in each rule. These rules affect new palette/type choices only. `legacyItem` returns the original raw item for every existing key, including excluded and noncanonical entries.

| Family | Effective Retirement Date | Source and Qualification |
| --- | --- | --- |
| Azure Blockchain Service and its historical archive subresources | 2021-09-10 | [Azure-Samples migration guide](https://raw.githubusercontent.com/Azure-Samples/blockchain/master/abs/migration-guide.md) explicitly states retirement and names member/consortium resources. [Microsoft product-team reply reproduced on Q&A](https://learn.microsoft.com/en-us/answers/questions/556870/microsoft-blockchain-service-discontinued) corroborates it. Only six identified historical archive files are excluded; no rule against blockchain technology or Confidential Ledger. |
| Batch AI | Exact day unverified | [Archived overview](https://learn.microsoft.com/en-us/previous-versions/azure/batch-ai/overview-what-happened-batch-ai) explicitly says retired, but describes a grace period and a Government-cloud exception without an exact shutdown day. `verifiedRetiredAsOf: 2026-10-09` is the check date, not a fabricated retirement date. Azure Batch Accounts remain current. |
| Machine Learning Studio classic | 2024-08-31 | [Microsoft Lifecycle](https://learn.microsoft.com/en-us/lifecycle/products/machine-learning-studio-classic). Explicit Classic file and historical Studio workspace/web-service-plan files only; current Azure Machine Learning remains selectable. |
| Scheduler and job collections | 2022-02-15 | [Microsoft Lifecycle](https://learn.microsoft.com/en-us/lifecycle/products/azure-scheduler), final end date rather than the superseded 2019 announcement. |
| Time Series Insights and historical subresources | 2024-07-07 | [Archived overview](https://learn.microsoft.com/en-us/previous-versions/azure/time-series-insights/overview-what-is-tsi), explicit retirement banner. |
| Media Services | 2024-06-30 | [Retirement guide](https://learn.microsoft.com/en-us/previous-versions/azure/media-services/latest/azure-media-services-retirement). The source mentions a one-time short extension. Video Indexer is explicitly not retired. |
| Data Lake Analytics | 2024-02-29 | [Archived overview](https://learn.microsoft.com/en-us/previous-versions/azure/data-lake-analytics/data-lake-analytics-overview), explicit retired banner. |
| Data Lake Storage/Store Gen1 | 2024-02-29 | [Microsoft Lifecycle](https://learn.microsoft.com/en-us/lifecycle/products/azure-data-lake-storage-gen1) and [archived overview](https://learn.microsoft.com/en-us/previous-versions/azure/data-lake-store/data-lake-store-overview). Gen2 is not excluded. |
| Azure Database for MariaDB | 2025-09-19 | [Microsoft Lifecycle announcement](https://learn.microsoft.com/en-us/lifecycle/announcements/azure-products-retirement-september-2025) and [product record](https://learn.microsoft.com/en-us/lifecycle/products/azure-database-for-mariadb). Not a rule against MySQL or PostgreSQL. |
| Video Analyzer preview | 2022-11-30 | [Official Azure Updates RSS](https://www.microsoft.com/releasecommunications/api/v2/azure/rss/video-analyzer-retirement) gives November 30; [archived SDK notice](https://learn.microsoft.com/en-us/previous-versions/python/api/overview/azure/mgmt-videoanalyzer-readme?view=azure-python-archive-previous) says transition by December 1. Not Azure AI Video Indexer. |
| SQL Edge | 2025-09-30 | [Microsoft Lifecycle announcement](https://learn.microsoft.com/en-us/lifecycle/announcements/azure-products-retirement-september-2025). Not SQL Database or SQL Managed Instance. |
| Remote Rendering | 2025-09-30 | [Microsoft Lifecycle announcement](https://learn.microsoft.com/en-us/lifecycle/announcements/azure-products-retirement-september-2025). |
| HPC Cache | 2025-09-30 | [Archived overview](https://learn.microsoft.com/en-us/previous-versions/azure/hpc-cache/hpc-cache-overview) and the same Lifecycle announcement. Exact historical archive filename is misspelled `Azure-HCP-Cache`; no broad Cache match. HPC Workbenches, Connected Cache and Managed Redis remain selectable. |
| Anomaly Detector | 2026-10-01 | [Archived overview](https://learn.microsoft.com/en-us/previous-versions/azure/ai-services/anomaly-detector/overview). Not Fabric anomaly detection. |
| Metrics Advisor | 2026-05-18 | [Archived overview](https://learn.microsoft.com/en-us/previous-versions/azure/ai-services/metrics-advisor/overview), explicit retired-as-of banner. |
| Personalizer | 2026-08-25 | [Archived overview](https://learn.microsoft.com/en-us/previous-versions/azure/ai-services/personalizer/what-is-personalizer). |
| LUIS | 2026-03-31 | [Archived overview](https://learn.microsoft.com/en-us/previous-versions/azure/ai-services/luis/what-is-luis), final service end date rather than October 2025 portal closure. Not current conversational language understanding. |
| QnA Maker | 2025-10-31 | [Archived overview](https://learn.microsoft.com/en-us/previous-versions/azure/ai-services/qnamaker/overview/overview), explicitly extended from March 2025. Not current custom question answering. |

Lifecycle table extraction sometimes displays a UTC timestamp the following morning while stating dates are Pacific. The date-only policy uses the notice's named Pacific calendar date (for example March 1 06:59:59 UTC is February 29 Pacific). This snapshot is not an intra-day service-availability oracle.

## Still Available and Uncertainty

- [Azure Spring Apps](https://learn.microsoft.com/en-us/azure/spring-apps/basic-standard/retirement-announcement): service ends 2028-03-31. New-customer restrictions do not mean that existing deployments are retired now. Retained on 2026-10-09; tested immediately before and on the effective policy date.
- [IoT Central evolution](https://learn.microsoft.com/en-us/azure/iot-central/core/iot-central-evolution): September 23, 2026 notice states existing applications operate through 2029-09-20. Retained. Older rumored 2027 dates are not used.
- [Azure Cache for Redis FAQ](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/retirement-faq): Enterprise/Enterprise Flash ends 2027-03-31; Basic/Standard/Premium ends 2028-09-30. The generic Cache Redis file is associated with the latter. Managed Redis is not excluded, nor are generic Cache or Connected Cache.
- [Content Moderator](https://learn.microsoft.com/en-us/azure/ai-services/content-moderator/overview): deprecated in 2024, but service ends 2027-03-15. Retained because the service end is future; deprecation is not current retirement.
- [App Center notice](https://learn.microsoft.com/en-us/appcenter/retirement): most capabilities ended 2025-03-31, but the 2026-04-15 update extends Analytics & Diagnostics through March 2027. No dedicated App Center basename is present in this imported inventory, so no fabricated rule is added and no broad Visual Studio-family removal is made.
- Bonsai is excluded by the PO. [Fetched Q&A](https://learn.microsoft.com/en-us/answers/questions/1471326/given-that-azure-bonsai-is-retired-what-tool-platf) discusses alternatives but does not establish a precise retirement date. No date is assigned.
- Datamart/External datamart remain search-only pending primary-source verification. [Fetched Fabric community discussion](https://community.fabric.microsoft.com/t5/Data-Engineering/Datamarts-in-Fabric/m-p/4775804) quotes an October 1, 2025 removal notice, but this is a user post, not a surviving official retirement notice. The original Learn overview/administration/sharing pages now redirect to the Power BI landing page; attempted archive/migration URLs did not provide evidence. This is a known possible stale-family gap, not a claim of verified current availability or verified retirement.
- Microsoft Lifecycle's September 2025 announcement also covers Service Map, vFXT, Basic Load Balancer and Unmanaged Disks. No distinct corresponding basenames were identified in this inventory. Generic Load Balancer and Disks cannot safely be treated as those retired SKUs. No broad removals are made.
- Azure classic infrastructure and other service-specific/SKU/region retirements were not comprehensively audited. The published archive is not a universal current-service census. Do not make a 100%-complete retirement-cleanup claim.

## Retrieval and Verification

Actual targeted public retrieval used direct Learn notices, Lifecycle tables, archived Learn pages, official Azure Updates RSS, and the Azure-Samples retirement guide. Google returned a JavaScript challenge; DuckDuckGo HTML found working Lifecycle/archive/RSS URLs. Failed extraction, 404s and redirects to marketing/landing pages were not considered retirement proof. In particular the old Blockchain overview redirects to marketing, older Batch AI/Studio migration URLs failed, and Bonsai had no primary dated notice.

Initial TDD red: presentation/lifecycle modules missing, plus foundation `639 !== 24`; 7 foundation tests passed. Initial green: 20/20 focused tests. Adjacent red: 2 added tests failed (nested policy metadata immutability and exact HPC Cache exclusion), with previous 20 green. Adjacent green: 22/22 focused tests in 3 files. `npm run typecheck` passed with the concurrent UI consumer; no diagnostics in the five owned TypeScript files.

Full unit run on 2026-10-09: 4,879 passed, 4 failed, 4,883 total; 26/27 suites passed. The only failing file was `src/scene.glyph.test.ts`: three existing glyph-cache tests timed out at the original 5,000ms limit, then the safe-fallback spy expected one call but received 263. Catalog, assets, importer safety, presentation/lifecycle, foundation, and UI suites passed. Rendering/tests outside this task were not edited; neither timeout nor assertion was relaxed. The separate glyph rerun initially returned another agent's browser output and produced no isolated report, so it was not counted as evidence. Temporary Vitest JSON reports outside the repository were used to distinguish this agent's runs from concurrent terminal output.

Production browser and SVG/PNG gates remain with the separate verifier/UI owner. This catalog policy does not claim those gates are green or that the full unit run was green.