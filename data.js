// Generador de ilustraciones clínicas dermatológicas "Antes y Después" en SVG Data URI
// Permite mostrar una comparativa visual realista desde el primer uso y soporta subida de fotos reales.
function createSkinVisualSVG({ mode, clientName, sessionLabel, dateLabel, conditionType }) {
  const isBefore = mode === 'before';
  const bgGradStart = isBefore ? '#EFE4DC' : '#F8EFE6';
  const bgGradEnd = isBefore ? '#DFC9BC' : '#EDD8C5';
  const cheekBase = isBefore ? '#D9B6A3' : '#EACBB8';
  const glowOpacity = isBefore ? '0.08' : '0.52';

  let skinMarks = '';
  if (conditionType === 'acne') {
    skinMarks = isBefore
      ? `
        <!-- Enrojecimiento e imperfecciones activas (Antes) -->
        <circle cx="235" cy="175" r="26" fill="#C96A63" opacity="0.25" filter="url(#blurMark)"/>
        <circle cx="385" cy="180" r="28" fill="#C96A63" opacity="0.24" filter="url(#blurMark)"/>
        <circle cx="225" cy="168" r="5" fill="#B84A42" opacity="0.72"/>
        <circle cx="248" cy="185" r="4" fill="#B84A42" opacity="0.65"/>
        <circle cx="218" cy="192" r="3.5" fill="#C45B52" opacity="0.6"/>
        <circle cx="372" cy="172" r="5.5" fill="#B84A42" opacity="0.7"/>
        <circle cx="395" cy="190" r="4" fill="#B84A42" opacity="0.65"/>
        <circle cx="365" cy="196" r="3" fill="#C45B52" opacity="0.6"/>
        <circle cx="310" cy="95" r="4" fill="#B84A42" opacity="0.55"/>
        <circle cx="292" cy="105" r="3" fill="#B84A42" opacity="0.5"/>
      `
      : `
        <!-- Piel calmada, poros refinados y luminosidad (Después) -->
        <circle cx="235" cy="175" r="18" fill="#D99B8C" opacity="0.10" filter="url(#blurMark)"/>
        <circle cx="385" cy="180" r="18" fill="#D99B8C" opacity="0.10" filter="url(#blurMark)"/>
        <circle cx="225" cy="168" r="2" fill="#C98A7E" opacity="0.22"/>
        <circle cx="372" cy="172" r="2" fill="#C98A7E" opacity="0.22"/>
      `;
  } else if (conditionType === 'melasma') {
    skinMarks = isBefore
      ? `
        <!-- Hiperpigmentación / Manchas solares (Antes) -->
        <ellipse cx="230" cy="165" rx="34" ry="18" fill="#8C5C3E" opacity="0.34" filter="url(#blurMark)"/>
        <ellipse cx="390" cy="165" rx="34" ry="18" fill="#8C5C3E" opacity="0.33" filter="url(#blurMark)"/>
        <ellipse cx="310" cy="96" rx="42" ry="12" fill="#8C5C3E" opacity="0.26" filter="url(#blurMark)"/>
      `
      : `
        <!-- Tono unificado y despigmentado (Después) -->
        <ellipse cx="230" cy="165" rx="26" ry="14" fill="#9E7155" opacity="0.08" filter="url(#blurMark)"/>
        <ellipse cx="390" cy="165" rx="26" ry="14" fill="#9E7155" opacity="0.08" filter="url(#blurMark)"/>
      `;
  } else {
    skinMarks = isBefore
      ? `
        <!-- Piel deshidratada y líneas finas (Antes) -->
        <path d="M 215 160 Q 240 168 260 158" stroke="#9E7B66" stroke-width="1.5" opacity="0.45" fill="none"/>
        <path d="M 360 158 Q 380 168 405 160" stroke="#9E7B66" stroke-width="1.5" opacity="0.45" fill="none"/>
        <ellipse cx="235" cy="175" rx="28" ry="16" fill="#A6826D" opacity="0.22" filter="url(#blurMark)"/>
        <ellipse cx="385" cy="175" rx="28" ry="16" fill="#A6826D" opacity="0.22" filter="url(#blurMark)"/>
      `
      : `
        <!-- Efecto HydraGlow y firmeza (Después) -->
        <ellipse cx="235" cy="162" rx="28" ry="14" fill="#FFFFFF" opacity="0.45" filter="url(#blurMark)"/>
        <ellipse cx="385" cy="162" rx="28" ry="14" fill="#FFFFFF" opacity="0.45" filter="url(#blurMark)"/>
      `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 380">
    <defs>
      <linearGradient id="bgG" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgGradStart}"/>
        <stop offset="100%" stop-color="${bgGradEnd}"/>
      </linearGradient>
      <radialGradient id="skinGlow" cx="50%" cy="42%" r="48%">
        <stop offset="0%" stop-color="#FFFDF9" stop-opacity="${glowOpacity}"/>
        <stop offset="100%" stop-color="${cheekBase}" stop-opacity="0"/>
      </radialGradient>
      <filter id="blurMark">
        <feGaussianBlur stdDeviation="7"/>
      </filter>
    </defs>
    <rect width="620" height="380" fill="url(#bgG)"/>
    <!-- Círculo estético de fondo -->
    <circle cx="310" cy="185" r="148" fill="#FAF6F0" opacity="0.55"/>
    <!-- Silueta facial estética -->
    <path d="M 205 120 C 205 55, 415 55, 415 120 C 420 205, 375 288, 310 298 C 245 288, 200 205, 205 120 Z" fill="${cheekBase}" stroke="#B89378" stroke-width="2"/>
    <ellipse cx="310" cy="170" rx="98" ry="115" fill="url(#skinGlow)"/>
    <!-- Cejas y ojos cerrados relajados en cabina -->
    <path d="M 232 132 Q 258 120 282 130" stroke="#6E523E" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M 338 130 Q 362 120 388 132" stroke="#6E523E" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M 238 148 Q 258 158 278 148" stroke="#6E523E" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    <path d="M 342 148 Q 362 158 382 148" stroke="#6E523E" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    <!-- Nariz y labios suaves -->
    <path d="M 310 148 L 306 196 Q 310 202 316 196" stroke="#A67F64" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M 282 232 Q 310 245 338 232 Q 310 237 282 232 Z" fill="${isBefore ? '#C48A7E' : '#D4887A'}" opacity="0.85"/>
    ${skinMarks}
    <!-- Etiqueta clínica inferior -->
    <rect x="24" y="322" width="572" height="42" rx="12" fill="#37332F" opacity="0.82"/>
    <text x="42" y="348" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="600" fill="#FBFAF7">${clientName} • ${sessionLabel}</text>
    <text x="576" y="348" text-anchor="end" font-family="Plus Jakarta Sans, sans-serif" font-size="12" fill="#DFCDA8">${dateLabel}</text>
  </svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const INITIAL_NISKIN_DATA = {
  studioInfo: {
    name: 'Niskin Beauty Studio',
    city: 'La Romana, República Dominicana',
    currency: 'RD$',
    phone: '+1 (809) 555-0194',
    instagram: '@niskinbeautystudio'
  },

  specialists: [
    {
      id: 'esp-1',
      name: 'Lic. Valeria Niskin',
      role: 'Cosmetóloga Clínica Principal',
      specialty: 'Dermapen, Melasma y Rejuvenecimiento',
      avatarBg: '#EEE5D8',
      initials: 'VN'
    },
    {
      id: 'esp-2',
      name: 'Dra. Camila Estévez',
      role: 'Cosmiatra & Especialista en Piel',
      specialty: 'Peelings Químicos y Control de Acné',
      avatarBg: '#E5D4CE',
      initials: 'CE'
    },
    {
      id: 'esp-3',
      name: 'Est. Sofía Almonte',
      role: 'Especialista Facial & Aparatología',
      specialty: 'HydraGlow, Limpieza Detox y Radiofrecuencia',
      avatarBg: '#D6E1D8',
      initials: 'SA'
    }
  ],

  treatments: [
    {
      id: 'trat-1',
      name: 'Limpieza Facial Profunda Detox',
      category: 'Higiene & Renovación',
      durationMin: 60,
      price: 2800,
      depositRequired: 800,
      description: 'Extracción ultrasónica, exfoliación enzimática, alta frecuencia bactericida y mascarilla hidroplástica calmante.',
      suppliesUsed: [
        { inventoryId: 'inv-1', qty: 1 },
        { inventoryId: 'inv-3', qty: 1 }
      ]
    },
    {
      id: 'trat-2',
      name: 'Dermapen 4 + Cóctel de Exosomas',
      category: 'Bioestimulación',
      durationMin: 75,
      price: 4500,
      depositRequired: 1500,
      description: 'Micropunción eléctrica inductora de colágeno con activos regeneradores para cicatrices, poros dilatados y manchas.',
      suppliesUsed: [
        { inventoryId: 'inv-2', qty: 1 },
        { inventoryId: 'inv-4', qty: 1 }
      ]
    },
    {
      id: 'trat-3',
      name: 'Peeling Químico Renovador Mandélico',
      category: 'Despigmentante & Acné',
      durationMin: 50,
      price: 3600,
      depositRequired: 1000,
      description: 'Renovación celular controlada para unificar el tono, atenuar melasma e hiperpigmentación post-inflamatoria.',
      suppliesUsed: [
        { inventoryId: 'inv-5', qty: 1 },
        { inventoryId: 'inv-3', qty: 1 }
      ]
    },
    {
      id: 'trat-4',
      name: 'Hidratación Profunda HydraGlow',
      category: 'Luminosidad & Barrera',
      durationMin: 60,
      price: 3400,
      depositRequired: 1000,
      description: 'Hidrodermoabrasión con infusión de ácido hialurónico de bajo peso molecular, vitamina C y terapia LED.',
      suppliesUsed: [
        { inventoryId: 'inv-1', qty: 1 },
        { inventoryId: 'inv-4', qty: 1 }
      ]
    },
    {
      id: 'trat-5',
      name: 'Protocolo Anti-Acné + Fototerapia LED',
      category: 'Control Sebáceo',
      durationMin: 60,
      price: 3200,
      depositRequired: 1000,
      description: 'Desinfección profunda, regulación sebácea con niacinamida y ácido salicílico más máscara LED azul antibacteriana.',
      suppliesUsed: [
        { inventoryId: 'inv-1', qty: 1 },
        { inventoryId: 'inv-3', qty: 1 }
      ]
    }
  ],

  patients: [
    {
      id: 'pac-1',
      name: 'Valeria Méndez',
      phone: '809-555-3821',
      email: 'valeria.mendez@email.com',
      age: 29,
      pastelClass: 'pastel-rose',
      initials: 'VM',
      skinBiotype: 'Piel Mixta Deshidratada',
      fitzpatrick: 'Fototipo III',
      mainConcern: 'Acné inflamatorio leve en zona U y marcas post-acné',
      allergies: 'Ninguna conocida (sensibilidad leve al retinol puro)',
      homeRoutineAM: '1. Gel Limpiador Syndet Suave\n2. Sérum Niacinamida 10% + Zinc\n3. Gel Hidratante Ácido Hialurónico\n4. Protector Solar Mineral SPF 50+ (reaplicar cada 3h)',
      homeRoutinePM: '1. Doble limpieza (Agua Micelar + Gel Syndet)\n2. Sérum Ácido Azelaico 15% en zonas con marcas\n3. Crema Reparadora con Ceramidas',
      metrics: {
        hydration: { before: 42, current: 86 },
        toneUniformity: { before: 48, current: 89 },
        texturePores: { before: 50, current: 84 },
        blemishControl: { before: 38, current: 92 }
      },
      beforePhoto: createSkinVisualSVG({
        mode: 'before',
        clientName: 'Valeria Méndez',
        sessionLabel: 'Antes ( Evaluación Inicial - Sesión 1 )',
        dateLabel: '12 Ago 2026',
        conditionType: 'acne'
      }),
      afterPhoto: createSkinVisualSVG({
        mode: 'after',
        clientName: 'Valeria Méndez',
        sessionLabel: 'Después ( Sesión 4 - Evolución Clínica )',
        dateLabel: '14 Oct 2026',
        conditionType: 'acne'
      }),
      sessions: [
        {
          id: 'ses-101',
          date: '2026-08-12',
          treatmentName: 'Limpieza Facial Profunda Detox',
          specialistName: 'Lic. Valeria Niskin',
          activesApplied: 'Enzimas de papaya, Alta Frecuencia, Mascarilla Hidroplástica de Árbol de Té',
          notes: 'Se realizó desincrustación suave en mejillas y mentón. Barrera cutánea reactiva; se indica rutina calmante en casa.',
          improvementScore: '65%'
        },
        {
          id: 'ses-102',
          date: '2026-09-09',
          treatmentName: 'Protocolo Anti-Acné + Fototerapia LED',
          specialistName: 'Dra. Camila Estévez',
          activesApplied: 'Ácido Salicílico 2%, Niacinamida 10%, Luz LED Azul (20 min)',
          notes: 'Disminución del 60% en lesiones activas. Menor eritema post-inflamatorio.',
          improvementScore: '80%'
        },
        {
          id: 'ses-103',
          date: '2026-10-02',
          treatmentName: 'Dermapen 4 + Cóctel de Exosomas',
          specialistName: 'Lic. Valeria Niskin',
          activesApplied: 'Exosomas regeneradores + Ácido Hialurónico reticulado ligero + Velo de Colágeno',
          notes: 'Excelente tolerancia. Textura mucho más lisa, cicatrices superficiales atenuadas y luminosidad notable.',
          improvementScore: '92%'
        }
      ]
    },
    {
      id: 'pac-2',
      name: 'Carolina Santos',
      phone: '829-555-9012',
      email: 'carolina.santos@email.com',
      age: 35,
      pastelClass: 'pastel-sage',
      initials: 'CS',
      skinBiotype: 'Piel Normal a Seca',
      fitzpatrick: 'Fototipo IV',
      mainConcern: 'Melasma malar bilateral y falta de luminosidad',
      allergies: 'Fragancias sintéticas',
      homeRoutineAM: '1. Espuma Limpiadora Calmante\n2. Sérum Vitamina C Estabilizada + Ácido Tranexámico\n3. Emulsión Hidratante Ceramidas\n4. Protector Solar con Color SPF 50+',
      homeRoutinePM: '1. Leche Limpiadora Suave\n2. Sérum Despigmentante Ácido Mandélico + Arbutina\n3. Bálsamo Nutritivo Nocturno',
      metrics: {
        hydration: { before: 46, current: 88 },
        toneUniformity: { before: 39, current: 85 },
        texturePores: { before: 62, current: 90 },
        blemishControl: { before: 75, current: 95 }
      },
      beforePhoto: createSkinVisualSVG({
        mode: 'before',
        clientName: 'Carolina Santos',
        sessionLabel: 'Antes ( Sesión 1 - Melasma Malar )',
        dateLabel: '20 Ago 2026',
        conditionType: 'melasma'
      }),
      afterPhoto: createSkinVisualSVG({
        mode: 'after',
        clientName: 'Carolina Santos',
        sessionLabel: 'Después ( Sesión 3 - Tono Unificado )',
        dateLabel: '10 Oct 2026',
        conditionType: 'melasma'
      }),
      sessions: [
        {
          id: 'ses-201',
          date: '2026-08-20',
          treatmentName: 'Limpieza Facial Profunda Detox',
          specialistName: 'Est. Sofía Almonte',
          activesApplied: 'Limpieza ultrasónica, Vitamina C tópica, Velo despigmentante',
          notes: 'Preparación de la piel previa a protocolo despigmentante.',
          improvementScore: '70%'
        },
        {
          id: 'ses-202',
          date: '2026-09-18',
          treatmentName: 'Peeling Químico Renovador Mandélico',
          specialistName: 'Dra. Camila Estévez',
          activesApplied: 'Ácido Mandélico 30% + Ácido Kójico, Mascarilla Calmante Post-Peeling',
          notes: 'Aclaramiento progresivo de manchas en pómulos sin descamación agresiva.',
          improvementScore: '86%'
        }
      ]
    },
    {
      id: 'pac-3',
      name: 'Mariela Gómez',
      phone: '809-555-7740',
      email: 'mariela.gomez@email.com',
      age: 41,
      pastelClass: 'pastel-lavender',
      initials: 'MG',
      skinBiotype: 'Piel Seca / Madura',
      fitzpatrick: 'Fototipo III',
      mainConcern: 'Líneas de expresión finas, deshidratación y pérdida de firmeza',
      allergies: 'Ninguna',
      homeRoutineAM: '1. Limpiador Cremoso Hidratante\n2. Sérum Péptidos de Cobre + Ácido Hialurónico\n3. Crema Reafirmante Antiedad\n4. Protector Solar Fluido SPF 50+',
      homeRoutinePM: '1. Aceite Limpiador Botánico\n2. Retinaldehído 0.05% (noches alternas)\n3. Crema Rica en Escualano y Péptidos',
      metrics: {
        hydration: { before: 35, current: 91 },
        toneUniformity: { before: 65, current: 90 },
        texturePores: { before: 54, current: 88 },
        blemishControl: { before: 82, current: 96 }
      },
      beforePhoto: createSkinVisualSVG({
        mode: 'before',
        clientName: 'Mariela Gómez',
        sessionLabel: 'Antes ( Piel Deshidratada )',
        dateLabel: '01 Sep 2026',
        conditionType: 'hydration'
      }),
      afterPhoto: createSkinVisualSVG({
        mode: 'after',
        clientName: 'Mariela Gómez',
        sessionLabel: 'Después ( Efecto HydraGlow & Firmeza )',
        dateLabel: '12 Oct 2026',
        conditionType: 'hydration'
      }),
      sessions: [
        {
          id: 'ses-301',
          date: '2026-09-01',
          treatmentName: 'Hidratación Profunda HydraGlow',
          specialistName: 'Est. Sofía Almonte',
          activesApplied: 'Ácido Hialurónico Multimolecular, Oxigenoterapia, Luz LED Roja',
          notes: 'Piel visiblemente más jugosa y elástica desde la primera sesión.',
          improvementScore: '88%'
        }
      ]
    },
    {
      id: 'pac-4',
      name: 'Lucía Fernández',
      phone: '849-555-6103',
      email: 'lucia.fernandez@email.com',
      age: 26,
      pastelClass: 'pastel-amber',
      initials: 'LF',
      skinBiotype: 'Piel Grasa Seborreica',
      fitzpatrick: 'Fototipo IV',
      mainConcern: 'Poros dilatados en zona T y comedones cerrados',
      allergies: 'Lanolina',
      homeRoutineAM: '1. Espuma Purificante con Ácido Salicílico\n2. Tónico Hidratante sin Alcohol\n3. Gel Matificante Seborregulador\n4. Protector Solar Oil-Free Toque Seco SPF 50+',
      homeRoutinePM: '1. Gel Limpiador Syndet\n2. Sérum Niacinamida + Ácido Succínico\n3. Gel-Crema Ligero No Comedogénico',
      metrics: {
        hydration: { before: 58, current: 84 },
        toneUniformity: { before: 64, current: 86 },
        texturePores: { before: 42, current: 85 },
        blemishControl: { before: 49, current: 89 }
      },
      beforePhoto: createSkinVisualSVG({
        mode: 'before',
        clientName: 'Lucía Fernández',
        sessionLabel: 'Antes ( Poros y Comedones )',
        dateLabel: '15 Sep 2026',
        conditionType: 'acne'
      }),
      afterPhoto: createSkinVisualSVG({
        mode: 'after',
        clientName: 'Lucía Fernández',
        sessionLabel: 'Después ( Textura Refinada )',
        dateLabel: '13 Oct 2026',
        conditionType: 'acne'
      }),
      sessions: [
        {
          id: 'ses-401',
          date: '2026-09-15',
          treatmentName: 'Limpieza Facial Profunda Detox',
          specialistName: 'Lic. Valeria Niskin',
          activesApplied: 'Punta de diamante suave, Extracción aséptica, Mascarilla de Carbón Activado',
          notes: 'Reducción inmediata de congestión en zona T.',
          improvementScore: '85%'
        }
      ]
    },
    {
      id: 'pac-5',
      name: 'Gabriela Polanco',
      phone: '809-555-4419',
      email: 'gabriela.polanco@email.com',
      age: 32,
      pastelClass: 'pastel-blue',
      initials: 'GP',
      skinBiotype: 'Piel Sensible / Rosácea Leve',
      fitzpatrick: 'Fototipo II',
      mainConcern: 'Rojeces difusas y sensibilidad térmica',
      allergies: 'Ácido glicólico en altas concentraciones',
      homeRoutineAM: '1. Agua Termo-Calmante + Syndet Extra Suave\n2. Sérum Centella Asiática + Pantenol B5\n3. Crema Barrera Calmante\n4. Protector Solar 100% Mineral Óxido de Zinc SPF 50+',
      homeRoutinePM: '1. Leche Desmaquillante Calmante\n2. Ampolla de Madecassoside\n3. Crema Cica-Reparadora',
      metrics: {
        hydration: { before: 45, current: 89 },
        toneUniformity: { before: 51, current: 87 },
        texturePores: { before: 68, current: 91 },
        blemishControl: { before: 60, current: 93 }
      },
      beforePhoto: createSkinVisualSVG({
        mode: 'before',
        clientName: 'Gabriela Polanco',
        sessionLabel: 'Antes ( Eritema y Sensibilidad )',
        dateLabel: '25 Sep 2026',
        conditionType: 'hydration'
      }),
      afterPhoto: createSkinVisualSVG({
        mode: 'after',
        clientName: 'Gabriela Polanco',
        sessionLabel: 'Después ( Barrera Cutánea Restaurada )',
        dateLabel: '14 Oct 2026',
        conditionType: 'hydration'
      }),
      sessions: [
        {
          id: 'ses-501',
          date: '2026-09-25',
          treatmentName: 'Hidratación Profunda HydraGlow',
          specialistName: 'Est. Sofía Almonte',
          activesApplied: 'Infusión de Pantenol, Centella Asiática y Mascarilla Hidroplástica de Avena',
          notes: 'Calma instantánea del eritema facial.',
          improvementScore: '90%'
        }
      ]
    }
  ],

  appointments: [
    {
      id: 'cita-1',
      patientId: 'pac-1',
      patientName: 'Valeria Méndez',
      pastelClass: 'pastel-rose',
      initials: 'VM',
      treatmentId: 'trat-2',
      treatmentName: 'Dermapen 4 + Cóctel de Exosomas',
      specialistId: 'esp-1',
      specialistName: 'Lic. Valeria Niskin',
      date: '2026-10-14',
      time: '10:00 AM',
      price: 4500,
      depositPaid: 1500,
      status: 'Confirmada'
    },
    {
      id: 'cita-2',
      patientId: 'pac-2',
      patientName: 'Carolina Santos',
      pastelClass: 'pastel-sage',
      initials: 'CS',
      treatmentId: 'trat-3',
      treatmentName: 'Peeling Químico Renovador Mandélico',
      specialistId: 'esp-2',
      specialistName: 'Dra. Camila Estévez',
      date: '2026-10-14',
      time: '11:30 AM',
      price: 3600,
      depositPaid: 1000,
      status: 'Confirmada'
    },
    {
      id: 'cita-3',
      patientId: 'pac-3',
      patientName: 'Mariela Gómez',
      pastelClass: 'pastel-lavender',
      initials: 'MG',
      treatmentId: 'trat-4',
      treatmentName: 'Hidratación Profunda HydraGlow',
      specialistId: 'esp-3',
      specialistName: 'Est. Sofía Almonte',
      date: '2026-10-14',
      time: '02:30 PM',
      price: 3400,
      depositPaid: 0,
      status: 'Pendiente Depósito'
    },
    {
      id: 'cita-4',
      patientId: 'pac-4',
      patientName: 'Lucía Fernández',
      pastelClass: 'pastel-amber',
      initials: 'LF',
      treatmentId: 'trat-1',
      treatmentName: 'Limpieza Facial Profunda Detox',
      specialistId: 'esp-1',
      specialistName: 'Lic. Valeria Niskin',
      date: '2026-10-14',
      time: '04:30 PM',
      price: 2800,
      depositPaid: 800,
      status: 'Confirmada'
    },
    {
      id: 'cita-5',
      patientId: 'pac-5',
      patientName: 'Gabriela Polanco',
      pastelClass: 'pastel-blue',
      initials: 'GP',
      treatmentId: 'trat-4',
      treatmentName: 'Hidratación Profunda HydraGlow',
      specialistId: 'esp-3',
      specialistName: 'Est. Sofía Almonte',
      date: '2026-10-16',
      time: '10:00 AM',
      price: 3400,
      depositPaid: 1000,
      status: 'Confirmada'
    },
    {
      id: 'cita-6',
      patientId: 'pac-1',
      patientName: 'Valeria Méndez',
      pastelClass: 'pastel-rose',
      initials: 'VM',
      treatmentId: 'trat-4',
      treatmentName: 'Hidratación Profunda HydraGlow',
      specialistId: 'esp-1',
      specialistName: 'Lic. Valeria Niskin',
      date: '2026-10-21',
      time: '03:00 PM',
      price: 3400,
      depositPaid: 1000,
      status: 'Confirmada'
    }
  ],

  inventory: [
    {
      id: 'inv-1',
      name: 'Gel Limpiador Syndet Profesional (Cabina 500ml)',
      category: 'Insumo de Cabina',
      sku: 'CAB-001',
      stock: 14,
      minStock: 5,
      unit: 'Aplicaciones / Frascos',
      unitCost: 1450,
      salePrice: 0
    },
    {
      id: 'inv-2',
      name: 'Cartuchos Estériles Dermapen 36-Pin',
      category: 'Insumo de Cabina',
      sku: 'CAB-002',
      stock: 4,
      minStock: 8,
      unit: 'Unidades',
      unitCost: 420,
      salePrice: 0
    },
    {
      id: 'inv-3',
      name: 'Mascarilla Hidroplástica Calmante Rosa Mosqueta & Avena',
      category: 'Insumo de Cabina',
      sku: 'CAB-003',
      stock: 18,
      minStock: 6,
      unit: 'Sobres Dosis',
      unitCost: 310,
      salePrice: 0
    },
    {
      id: 'inv-4',
      name: 'Vial Estéril Ácido Hialurónico + Exosomas (5ml)',
      category: 'Insumo de Cabina',
      sku: 'CAB-004',
      stock: 3,
      minStock: 6,
      unit: 'Viales',
      unitCost: 1650,
      salePrice: 0
    },
    {
      id: 'inv-5',
      name: 'Solución Peeling Químico Ácido Mandélico 30%',
      category: 'Insumo de Cabina',
      sku: 'CAB-005',
      stock: 9,
      minStock: 4,
      unit: 'Dosis Clínica',
      unitCost: 890,
      salePrice: 0
    },
    {
      id: 'inv-6',
      name: 'Protector Solar Mineral Niskin UV Defense SPF 50+',
      category: 'Venta Retail (Skincare)',
      sku: 'RET-101',
      stock: 12,
      minStock: 5,
      unit: 'Unidades',
      unitCost: 980,
      salePrice: 1950
    },
    {
      id: 'inv-7',
      name: 'Sérum Niacinamida 10% + Zinc Seborregulador (30ml)',
      category: 'Venta Retail (Skincare)',
      sku: 'RET-102',
      stock: 3,
      minStock: 5,
      unit: 'Unidades',
      unitCost: 750,
      salePrice: 1600
    },
    {
      id: 'inv-8',
      name: 'Crema Cica-Reparadora Barrera con Ceramidas (50ml)',
      category: 'Venta Retail (Skincare)',
      sku: 'RET-103',
      stock: 9,
      minStock: 4,
      unit: 'Unidades',
      unitCost: 890,
      salePrice: 1850
    }
  ],

  finances: [
    {
      id: 'fin-1',
      date: '2026-10-02',
      concept: 'Sesión Dermapen 4 + Cóctel de Exosomas — Valeria Méndez',
      category: 'Servicio en Cabina',
      type: 'Ingreso',
      method: 'Transferencia Bancaria',
      amount: 4500
    },
    {
      id: 'fin-2',
      date: '2026-10-04',
      concept: 'Venta Protector Solar SPF 50+ & Sérum Niacinamida — Valeria Méndez',
      category: 'Venta Retail Skincare',
      type: 'Ingreso',
      method: 'Tarjeta / POS',
      amount: 3550
    },
    {
      id: 'fin-3',
      date: '2026-10-06',
      concept: 'Reposición Viales Ácido Hialurónico y Mascarillas Hidroplásticas',
      category: 'Compra de Insumos',
      type: 'Gasto',
      method: 'Transferencia Bancaria',
      amount: 12400
    },
    {
      id: 'fin-4',
      date: '2026-10-10',
      concept: 'Peeling Químico Renovador Mandélico — Carolina Santos',
      category: 'Servicio en Cabina',
      type: 'Ingreso',
      method: 'Efectivo',
      amount: 3600
    },
    {
      id: 'fin-5',
      date: '2026-10-12',
      concept: 'Hidratación Profunda HydraGlow — Mariela Gómez',
      category: 'Servicio en Cabina',
      type: 'Ingreso',
      method: 'Tarjeta / POS',
      amount: 3400
    },
    {
      id: 'fin-6',
      date: '2026-10-13',
      concept: 'Limpieza Facial Profunda Detox + Crema Ceramidas — Lucía Fernández',
      category: 'Servicio + Retail',
      type: 'Ingreso',
      method: 'Transferencia Bancaria',
      amount: 4650
    },
    {
      id: 'fin-7',
      date: '2026-10-14',
      concept: 'Depósitos Confirmados de Citas del Día (Valeria, Carolina, Lucía)',
      category: 'Depósito de Reserva',
      type: 'Ingreso',
      method: 'Transferencia Bancaria',
      amount: 3300
    }
  ]
};
