// src/compnents/kyc/KycTierCard.jsx
import React from 'react';
import PropTypes from 'prop-types';
import KycStatusBadge from './KycStatusBadge';

const KycTierCard = ({
  title,
  description,
  requirements = [],
  status,
  ctaLabel,
  onClick,
  disabled,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left rounded-2xl border bg-black/60 p-4 md:p-5 transition
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-alt/80 hover:bg-black'}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm md:text-base font-semibold text-white">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-xs text-gray-400">
              {description}
            </p>
          )}
        </div>
        {status && <KycStatusBadge status={status} />}
      </div>

      {requirements.length > 0 && (
        <ul className="mt-2 space-y-1">
          {requirements.map((req) => (
            <li key={req} className="text-[11px] text-gray-400 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-alt" />
              <span>{req}</span>
            </li>
          ))}
        </ul>
      )}

      {ctaLabel && (
        <div className="mt-4">
          <span className="inline-flex items-center text-xs font-medium text-alt">
            {ctaLabel}
            <span className="ml-1">→</span>
          </span>
        </div>
      )}
    </button>
  );
};

KycTierCard.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  requirements: PropTypes.arrayOf(PropTypes.string),
  status: PropTypes.string,
  ctaLabel: PropTypes.string,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
};

export default KycTierCard;
