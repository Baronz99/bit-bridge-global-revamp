import React from 'react';
import PropTypes from 'prop-types';
import ProgressDots from './ProgressDots';

const OnboardingLayout = ({
  title,
  subtitle,
  currentStep,
  totalSteps,
  children,
  onBack,
  showBack = true,
}) => {
  return (
    <div className="min-h-screen bg-black/90 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-5xl bg-slate-950/90 border border-slate-800 rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row">
        {/* Left side – text + progress */}
        <div className="md:w-2/5 bg-gradient-to-b from-slate-900 to-black px-6 py-8 md:px-8 md:py-10 border-b md:border-b-0 md:border-r border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs tracking-[0.2em] uppercase text-slate-400">
              Welcome to BitBridge
            </span>
            <ProgressDots total={totalSteps} current={currentStep} />
          </div>

          <h1 className="text-2xl md:text-3xl font-semibold mb-3 text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-slate-300 mb-6">
              {subtitle}
            </p>
          )}

          <ul className="space-y-2 text-xs text-slate-400">
            <li>• Pay bills and utilities in seconds</li>
            <li>• Send & receive money securely</li>
            <li>• Get virtual / deposit accounts powered by partners</li>
          </ul>

          {showBack && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mt-8 inline-flex items-center text-xs text-slate-300 hover:text-alt transition-colors"
            >
              <span className="mr-1">←</span> Back
            </button>
          )}
        </div>

        {/* Right side – step content */}
        <div className="md:w-3/5 p-6 md:p-8">
          {children}
        </div>
      </div>
    </div>
  );
};

OnboardingLayout.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  currentStep: PropTypes.number.isRequired,
  totalSteps: PropTypes.number.isRequired,
  children: PropTypes.node,
  onBack: PropTypes.func,
  showBack: PropTypes.bool,
};

export default OnboardingLayout;
