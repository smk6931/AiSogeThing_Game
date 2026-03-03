import './Card.css';

export default function Card({
  children,
  variant = 'glass',
  padding = 'medium',
  hover = false,
  onClick,
  className = '',
  ...props
}) {
  const cardClass = `card card--${variant} card--padding-${padding} ${hover ? 'card--hover' : ''} ${className}`;

  return (
    <div className={cardClass} onClick={onClick} {...props}>
      {children}
    </div>
  );
}
