// src/components/onboarding/OnboardingBanner.jsx
import React from 'react';
import { AlertOutlined, CheckCircleOutlined } from '@ant-design/icons';

/**
 * Smart top-of-dashboard banner
 *
 * Props:
 * - stage: backend onboarding_stage (string or null)
 * - primaryUseCase: backend primary_use_case (string or null)
 * - hasVirtualAccount: boolean – whether user already has any Anchor/Moniepoint account
 * - onContinueClick: function – called when user presses CTA
 */
const OnboardingBanner = ({
  stage,
  primaryUseCase,
  hasVirtualAccount,
  onContinueClick,
}) => {
  // Normalise values
  const _stage = stage || 'email_confirmed';
  const _useCase = primaryUseCase || 'airtime_utilities';

  // Decide banner mode
  const isFullyReady =
    (_stage === 'kyc_complete' || _stage === 'completed') && hasVirtualAccount;

  let title = '';
  let subtitle = '';
  let cta = '';
  let tone = 'pending'; // 'pending' | 'ready'

  if (isFullyReady) {
    tone = 'ready';
    title = 'You’re fully set up on BitBridge 🎉';
    subtitle =
      'Your KYC is complete and your virtual accounts are live. You can now receive transfers, pay vendors and handle bills from one place.';
    cta = 'Go to dashboard';
  } else if (!_useCase || _stage === 'email_confirmed') {
    // No primary use case yet or just email confirmed
    title = 'Let’s personalise your BitBridge account';
    subtitle =
      'Pick how you plan to use BitBridge so we can guide you through the right KYC flow and limits.';
    cta = 'Complete setup';
  } else if (_stage === 'use_case_selected') {
    // Use case chosen, but KYC not fully done
    title = 'Finish verifying your BitBridge account';
    subtitle =
      'Just a few quick checks to unlock transfers, virtual accounts and higher limits for your chosen use case.';
    cta = 'Continue verification';
  } else {
    // Catch-all: show a gentle nudge
    title = 'Keep your BitBridge account secure';
    subtitle =
      'Complete your verification so we can protect your money and unlock all features for you.';
    cta = 'Continue setup';
  }

  // NOTE: we ALWAYS render the banner; tone just changes styling.
  return (
    <div className="mb-5">
      <div
        className={`w-full rounded-2xl border px-4 py-3 md:px-5 md:py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3
          ${
            tone === 'ready'
              ? 'bg-emerald-900/20 border-emerald-500/60'
              : 'bg-sky-900/20 border-sky-500/60'
          }`}
      >
        {/* Left: icon + text */}
        <div className="flex items-start gap-3">
          <div className="mt-1">
            {tone === 'ready' ? (
              <CheckCircleOutlined className="text-emerald-400 text-lg" />
            ) : (
              <AlertOutlined className="text-sky-400 text-lg" />
            )}
          </div>
          <div>
            <p className="text-sm md:text-base font-semibold">
              {title}
            </p>
            <p className="text-xs md:text-sm text-slate-200/80 mt-1 max-w-2xl">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right: CTA */}
        <div className="flex items-center gap-3 md:justify-end">
          {!isFullyReady && (
            <p className="hidden md:block text-[11px] uppercase tracking-[0.18em] text-slate-300/80">
              KYC • COMPLIANCE • FRAUD PROTECTION
            </p>
          )}
          <button
            type="button"
            onClick={onContinueClick}
            className={`px-4 py-2 rounded-full text-xs md:text-sm font-semibold
              ${
                tone === 'ready'
                  ? 'bg-emerald-400 text-black hover:bg-emerald-300'
                  : 'bg-alt text-black hover:bg-alt/90'
              } transition`}
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingBanner;
