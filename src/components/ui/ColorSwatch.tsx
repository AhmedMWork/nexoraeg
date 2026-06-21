import { cn } from '@/lib/utils';

type ColorSwatchProps = {
  color?: string;
  pattern?: string;
  label?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClasses = {
  xs: 'h-2.5 w-2.5',
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

export default function ColorSwatch({ color, pattern, label, size = 'sm', className }: ColorSwatchProps) {
  const style = color || pattern ? { backgroundColor: color, backgroundImage: pattern } : undefined;
  return (
    <span
      className={cn('inline-flex shrink-0 rounded-full border border-white/25 bg-[#D7C5B2] shadow-inner', sizeClasses[size], className)}
      style={style}
      title={label}
      aria-label={label ? `Color ${label}` : 'Selected color'}
    />
  );
}
