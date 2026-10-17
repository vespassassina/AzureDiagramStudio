import type { StarterKey } from '../contracts.ts'
import webApiSource from '../../../examples/azure-web-app.json?raw'
import eventSource from '../../../examples/event-driven.json?raw'
import fabricSource from '../../../examples/fabric-onelake.json?raw'
import enterpriseSource from '../../../examples/enterprise-integration.json?raw'
import aksSource from '../../../examples/aks-baseline.json?raw'
import containerAppsSource from '../../../examples/container-apps-microservices.json?raw'
import queueWorkerSource from '../../../examples/web-queue-worker.json?raw'
import hubSpokeSource from '../../../examples/hub-spoke-network.json?raw'
import stampsSource from '../../../examples/saas-deployment-stamps.json?raw'
import claimCheckSource from '../../../examples/file-claim-check.json?raw'
import warehouseSource from '../../../examples/azure-data-warehouse.json?raw'

export type StarterChoice = { key: StarterKey; label: string; source: string; sourceCue: 'Synthetic example' | 'Learn adaptation'; reference?: string }
export const starterCatalog: readonly StarterChoice[] = [
  { key: 'web-api', label: 'Web/API', source: webApiSource, sourceCue: 'Synthetic example' },
  { key: 'event-driven', label: 'Event-driven', source: eventSource, sourceCue: 'Synthetic example' },
  { key: 'fabric', label: 'Fabric', source: fabricSource, sourceCue: 'Synthetic example' },
  { key: 'enterprise', label: 'Enterprise', source: enterpriseSource, sourceCue: 'Synthetic example' },
  { key: 'aks-baseline', label: 'AKS Baseline', source: aksSource, sourceCue: 'Learn adaptation', reference: 'https://learn.microsoft.com/en-us/azure/architecture/reference-architectures/containers/aks/baseline-aks' },
  { key: 'container-apps-microservices', label: 'Container Apps Microservices', source: containerAppsSource, sourceCue: 'Learn adaptation', reference: 'https://learn.microsoft.com/en-us/azure/architecture/example-scenario/serverless/microservices-with-container-apps' },
  { key: 'web-queue-worker', label: 'Web Queue Worker', source: queueWorkerSource, sourceCue: 'Learn adaptation', reference: 'https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/web-queue-worker' },
  { key: 'hub-spoke-network', label: 'Hub-Spoke Network', source: hubSpokeSource, sourceCue: 'Learn adaptation', reference: 'https://learn.microsoft.com/en-us/azure/architecture/networking/architecture/hub-spoke' },
  { key: 'saas-deployment-stamps', label: 'SaaS Deployment Stamps', source: stampsSource, sourceCue: 'Learn adaptation', reference: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/deployment-stamp' },
  { key: 'file-claim-check', label: 'File Processing With Claim Check', source: claimCheckSource, sourceCue: 'Learn adaptation', reference: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/claim-check' },
  { key: 'azure-data-warehouse', label: 'Azure Data Warehouse', source: warehouseSource, sourceCue: 'Learn adaptation', reference: 'https://learn.microsoft.com/en-us/azure/architecture/example-scenario/data/data-warehouse' },
]