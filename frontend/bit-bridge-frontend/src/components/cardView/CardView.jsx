import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import states from '../../data/states.json'
import { useDispatch, useSelector } from 'react-redux'
import { createCard, getUserCard, registerCardHolder } from '../../redux/actions/account'

export default function VirtualCardApplication() {
  const { user } = useSelector((state) => state.auth)
  const { card } = useSelector((state) => state.account)

  const [cardType, setCardType] = useState('virtual') // 'virtual' or 'physical'
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email_address: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    house_no: '',
    id_type: 'NIGERIAN_BVN_VERIFICATION',
    bvn: '',
    selfie_image: '',
    meta_data: {
      any_key: '',
    },
    email: '',
    limit: 5000,
    deliveryAddress: '',
    design: 'midnight',
    agreeTos: false,
    // card creation fields
    card_brand: 'Mastercard',
    card_currency: 'USD',
    card_type: 'Virtual',
    card_limit: 5000,
    amount: '',
    pin: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)
  const [successCreate, setSuccessCreate] = useState(null)

  const designs = [
    { id: 'midnight', label: 'Midnight' },
    { id: 'aurora', label: 'Aurora' },
    { id: 'graphite', label: 'Graphite' },
  ]

  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(getUserCard())
  }, [dispatch])

  // Prefill from logged-in user
  useEffect(() => {
    if (!user) return
    setFormData((prev) => ({
      ...prev,
      first_name: user.user_profile?.first_name || '',
      last_name: user.user_profile?.last_name || '',
      phone: user.user_profile?.phone_number || '',
      email_address: user.email || '',
      country: 'Nigeria',
    }))
  }, [user])

  // Prefill from existing card (if any)
  useEffect(() => {
    if (!card) return
    setFormData((prev) => ({
      ...prev,
      city: card?.city || '',
      state: card?.state || '',
      bvn: card?.bvn || '',
      address: card?.address || '',
      house_no: card?.house_no || '',
      postal_code: card?.postal_code || '',
      card_brand: 'Mastercard',
      card_currency: 'USD',
      card_type: 'Virtual',
      card_limit: 5000,
    }))
  }, [card])

  function handleChange(e) {
    const { name, value, type, checked } = e.target

    // handle nested meta_data.any_key
    if (name === 'meta_data.any_key') {
      setFormData((prev) => ({
        ...prev,
        meta_data: { ...prev.meta_data, any_key: value },
      }))
      return
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function validate() {
    if (!formData.agreeTos) return 'You must agree to the terms.'
    return null
  }

  // Register cardholder
  async function handleSubmitCardholder(e) {
    e.preventDefault()
    const err = validate()
    if (err) return setSuccess({ ok: false, message: err })

    setSubmitting(true)
    setSuccess(null)

    dispatch(
      registerCardHolder({
        card: formData,
      })
    )
      .unwrap()
      .then(() => {
        setSuccess({
          ok: true,
          message: `Application submitted for a ${cardType} card.`,
        })
      })
      .catch((err) => {
        console.log(err)
        setSuccess({
          ok: false,
          message: `Application failed for ${cardType} card. ${err.message}`,
        })
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  // Create / fund card
  async function handleSubmitCreateCard(e) {
    e.preventDefault()

    setSubmitting(true)
    setSuccessCreate(null)

    dispatch(
      createCard({
        card: formData,
      })
    )
      .unwrap()
      .then(() => {
        setSuccessCreate({
          ok: true,
          message: `Application submitted for a ${cardType} card.`,
        })
      })
      .catch((err) => {
        console.log(err)
        setSuccessCreate({
          ok: false,
          message: `Application failed for ${cardType} card. ${err.message}`,
        })
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Page header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Virtual Cards
            </h1>
            <p className="mt-1 text-sm text-slate-400 max-w-xl">
              Create a secure USD virtual card for online payments. Cardholder
              details are verified once, then you can create and fund cards as
              needed.
            </p>
          </div>

          <div className="flex gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 mt-1.5" />
            <span>
              Powered by BitBridge Global card partners. Your details are
              encrypted and securely processed.
            </span>
          </div>
        </header>

        {/* SECTION 1: Cardholder profile + live preview */}
        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-8">
          {/* Left - Cardholder form */}
          <div className="bg-slate-900 rounded-2xl p-6 md:p-7 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Cardholder Profile</h2>
                <p className="text-xs text-slate-400 mt-1">
                  We’ll use this information to verify and create your card.
                </p>
              </div>

              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    cardType === 'virtual'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                  onClick={() => setCardType('virtual')}
                  aria-pressed={cardType === 'virtual'}
                >
                  Virtual
                </button>
                <button
                  type="button"
                  disabled
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    cardType === 'physical'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Physical (coming soon)
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitCardholder} className="space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="First Name"
                  className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                  disabled={!!user?.user_profile}
                />
                <input
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Last Name"
                  className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                  disabled={!!user?.user_profile}
                />
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Phone"
                  className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                  disabled={!!user?.user_profile}
                />
                <input
                  name="email_address"
                  value={formData.email_address}
                  onChange={handleChange}
                  placeholder="Email Address"
                  className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                  disabled={!!user?.user_profile}
                />
              </div>

              {/* Address */}
              <div className="pt-2">
                <h3 className="text-sm font-semibold text-slate-200 mb-2">
                  Address
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Street Address"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                    required
                  />
                  <input
                    name="house_no"
                    value={formData.house_no}
                    onChange={handleChange}
                    placeholder="House No"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                    required
                  />
                  <input
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                    required
                  />
                  <select
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                    required
                  >
                    <option value="">Select State</option>
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  <input
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="Country"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                    disabled
                  />
                  <input
                    name="postal_code"
                    value={formData.postal_code}
                    onChange={handleChange}
                    placeholder="Postal Code"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                  />
                </div>
              </div>

              {/* Identity */}
              <div className="pt-2">
                <h3 className="text-sm font-semibold text-slate-200 mb-2">
                  Identity
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    name="id_type"
                    value={formData.id_type}
                    onChange={handleChange}
                    placeholder="ID Type"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                    disabled={!!user?.user_profile}
                  />
                  <input
                    name="bvn"
                    value={formData.bvn}
                    onChange={handleChange}
                    placeholder="BVN"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                  />
                </div>
              </div>

              {/* Meta & limit */}
              <div className="pt-2 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">
                    Meta data (optional)
                  </h3>
                  <input
                    name="meta_data.any_key"
                    value={formData.meta_data.any_key}
                    onChange={handleChange}
                    placeholder="Any extra reference"
                    className="p-2.5 rounded-md bg-slate-800 border border-slate-700 text-sm w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Daily spend limit (USD)
                  </label>
                  <input
                    name="limit"
                    value={formData.limit}
                    onChange={handleChange}
                    type="number"
                    min={1000}
                    disabled
                    className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {cardType === 'physical' && (
                <div className="pt-2">
                  <label className="block text-sm text-slate-300 mb-1">
                    Delivery address
                  </label>
                  <textarea
                    name="deliveryAddress"
                    value={formData.deliveryAddress}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-md p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                    placeholder="Street, City, State, Country"
                  />
                </div>
              )}

              {/* Design */}
              <div className="pt-2">
                <label className="block text-sm text-slate-300 mb-1">
                  Card design
                </label>
                <div className="flex flex-wrap gap-2">
                  {designs.map((d) => (
                    <label
                      key={d.id}
                      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer border text-xs ${
                        formData.design === d.id
                          ? 'border-indigo-500 bg-slate-800/80'
                          : 'border-slate-700 bg-slate-900'
                      }`}
                    >
                      <input
                        type="radio"
                        name="design"
                        value={d.id}
                        checked={formData.design === d.id}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      <div className="w-10 h-7 rounded-md flex items-center justify-center text-[10px] font-semibold bg-gradient-to-br from-slate-700 to-black">
                        {d.label}
                      </div>
                      <span className="text-slate-300">{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* TOS + buttons */}
              <div className="pt-1 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    id="tos"
                    name="agreeTos"
                    type="checkbox"
                    checked={formData.agreeTos}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-slate-700 text-indigo-500 bg-slate-900"
                  />
                  <label htmlFor="tos" className="text-xs text-slate-400">
                    I agree to the{' '}
                    <span className="text-indigo-400 underline">
                      terms and conditions
                    </span>
                    .
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-md font-semibold text-sm disabled:opacity-60"
                  >
                    {submitting
                      ? 'Submitting...'
                      : `Submit cardholder profile`}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        limit: 5000,
                        address: '',
                        house_no: '',
                        city: '',
                        state: '',
                        postal_code: '',
                        meta_data: { any_key: '' },
                        agreeTos: false,
                      }))
                      setSuccess(null)
                    }}
                    className="px-4 py-2.5 bg-slate-800 rounded-md text-xs"
                  >
                    Reset fields
                  </button>
                </div>

                {success && (
                  <div
                    className={`mt-2 p-3 rounded-md text-xs ${
                      success.ok
                        ? 'bg-emerald-900/40 border border-emerald-600'
                        : 'bg-red-900/40 border border-red-600'
                    }`}
                  >
                    <p>{success.message}</p>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Right - Live preview & summary */}
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl p-5 bg-gradient-to-br from-slate-900/60 to-black/60 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-medium">Card Preview</h3>
                <span className="text-[11px] text-slate-400">
                  {cardType === 'virtual' ? 'Virtual' : 'Physical'}
                </span>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md mx-auto"
              >
                <div
                  className={`relative rounded-xl p-6 min-h-[160px] ${
                    formData.design === 'midnight'
                      ? 'bg-gradient-to-br from-indigo-900 to-slate-900'
                      : formData.design === 'aurora'
                      ? 'bg-gradient-to-br from-emerald-700 to-indigo-900'
                      : 'bg-gradient-to-br from-slate-800 to-black'
                  } text-white`}
                >
                  <div className="flex justify-between items-start text-xs">
                    <div className="font-semibold opacity-90">
                      BitBridge Global
                    </div>
                    <div className="opacity-80">USD</div>
                  </div>

                  <div className="mt-6 text-2xl tracking-wide font-mono">
                    **** **** **** {String(formData.limit).slice(-4)}
                  </div>
                  <div className="mt-4 flex justify-between items-center text-xs">
                    <div>
                      <div className="text-slate-200/80">Cardholder</div>
                      <div className="font-medium text-sm">
                        {formData.first_name || formData.last_name
                          ? `${formData.first_name} ${formData.last_name}`
                          : 'Full Name'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-slate-200/80">Type</div>
                      <div className="font-medium text-sm">
                        {cardType === 'virtual' ? 'Virtual' : 'Physical'}
                      </div>
                    </div>
                  </div>

                  <div className="absolute right-4 bottom-4 text-[10px] opacity-80">
                    {formData.design.toUpperCase()}
                  </div>
                </div>
              </motion.div>

              <div className="mt-3 text-xs text-slate-400">
                Preview updates live as you fill your details.
              </div>
            </div>

            <div className="rounded-2xl p-4 bg-slate-900/60 border border-slate-800 text-xs">
              <h4 className="font-medium mb-2">Quick summary</h4>
              <ul className="space-y-1 text-slate-300">
                <li>
                  <strong>Type:</strong> {cardType === 'virtual' ? 'Virtual' : 'Physical'}
                </li>
                <li>
                  <strong>Holder:</strong>{' '}
                  {formData.first_name || formData.last_name
                    ? `${formData.first_name} ${formData.last_name}`
                    : '—'}
                </li>
                <li>
                  <strong>Email:</strong> {formData.email_address || '—'}
                </li>
                <li>
                  <strong>Limit:</strong> USD {formData.limit.toLocaleString()}
                </li>
              </ul>
            </div>

            <div className="rounded-2xl p-4 bg-slate-900/60 border border-slate-800 text-xs">
              <h4 className="font-medium mb-2">Notes</h4>
              <p className="text-slate-400">
                Virtual cards are instant and usable online. Physical cards (when
                enabled) may take 5–10 business days to deliver after KYC
                approval.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2: Create / fund card */}
        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-8">
          {/* Left: Create card form */}
          <div className="bg-slate-900 rounded-2xl p-6 md:p-7 border border-slate-800 shadow-lg">
            <h2 className="text-xl font-semibold mb-2">Create / Fund Card</h2>
            <p className="text-xs text-slate-400 mb-4">
              Once your cardholder profile is approved, you can create and fund a
              virtual card.
            </p>

            <form onSubmit={handleSubmitCreateCard} className="space-y-4">
              {/* Card type */}
              <div>
                <label className="block text-xs mb-1 text-slate-300">
                  Card Type
                </label>
                <select
                  disabled
                  name="card_type"
                  value={formData.card_type}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-sm"
                >
                  <option value="Virtual">Virtual</option>
                  <option value="Physical">Physical</option>
                </select>
              </div>

              {/* Brand + Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1 text-slate-300">
                    Brand
                  </label>
                  <input
                    disabled
                    type="text"
                    name="card_brand"
                    value={formData.card_brand}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 text-slate-300">
                    Currency
                  </label>
                  <input
                    disabled
                    type="text"
                    name="card_currency"
                    value={formData.card_currency}
                    onChange={handleChange}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-sm"
                  />
                </div>
              </div>

              {/* Limit & Funding */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1 text-slate-300">
                    Card Limit
                  </label>
                  <input
                    disabled
                    type="number"
                    name="card_limit"
                    value={formData.card_limit}
                    onChange={handleChange}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 text-slate-300">
                    Funding Amount
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-sm"
                  />
                </div>
              </div>

              {/* PIN */}
              <div>
                <label className="block text-xs mb-1 text-slate-300">
                  PIN (4 digits)
                </label>
                <input
                  type="password"
                  name="pin"
                  value={formData.pin}
                  maxLength={4}
                  onChange={handleChange}
                  placeholder="Enter PIN (encrypted in backend)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-sm"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-md font-semibold text-sm disabled:opacity-60"
                >
                  {submitting ? 'Creating...' : 'Create Card'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      amount: '',
                      pin: '',
                    }))
                  }
                  className="px-4 py-2.5 bg-slate-800 rounded-md text-xs"
                >
                  Reset
                </button>
              </div>

              {successCreate && (
                <div
                  className={`mt-3 p-3 rounded-md text-xs ${
                    successCreate.ok
                      ? 'bg-emerald-900/40 border border-emerald-600'
                      : 'bg-red-900/40 border border-red-600'
                  }`}
                >
                  <p>{successCreate.message}</p>
                </div>
              )}
            </form>
          </div>

          {/* Right: Create card preview */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-lg">
            <h3 className="text-base font-medium mb-3">Card Preview</h3>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 min-h-[160px]"
            >
              <div className="flex justify-between items-start text-xs">
                <div className="font-semibold opacity-90">BitBridge Global</div>
                <div className="opacity-80">{formData.card_currency}</div>
              </div>

              <div className="mt-6 text-2xl tracking-wide font-mono">
                **** **** **** 5000
              </div>
              <div className="mt-4 flex justify-between items-center text-xs">
                <div>
                  <div className="text-slate-200/80">Cardholder ID</div>
                  <div className="font-medium text-sm">
                    {card?.cardholder_id || '—'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-200/80">Type</div>
                  <div className="font-medium text-sm">
                    {formData.card_type}
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="mt-3 text-xs text-slate-400">
              The preview updates as you fill in your funding details.
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
