import './Button.css';

export default function Button({
  children,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  icon,
  onClick,
  disabled = false,
  ...props
}) {
  const className = `btn btn--${variant} btn--${size} ${fullWidth ? 'btn--full' : ''}`;

  return (
    <button
      className={className}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="btn__icon">{icon}</span>}
      {children}
    </button>
  );
}
