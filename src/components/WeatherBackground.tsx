import './WeatherBackground.css';

interface Props {
  theme: 'sunny' | 'rainy' | 'cloudy' | '';
}

export default function WeatherBackground({ theme }: Props) {
  if (!theme) return null;

  // Minimal: just a subtle top gradient tint, no animated particles
  return (
    <div className={`weather-bg weather-bg--${theme}`} aria-hidden="true" />
  );
}
