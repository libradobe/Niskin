
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
