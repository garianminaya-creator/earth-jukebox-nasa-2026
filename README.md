# Earth Jukebox — NASA Space Apps Challenge 2026

Prototipo simplificado de un solo disco para el reto **La máquina de discos de información de la Tierra** (*The Earth Information Jukebox*). Convierte en tiempo real la visualización oficial de anomalías de temperatura global de la NASA (**NASA SVS #5376 — GISTEMP**) en notas musicales y lectura accesible.

## Cómo funciona

- **Fuente NASA:** Video oficial `gistemp_spanish.mp4` (`NASA SVS #5376`, rango `-2.5 °C` a `+3.5 °C`).
- **Lectura en vivo (~20 Hz):** `EarthViewport.tsx` muestrea una vecindad `3×3` de píxeles en `<canvas>` (`240×135`), convierte RGB a HSL (`decodeTemperaturePixel`) y calcula la temperatura en `°C` y la región geográfica.
- **Sonificación (`SonificationEngine.ts`):** `Tone.PolySynth` + filtro pasabajos (`600–3800 Hz`) + paneo estéreo (`-0.95` Oeste a `+0.95` Este) + escala pentatónica de 18 notas (`C3`–`E6`).
- **Accesibilidad:** Botón **Ocultar Mapa (`B`)**, **Narrar (`V`)**, calibración sonora de 3 temperaturas y control completo por teclado (`Espacio`, `M`, `↑ ↓ ← →`).

## Ejecución

```bash
npm install
npm run dev
```
