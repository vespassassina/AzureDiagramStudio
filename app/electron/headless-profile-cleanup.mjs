import { rm } from 'node:fs/promises'
import path from 'node:path'

const [profile, parentProcessId, appData] = process.argv.slice(2)
const ownedProfile = typeof profile === 'string' &&
  typeof appData === 'string' &&
  path.dirname(profile) === appData &&
  /^AzureDiagramStudio-headless-\d+-[0-9a-f-]+$/i.test(path.basename(profile))
const parentId = Number(parentProcessId)

if (!ownedProfile || !Number.isSafeInteger(parentId) || parentId < 1) process.exit(2)

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const parentHasExited = () => {
  try { process.kill(parentId, 0); return false } catch (error) { return error?.code === 'ESRCH' }
}

// Pseudocode:
// 1. Wait only for the owning Electron process to exit.
// 2. Retry deletion of its exact validated disposable profile.
// 3. Leave any failed cleanup intact for observable diagnostics; never expand scope.
for (let attempt = 0; attempt < 100 && !parentHasExited(); attempt++) await delay(50)
if (!parentHasExited()) process.exit(3)

let failure
for (let attempt = 0; attempt < 50; attempt++) {
  try {
    await rm(profile, { recursive: true, force: true })
    process.exit(0)
  } catch (error) {
    failure = error
    await delay(100)
  }
}
process.stderr.write(`Headless disposable profile cleanup failed: ${failure?.message ?? 'unknown error'}\n`)
process.exit(4)
