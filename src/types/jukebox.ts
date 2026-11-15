export type ColorMappingMode =
  | 'co2_airs'
  | 'gistemp_records'
  | 'geos_aerosols'
  | 'sea_level'
  | 'water_cycle';

export type InteractionMode = 'scanner' | 'probe';

export type WorkspaceView = 'maps' | 'csv';

export interface LegendLayer {
  title: string;
  unit?: string;
  gradient: string;
  labels: string[];
}

export interface CsvDataPoint {
  label: string;
  value: number;
}

export interface CalibrationPreset {
  label: string;
  valueLabel: string;
  normalized: number; // 0..1
  color: string;
}

export interface EarthDisc {
  id: string;
  title: string;
  subtitle: string;
  themeBadge: string;
  svsId: string;
  svsUrl: string;
  mission: string;
  mediaType: 'video' | 'equirect-pan';
  src: string;
  mappingMode: ColorMappingMode;
  unit: string;
  minVal: number;
  maxVal: number;
  accentHex: string;
  vinylGradient: string;
  scanBounds: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  colorbarGradient: string;
  colorbarLabels: string[];
  legendLayers?: LegendLayer[];
  yearRange?: {
    start: number;
    end: number;
  };
  presets: CalibrationPreset[];
  explanation: string;
}

export interface PixelTelemetry {
  xNorm: number;
  yNorm: number;
  lat: number;
  lon: number;
  regionName: string;
  hex: string;
  normalizedValue: number; // 0..1
  formattedValue: string;
  categoryLabel: string;
  noteName: string;
  frequencyHz: number;
  stereoPan: number; // -1..1
}
