import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..', '..')
const read = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8')

const activeFiles = [
  'pages/experience-center/Landing.jsx',
  'pages/experience-center/CircleIntro.jsx',
  'pages/experience-center/CircleOverview.jsx',
  'pages/experience-center/ChidiObligations.jsx',
  'pages/experience-center/ChidiPaymentReview.jsx',
  'pages/experience-center/AmakaCollections.jsx',
  'pages/experience-center/AmakaTreasury.jsx',
  'pages/experience-center/AmakaPayoutCreate.jsx',
  'pages/experience-center/TundeApproval.jsx',
  'pages/experience-center/AmakaCompletion.jsx',
  'pages/experience-center/CircleTimeline.jsx',
  'pages/experience-center/FreeExplore.jsx',
  'components/experience-center/ExperienceCenterShell.jsx',
  'components/experience-center/GuidedControls.jsx',
  'components/experience-center/StoryPanel.jsx',
  'utils/experienceCenterMemberPayment.js',
  'utils/experienceCenterDemoData.js',
  'utils/experienceCenterCircleDemo.js',
]

test('active handoff CTA copy matches the approved strings', () => {
  const paymentHelper = read('utils/experienceCenterMemberPayment.js')
  const payoutCreate = read('pages/experience-center/AmakaPayoutCreate.jsx')
  const tundeApproval = read('pages/experience-center/TundeApproval.jsx')

  assert.match(paymentHelper, /Pay ₦25,000/u)
  assert.match(paymentHelper, /See Amaka’s Updated Collections/u)
  assert.match(payoutCreate, /Continue to Tunde’s Review/u)
  assert.match(tundeApproval, /Return to Amaka’s Treasury Update/u)
})

test('active role labels match the approved investor-visible roles', () => {
  const demoData = read('utils/experienceCenterDemoData.js')
  const collections = read('pages/experience-center/AmakaCollections.jsx')
  const approval = read('pages/experience-center/TundeApproval.jsx')

  assert.match(demoData, /name:\s*'Emma Carter'/u)
  assert.match(demoData, /role:\s*'Resident'/u)
  assert.match(collections, /perspectiveName:\s*'Amaka'/u)
  assert.match(collections, /perspectiveRole:\s*'Treasurer'/u)
  assert.match(approval, /perspectiveName:\s*'Tunde'/u)
  assert.match(approval, /perspectiveRole:\s*'Admin'/u)
  assert.doesNotMatch(approval, /Approver/u)
})

test('active Experience Center files do not contain known visible corruption patterns', () => {
  const badSnippets = ['â€™', 'â€œ', 'â€', 'â‚¦', 'Â', '�', '?25', '?500', 'Amaka?', 'Tunde?']

  for (const relativePath of activeFiles) {
    const text = read(relativePath)
    for (const snippet of badSnippets) {
      assert.equal(text.includes(snippet), false, `${relativePath} should not contain ${snippet}`)
    }
  }
})
