import './LoadingSkeleton.css';

export default function LoadingSkeleton() {
  return (
    <div className="skeleton-container">
      <div className="skeleton-section">
        <div className="skeleton-title shimmer" />
        <div className="skeleton-cards">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-card shimmer" />
          ))}
        </div>
      </div>
      <div className="skeleton-layout">
        <div className="skeleton-left">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton-day">
              <div className="skeleton-day-header shimmer" />
              <div className="skeleton-attraction shimmer" />
              <div className="skeleton-attraction shimmer" />
            </div>
          ))}
        </div>
        <div className="skeleton-right">
          <div className="skeleton-map shimmer" />
        </div>
      </div>
    </div>
  );
}
