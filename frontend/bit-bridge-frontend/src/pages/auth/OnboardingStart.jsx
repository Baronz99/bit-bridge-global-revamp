// src/pages/auth/OnboardingStart.jsx

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signup } from '../../api/auth'

const OnboardingStart = () => {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleStart = async (e) => {
    e.preventDefault()

    if (!email || !password || !confirmPassword) {
      alert('Please fill in all fields.')
      return
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match.')
      return
    }

    try {
      setLoading(true)

      // Devise usually expects params under "user"
      const payload = {
        user: {
          email,
          password,
          password_confirmation: confirmPassword,
        },
      }

      const res = await signup(payload)
      console.log('Signup OK:', res.data)

      // Store email for later steps (your app already uses this pattern)
      localStorage.setItem('email', email)

      // After signup with confirmable, user must verify email.
      // Send them to the existing "check email" screen.
      navigate('/check-email')
    } catch (err) {
      console.error('Signup error:', err)
      const message =
        err?.response?.data?.status?.message ||
        err?.response?.data?.error ||
        'Signup failed. Please try again.'

      alert(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-4">
      <div className="w-full max-w-md bg-black/70 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2">
          Create your BitBridge account
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          Start with your email and password. We&apos;ll ask for a few more
          details later to unlock sending money and virtual accounts.
        </p>

        <form onSubmit={handleStart} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-slate-300">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-alt focus:border-alt"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-300">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-alt focus:border-alt"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-300">
              Confirm password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-alt focus:border-alt"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full h-11 md:h-12 rounded-lg bg-alt text-black font-semibold text-sm md:text-base flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Continue'}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-slate-500">
          By continuing, you agree to BitBridge&apos;s Terms and Privacy Policy.
        </p>
      </div>
    </div>
  )
}

export default OnboardingStart
