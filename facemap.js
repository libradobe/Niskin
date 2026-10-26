// ============================================================================
// MAPA FACIAL ANTES / DESPUÉS
// Rostro dibujado en SVG con marcas livianas { x, y, t } (coordenadas 0-200 x 0-260).
// Reemplaza a las fotos: no ocupa espacio en la base de datos.
// Lo usan el panel (editar) y la página de clientas (solo ver).
// ============================================================================
(function () {
  const MARKS = [
    { t: 'acne', color: '#C95B54', es: 'Acné', en: 'Acne' },
    { t: 'mancha', color: '#8C5C3E', es: 'Mancha / pigmento', en: 'Dark spot' },
    { t: 'arruga', color: '#5E6A7A', es: 'Arruga / línea', en: 'Wrinkle / line' },
    { t: 'poro', color: '#B18B4A', es: 'Poro dilatado', en: 'Enlarged pore' },
    { t: 'rojez', color: '#D9798B', es: 'Rojez / rosácea', en: 'Redness' },
    { t: 'cicatriz', color: '#6E5A8A', es: 'Cicatriz', en: 'Scar' },
    { t: 'seca', color: '#5B8FA8', es: 'Zona seca', en: 'Dry area' }
  ];

  const byType = Object.fromEntries(MARKS.map(m => [m.t, m]));

  // Cada tipo tiene forma propia (no depende solo del color)
  function markShape(m) {
    const def = byType[m.t] || MARKS[0];
    const x = Number(m.x).toFixed(1);
    const y = Number(m.y).toFixed(1);
    const c = def.color;
    switch (m.t) {
      case 'mancha': return `<ellipse cx="${x}" cy="${y}" rx="6" ry="4.5" fill="${c}" fill-opacity="0.75"/>`;
      case 'arruga': return `<path d="M${x - 7} ${y} q 7 -4 14 0" stroke="${c}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
      case 'poro': return `<circle cx="${x}" cy="${y}" r="3.6" fill="none" stroke="${c}" stroke-width="1.8"/>`;
      case 'rojez': return `<circle cx="${x}" cy="${y}" r="8" fill="${c}" fill-opacity="0.35"/>`;
      case 'cicatriz': return `<path d="M${x - 4} ${y - 4} L${+x + 4} ${+y + 4} M${+x + 4} ${y - 4} L${x - 4} ${+y + 4}" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`;
      case 'seca': return `<path d="M${x} ${y - 5} L${+x + 5} ${+y + 4} L${x - 5} ${+y + 4} Z" fill="${c}" fill-opacity="0.8"/>`;
      default: return `<circle cx="${x}" cy="${y}" r="3.4" fill="${c}"/>`;
    }
  }

  function faceSVG(markers, { id = '', interactive = false, label = '' } = {}) {
    const marks = (markers || []).map((m, i) => `<g class="fm-mark" data-index="${i}">${markShape(m)}</g>`).join('');
    return `
      <svg ${id ? `id="${id}"` : ''} class="fm-svg ${interactive ? 'is-interactive' : ''}" viewBox="0 0 200 260" role="img" aria-label="${label}">
        <ellipse cx="100" cy="128" rx="72" ry="96" fill="#F7EEE6" stroke="#C9AE93" stroke-width="2"/>
        <ellipse cx="27" cy="138" rx="9" ry="20" fill="#F2E6DB" stroke="#C9AE93" stroke-width="1.6"/>
        <ellipse cx="173" cy="138" rx="9" ry="20" fill="#F2E6DB" stroke="#C9AE93" stroke-width="1.6"/>
        <path d="M30 104 C 34 44, 166 44, 170 104 C 150 70, 52 70, 30 104 Z" fill="#E6D3C1" opacity="0.85"/>
        <path d="M58 104 q 16 -9 30 -2" stroke="#9C7E66" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M112 102 q 14 -7 30 2" stroke="#9C7E66" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M60 122 q 14 -9 28 0 q -14 8 -28 0 Z" fill="#FFFFFF" stroke="#9C7E66" stroke-width="1.4"/>
        <path d="M112 122 q 14 -9 28 0 q -14 8 -28 0 Z" fill="#FFFFFF" stroke="#9C7E66" stroke-width="1.4"/>
        <circle cx="74" cy="122" r="3.2" fill="#7A5E49"/>
        <circle cx="126" cy="122" r="3.2" fill="#7A5E49"/>
        <path d="M100 126 C 96 146, 92 160, 90 166 q 10 6 20 0 C 108 160, 104 146, 100 126" stroke="#B89378" stroke-width="1.6" fill="none"/>
        <path d="M78 192 q 22 -10 44 0 q -22 16 -44 0 Z" fill="#DDA7A0" stroke="#B9817A" stroke-width="1.4"/>
        <path d="M78 192 q 22 4 44 0" stroke="#B9817A" stroke-width="1.2" fill="none"/>
        <g class="fm-zones" stroke="#D9C4AE" stroke-width="1" stroke-dasharray="3 4" fill="none">
          <path d="M44 100 L156 100"/>
          <path d="M84 100 L84 170 M116 100 L116 170"/>
          <path d="M66 210 Q100 224 134 210"/>
        </g>
        <g class="fm-marks">${marks}</g>
      </svg>
    `;
  }

  function countByType(markers) {
    const counts = {};
    (markers || []).forEach(m => { counts[m.t] = (counts[m.t] || 0) + 1; });
    return counts;
  }

  // Leyenda con conteos Antes → Después
  function legendHTML(before, after, lang = 'es') {
    const b = countByType(before);
    const a = countByType(after);
    const rows = MARKS.filter(m => b[m.t] || a[m.t]);
    if (!rows.length) return '';
    return `
      <ul class="fm-legend">
        ${rows.map(m => `
          <li>
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">${markShape({ x: 10, y: 10, t: m.t })}</svg>
            <span>${m[lang] || m.es}</span>
            <strong>${b[m.t] || 0} → ${a[m.t] || 0}</strong>
          </li>
        `).join('')}
      </ul>
    `;
  }

  // Convierte un clic/toque en coordenadas del rostro
  function pointFromEvent(svg, event) {
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 200;
    const y = ((event.clientY - rect.top) / rect.height) * 260;
    return { x: Math.round(Math.max(0, Math.min(200, x)) * 10) / 10, y: Math.round(Math.max(0, Math.min(260, y)) * 10) / 10 };
  }

  window.NiskinFaceMap = { MARKS, faceSVG, legendHTML, countByType, markShape, pointFromEvent };
})();
