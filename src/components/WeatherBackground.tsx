import './WeatherBackground.css';

interface Props {
  theme: 'sunny' | 'rainy' | 'cloudy' | '';
}

export default function WeatherBackground({ theme }: Props) {
  if (!theme) return null;

  return (
    <div className={`weather-bg weather-bg--${theme}`} aria-hidden="true">
      {theme === 'rainy' && (
        <div className="rain-container">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="raindrop"
              style={{
                left: `${Math.random() * 100}%`,
                animationDuration: `${0.6 + Math.random() * 0.4}s`,
                animationDelay: `${Math.random() * 2}s`,
                opacity: 0.3 + Math.random() * 0.4,
              }}
            />
          ))}
        </div>
      )}
      {theme === 'sunny' && (
        <>
          <div className="sun-glow" />
          <div className="sparkles">
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="sparkle"
                style={{
                  left: `${10 + Math.random() * 80}%`,
                  top: `${10 + Math.random() * 80}%`,
                  animationDuration: `${2 + Math.random() * 3}s`,
                  animationDelay: `${Math.random() * 3}s`,
                  fontSize: `${6 + Math.random() * 10}px`,
                }}
              />
            ))}
          </div>
        </>
      )}
      {theme === 'cloudy' && (
        <div className="clouds">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="cloud"
              style={{
                top: `${10 + i * 18}%`,
                animationDuration: `${18 + Math.random() * 20}s`,
                animationDelay: `${-Math.random() * 20}s`,
                opacity: 0.15 + Math.random() * 0.15,
                transform: `scale(${0.6 + Math.random() * 0.8})`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
