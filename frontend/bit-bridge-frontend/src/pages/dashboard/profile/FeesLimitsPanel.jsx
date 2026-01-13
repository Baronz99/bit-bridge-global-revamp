// src/pages/dashboard/profile/FeesLimitsPanel.jsx

import { useEffect, useState } from 'react'
import client from '../../../api/client'
import { nairaFormat } from '../../../utils/nairaFormat'

const Section = ({ title, subtitle, children }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 md:p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-white font-semibold">{title}</div>
        {subtitle ? <div className="text-xs text-slate-300/70 mt-1">{subtitle}</div> : null}
      </div>
    </div>
    <div className="mt-4">{children}</div>
  </div>
)

const Row = ({ label, value, note }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-white/10 last:border-b-0">
    <div className="text-sm text-slate-200">{label}</div>
    <div className="text-right">
      <div className="text-sm font-semibold text-white">{value}</div>
      {note ? <div className="text-[11px] text-slate-300/60 mt-0.5">{note}</div> : null}
    </div>
  </div>
)

const FeesLimitsPanel = () => {
  const lastUpdatedLabel = 'v2' // match your PDF naming (BitBridge_Pricing_v2)
  const [fees, setFees] = useState(null)

  useEffect(() => {
    let mounted = true
    client
      .get('/fees')
      .then((res) => {
        if (!mounted) return
        setFees(res?.data?.data || null)
      })
      .catch(() => {
        if (!mounted) return
        setFees(null)
      })
    return () => {
      mounted = false
    }
  }, [])

  const cardFees = fees?.cards || {}
  const spendFees = cardFees?.spend_fees || null
  const transferFees = Array.isArray(fees?.transfers?.anchor_fee_tiers)
    ? fees.transfers.anchor_fee_tiers
    : []
  const stampDuty = fees?.transfers?.stamp_duty_ngn

  const renderTransferLabel = (tier, idx) => {
    if (tier.max_amount === null) return 'NGN 50,000+'
    if (idx === 0) return 'NGN 0 - 1,999'
    if (tier.max_amount === 9999) return 'NGN 2,000 - 9,999'
    return 'NGN 10,000 - 49,999'
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <div className="text-white text-lg font-semibold">Fees & Limits</div>
            <div className="text-xs text-slate-300/70 mt-1">
              Clear pricing for transfers, cards, bills, and community tools. (Last updated: {lastUpdatedLabel})
            </div>
          </div>

          <div className="text-xs text-slate-300/70">
            Tip: Fees may vary by provider network or product updates.
          </div>
        </div>
      </div>

      <Section title="Naira Transfers" subtitle="Local bank transfers (NGN)">
        {transferFees.length > 0 ? (
          transferFees.map((tier, idx) => {
            const note =
              stampDuty && tier.max_amount && tier.max_amount >= 10_000
                ? `Includes NGN ${Number(stampDuty).toFixed(0)} stamp duty`
                : null
            return (
              <Row
                key={renderTransferLabel(tier, idx)}
                label={renderTransferLabel(tier, idx)}
                value={nairaFormat(tier.fee, 'ngn')}
                note={note}
              />
            )
          })
        ) : (
          <Row label="Transfer fees" value="Not available" />
        )}
        <div className="mt-3 text-[11px] text-slate-300/70">
          Stamp duty applies to transfers NGN 10,000+ and is included in the amounts above.
        </div>
      </Section>

      <Section title="Virtual Card Fees" subtitle="Card creation, maintenance, and wallet actions (USD)">
        <Row
          label="Card creation"
          value={
            cardFees.creation_fee_usd !== undefined
              ? `USD ${Number(cardFees.creation_fee_usd).toFixed(2)}`
              : 'Not available'
          }
        />
        <Row
          label="Monthly maintenance"
          value={
            cardFees.monthly_maintenance_fee_usd !== undefined
              ? `USD ${Number(cardFees.monthly_maintenance_fee_usd).toFixed(2)}`
              : 'Not available'
          }
        />
        <Row
          label="Card funding fee"
          value={
            cardFees.funding_fee_bps !== undefined
              ? `${cardFees.funding_fee_bps} bps (cap USD ${Number(
                  cardFees.funding_fee_cap_usd || 0
                ).toFixed(2)})`
              : 'Not available'
          }
        />
        <Row
          label="Card withdrawal fee"
          value={
            cardFees.withdrawal_fee_bps !== undefined
              ? `${cardFees.withdrawal_fee_bps} bps (cap USD ${Number(
                  cardFees.withdrawal_fee_cap_usd || 0
                ).toFixed(2)})`
              : 'Not available'
          }
        />
      </Section>

      <Section title="Virtual Card Limits" subtitle="Daily limits (USD)">
        <Row label="Daily funding limit" value="$2,500" />
        <Row label="Daily spend limit" value="$2,500" />
        <Row label="Daily withdrawal limit" value="$200" />
      </Section>

      <Section title="Card Transaction Fees" subtitle="Charges on card usage">
        <Row
          label="Provider fee (USD)"
          value={
            spendFees
              ? `${Number(spendFees.provider_fee_percent_usd * 100).toFixed(1)}% (cap USD ${Number(
                  spendFees.provider_fee_cap_usd
                ).toFixed(2)})`
              : 'Not available'
          }
        />
        <Row
          label="Provider fee (non-USD)"
          value={
            spendFees
              ? `${Number(spendFees.provider_fee_percent_non_usd * 100).toFixed(1)}%`
              : 'Not available'
          }
        />
        <Row
          label="BitBridge fee (USD)"
          value={
            spendFees
              ? `${Number(spendFees.bitbridge_fee_percent_usd * 100).toFixed(1)}% (cap USD ${Number(
                  spendFees.bitbridge_fee_cap_usd
                ).toFixed(2)})`
              : 'Not available'
          }
        />
        <Row
          label="FX markup (non-USD)"
          value={
            spendFees
              ? `${Number(spendFees.bitbridge_fx_markup_percent * 100).toFixed(1)}%`
              : 'Not available'
          }
        />
      </Section>

      <Section title="Bills & Utilities" subtitle="Airtime, data, TV & electricity">
        <Row label="Airtime, Data, TV & Electricity" value="FREE" />
      </Section>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 md:p-5">
        <div className="text-xs text-slate-300/70">
          <div className="text-white font-semibold mb-1">Notes</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>Fees and limits can change as providers or regulations change.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default FeesLimitsPanel
