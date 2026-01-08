// src/pages/dashboard/profile/FeesLimitsPanel.jsx

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
  // If later you want tier-based pricing, this can accept props (user, kyc_level, etc.)
  const lastUpdatedLabel = 'v2' // match your PDF naming (BitBridge_Pricing_v2)

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
        <Row label="₦0 – ₦1,999" value="₦55" />
        <Row label="₦2,000 – ₦9,999" value="₦76.80" />
        <Row label="₦10,000 – ₦49,999" value="₦126.80" note="Includes ₦50 stamp duty" />
        <Row label="₦50,000+" value="₦150" note="Includes ₦50 stamp duty" />
        <div className="mt-3 text-[11px] text-slate-300/70">
          Stamp duty applies to transfers ₦10,000+ and is included in the amounts above.
        </div>
      </Section>

      <Section title="Virtual Card Fees" subtitle="Card creation, maintenance, and wallet actions (USD)">
        <Row label="Card creation" value="$4" />
        <Row label="Monthly maintenance" value="$1" />
        <Row label="Card funding" value="$1" />
        <Row label="Card withdrawal" value="$1" />
      </Section>

      <Section title="Virtual Card Limits" subtitle="Daily limits (USD)">
        <Row label="Daily funding limit" value="$2,500" />
        <Row label="Daily spend limit" value="$2,500" />
        <Row label="Daily withdrawal limit" value="$200" />
      </Section>

      <Section title="Card Transaction Fees" subtitle="Charges on card usage">
        <Row label="Transaction fee" value="1%" note="Capped at $10" />
        <Row label="Foreign currency fee (non-USD)" value="1.5%" />
      </Section>

      <Section title="Bills & Utilities" subtitle="Airtime, data, TV & electricity">
        <Row label="Airtime, Data, TV & Electricity" value="FREE" />
      </Section>

      <Section title="Community & Business Tools" subtitle="Institutional and group services (NGN)">
        <Row label="Bulk transfers" value="₦50 per recipient" />
        <Row label="Salary disbursement" value="₦50 per recipient" />
        <Row label="Community wallet" value="₦1,000 / month" />
      </Section>

      <Section title="Government Tax" subtitle="Regulatory charges">
        <Row label="Stamp duty (₦10k+ transfers)" value="₦50" note="Already included above" />
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
