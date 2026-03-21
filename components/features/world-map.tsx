'use client';

import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

const geoUrl = 'https://unpkg.com/world-atlas@2.0.2/countries-110m.json';

const mapPoints: Array<{
  name: string;
  coordinates: [number, number];
}> = [
  { name: 'US East', coordinates: [-74, 40.7] },
  { name: 'US West', coordinates: [-122.4, 37.8] },
  { name: 'EU West', coordinates: [-0.1, 51.5] },
  { name: 'EU East', coordinates: [30.5, 50.4] },
  { name: 'Asia', coordinates: [139.7, 35.7] },
  { name: 'Australia', coordinates: [151.2, -33.9] },
  { name: 'SA', coordinates: [-46.6, -23.6] },
  { name: 'Africa', coordinates: [18.4, -33.9] },
];

export function WorldMap() {
  return (
    <div
      className="pointer-events-none w-full h-full"
      aria-hidden="true"
      style={{ outline: 'none', userSelect: 'none' }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 140,
          center: [0, 35],
        }}
        className="w-full h-full"
        style={{ backgroundColor: 'transparent', outline: 'none', pointerEvents: 'none' }}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }: { geographies: Array<{ rsmKey: string }> }) =>
            geographies.map((geo) => {
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="rgba(30, 136, 229, 0.25)"
                  stroke="rgba(30, 136, 229, 0.6)"
                  strokeWidth={0.5}
                  style={{ pointerEvents: 'none' }}
                />
              );
            })
          }
        </Geographies>
        {mapPoints.map((point) => (
          <Marker key={point.name} coordinates={point.coordinates}>
            <g>
              <circle r={3} fill="#1E88E5" style={{ filter: 'drop-shadow(0 0 4px rgba(30, 136, 229, 0.6))' }} />
            </g>
          </Marker>
        ))}
      </ComposableMap>
    </div>
  );
}
