import React from 'react';

interface PageContentProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * PageContent - 统一的页面内容容器
 * 提供一致的内边距、间距和响应式布局
 */
export const PageContent: React.FC<PageContentProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`
      w-full
      animate-in fade-in duration-300
      ${className}
    `}>
      {children}
    </div>
  );
};

/**
 * Section - 页面区块
 * 提供统一的区块间距
 */
interface SectionProps {
  children: React.ReactNode;
  className?: string;
  spacing?: 'sm' | 'md' | 'lg' | 'xl';
}

const spacingStyles = {
  sm: 'space-y-3',
  md: 'space-y-4',
  lg: 'space-y-5',
  xl: 'space-y-6',
};

export const Section: React.FC<SectionProps> = ({
  children,
  className = '',
  spacing = 'lg',
}) => {
  return (
    <div className={`
      ${spacingStyles[spacing]}
      ${className}
    `}>
      {children}
    </div>
  );
};

/**
 * Grid - 统一的网格布局
 */
interface GridProps {
  children: React.ReactNode;
  className?: string;
  cols?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
}

const gridCols = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
};

const gridGap = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
};

export const Grid: React.FC<GridProps> = ({
  children,
  className = '',
  cols = 3,
  gap = 'lg',
}) => {
  return (
    <div className={`
      grid ${gridCols[cols]} ${gridGap[gap]}
      ${className}
    `}>
      {children}
    </div>
  );
};

/**
 * EmptyState - 统一的空状态组件
 */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`
      flex flex-col items-center justify-center
      py-12 px-6 text-center
      ${className}
    `}>
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-[var(--primary-light)] flex items-center justify-center text-[var(--primary)] mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium text-[var(--text-primary)] mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--text-muted)] mb-4 max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  );
};


