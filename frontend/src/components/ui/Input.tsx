import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            {icon}
          </div>
        )}
        <input
          className={`
            w-full px-3 py-2 text-sm
            bg-white border border-[var(--border-color)] rounded-lg
            placeholder:text-[var(--text-muted)]
            focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]
            disabled:bg-[var(--sidebar-bg)] disabled:cursor-not-allowed
            transition-all duration-150
            ${icon ? 'pl-10' : ''}
            ${error ? 'border-[var(--error)] focus:border-[var(--error)] focus:ring-red-100' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-[var(--error)]">{error}</p>
      )}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
          {label}
        </label>
      )}
      <textarea
        className={`
          w-full px-3 py-2 text-sm
          bg-white border border-[var(--border-color)] rounded-lg
          placeholder:text-[var(--text-muted)]
          focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]
          disabled:bg-[var(--sidebar-bg)] disabled:cursor-not-allowed
          transition-all duration-150 resize-none
          ${error ? 'border-[var(--error)] focus:border-[var(--error)] focus:ring-red-100' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-[var(--error)]">{error}</p>
      )}
    </div>
  );
};
