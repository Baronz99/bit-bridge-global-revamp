import React from 'react';
import PropTypes from 'prop-types';

const CARDS = [
  {
    id: 'bills',
    title: 'Pay bills & utilities',
    description: 'Electricity, airtime, data, cable TV and more.',
    tag: 'Quick access',
  },
  {
    id: 'personal_payments',
    title: 'Send & receive money',
    description: 'Transfer to banks and other BitBridge users.',
    tag: 'Requires BVN',
  },
  {
    id: 'salary_business',
    title: 'Salary / business payouts',
    description: 'Use virtual accounts for salaries, groups & businesses.',
    tag: 'Advanced KYC',
  },
];

const UseCaseSelector = ({ value, onChange, onContinue, loading }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="space-y-3 mb-6">
        {CARDS.map((card) => {
          const active = value === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onChange(card.id)}
              className={`w-full text-left rounded-2xl border px-4 py-3 md:px-5 md:py-4 transition flex items-start gap-3
                ${
                  active
                    ? 'border-alt bg-alt/10'
                    : 'border-slate-700 bg-black/40 hover:border-alt/60'
                }`}
            >
              <div className="mt-1">
                <span
                  className={`block h-2 w-2 rounded-full ${
                    active ? 'bg-alt' : 'bg-slate-500'
                  }`}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm md:text-base font-semibold text-white">
                    {card.title}
                  </h3>
                  {card.tag && (
                    <span className="inline-flex items-center rounded-full border border-slate-600 px-2 py-[2px] text-[10px] text-slate-300">
                      {card.tag}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {card.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-2">
        <p className="text-[11px] text-slate-400 mb-3">
          Your selection helps us know which KYC level to guide you to. You
          can always upgrade later from the KYC Center.
        </p>

        <button
          type="button"
          onClick={onContinue}
          disabled={!value || loading}
          className={`w-full h-11 rounded-xl font-medium text-sm shadow-md transition
            ${
              !value || loading
                ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                : 'bg-alt text-white hover:brightness-110'
            }`}
        >
          {loading ? 'Saving...' : 'Finish & go to dashboard'}
        </button>
      </div>
    </div>
  );
};

UseCaseSelector.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onContinue: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

export default UseCaseSelector;
