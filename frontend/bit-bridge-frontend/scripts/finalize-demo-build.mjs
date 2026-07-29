import { copyFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const distDemoDir = resolve(process.cwd(), 'dist-demo')
const demoEntry = resolve(distDemoDir, 'demo.html')
const indexEntry = resolve(distDemoDir, 'index.html')

await copyFile(demoEntry, indexEntry)
await rm(demoEntry)
