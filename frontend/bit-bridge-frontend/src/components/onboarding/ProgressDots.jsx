import React from 'react';
import PropTypes from 'prop-types';

const ProgressDots = ({ total, current }) => {
  const items = Array.from({ length: total });

  return (
    <div className="flex items-center gap-1.5">
      {items.map((_, index) => {
        const isActive = index + 1 === current;
        return (
          <span
            key={index}
            className={`h-1.5 rounded-full transition-all ${
              isActive
                ? 'w-5 bg-alt'
                : 'w-2 bg-slate-600'
            }`}
          />
        );
      })}
    </div>
  );
};

ProgressDots.propTypes = {
  total: PropTypes.number.isRequired,
  current: PropTypes.number.isRequired,
};

export default ProgressDots;
