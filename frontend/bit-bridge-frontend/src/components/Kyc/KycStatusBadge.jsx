// src/compnents/kyc/KycStatusBadge.jsx
import React from 'react';
import PropTypes from 'prop-types';

const getStyles = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'verified':
    case 'approved':
      return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40';
    case 'pending':
    case 'review':
      return 'bg-amber-500/10 text-amber-300 border-amber-500/40';
    case 'rejected':
    case 'failed':
      return 'bg-red-500/10 text-red-300 border-red-500/40';
    default:
      return 'bg-slate-500/10 text-slate-300 border-slate-600/60';
  }
};

const KycStatusBadge = ({ status }) => {
  if (!status) return null;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-medium ${getStyles(
        status
      )}`}
    >
      {status}
    </span>
  );
};

KycStatusBadge.propTypes = {
  status: PropTypes.string,
};

export default KycStatusBadge;
