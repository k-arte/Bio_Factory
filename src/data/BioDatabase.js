/**
 * BioDatabase.js - Master game database (v5.1.0)
 * 
 * Complete specification of all game mechanics:
 * - Biomarkers (diagnostic indicators)
 * - Resources (energy, waste, signals)
 * - Recipes (production formulas with waste)
 * - Buildings (cells, vessels, pumps, diffusers)
 * - Effects (terrain/unit effects with spread)
 * - Diseases (conditions with biomarker triggers)
 * - Drug profiles (medication effectiveness)
 * - Research (tech unlocks)
 * - Units (immune cells)
 * - Pressure system (logistics efficiency)
 * 
 * CRITICAL: All gameplay rules are data. Code executes, never decides.
 */

const BioDatabase = {
  meta: {
    version: "5.1.0",
    language: "ru",
    defaults: {
      resource: {
        transferable: true,
        metric: "",
        tags: []
      },
      diffusion: {
        to_neighbors_per_tick: 0.10,
        to_local_system_per_tick: 0.05,
        to_global_system_per_tick: 0.01
      },
      effects: {
        inflammation: {
          spread_speed: 0.5
        }
      },
      unit: {
        hp_base: 20
      },
      building: {
        hp_base: 100
      },
      logistics: {
        pipes: {
          auto_connect: true
        }
      }
    }
  },

  tags: {
    resource: [
      "ENERGY_BLOODBORNE",
      "ENERGY_INTRACELLULAR",
      "SIGNAL",
      "TOXIN",
      "WASTE"
    ],
    building: [
      "SYSTEM_STRUCTURE",
      "GENERATOR",
      "STORAGE",
      "BALANCER",
      "VESSEL",
      "PUMP",
      "DIFFUSER"
    ],
    drug: [
      "ANTI_INFLAMMATORY",
      "IMMUNO_SUPPRESSANT",
      "THROMB_BUSTER",
      "ALPHA_SYNUCLEIN_TARGETER"
    ],
    effect: [
      "INFLAMMATORY",
      "ATHEROMA",
      "AUTOIMMUNE"
    ]
  },

  biomarkers: [
    {
      id: "BM_PH_BLOOD",
      name: "pH крови (артериальной)",
      metric: "pH",
      normal_range: [7.35, 7.45],
      notes: "Клиническая HH-модель: pH = 6.1 + log10([HCO3-] / (0.03 * PaCO2))"
    },
    {
      id: "BM_LACTATE",
      name: "Лактат (сыворотка)",
      metric: "ммоль/л",
      normal_range: [0.5, 2.2],
      notes: "≥2 — гиперлактатемия; ≥4–5 — выраженная"
    },
    {
      id: "BM_OXYGEN_SAT",
      name: "Сатурация кислорода (SpO2)",
      metric: "%",
      normal_range: [95, 100],
      notes: "Норма при уровне моря для здоровых"
    },
    {
      id: "BM_GLUC",
      name: "Глюкоза (кровь)",
      metric: "мг/дл",
      normal_range: [70, 140]
    },
    {
      id: "BM_WBC",
      name: "Лейкоциты (WBC)",
      metric: "10^9/л",
      normal_range: [4, 11]
    }
  ],

  resources: [
    {
      id: "RES_GLUCOSE",
      name: "Глюкоза",
      tier: "t0",
      tags: ["ENERGY_BLOODBORNE"],
      transferable: true,
      metric: "мг/дл",
      environment_effects: {
        biomarker_mods: [
          { marker_id: "BM_GLUC", mode: "add", value: 5 }
        ]
      }
    },
    {
      id: "RES_OXYGEN",
      name: "Кислород",
      tier: "t1",
      tags: [],
      transferable: true,
      metric: "мл/дл",
      environment_effects: {
        biomarker_mods: [
          { marker_id: "BM_OXYGEN_SAT", mode: "add", value: 1.0 }
        ]
      }
    },
    {
      id: "RES_ATP",
      name: "АТФ",
      tier: "t1",
      tags: ["ENERGY_INTRACELLULAR"],
      transferable: false,
      metric: "µмоль",
      environment_effects: null
    },
    {
      id: "RES_LACTATE",
      name: "Лактат",
      tier: "t0",
      tags: ["WASTE", "TOXIN"],
      transferable: true,
      metric: "ммоль/л",
      environment_effects: {
        biomarker_mods: [
          { marker_id: "BM_LACTATE", mode: "add", value: 0.3 },
          { marker_id: "BM_PH_BLOOD", mode: "add", value: -0.05 }
        ]
      }
    },
    {
      id: "RES_AMINO_ACID",
      name: "Аминокислота",
      tier: "t0",
      tags: [],
      transferable: true,
      metric: "ммоль/л",
      environment_effects: null
    },
    {
      id: "RES_CALCIUM",
      name: "Кальций",
      tier: "t0",
      tags: [],
      transferable: true,
      metric: "ммоль/л",
      environment_effects: null
    },
    {
      id: "RES_CELL_DEBRIS",
      name: "Клеточный мусор",
      tier: "t0",
      tags: ["WASTE"],
      transferable: true,
      metric: "ед.",
      environment_effects: null
    },
    {
      id: "RES_CALCIUM_DEPOSIT",
      name: "Кальциевое отложение (узел)",
      tier: "t0",
      tags: [],
      transferable: false,
      metric: "ед.",
      environment_effects: null
    }
  ],

  recipes: [
    {
      id: "RECIPE_ATP_GLYCOLYSIS",
      name: "Синтез АТФ (гликолиз)",
      machine_ids: ["BLD_PERICYTE_EXTRACTOR", "BLD_ANABOLIC_CELL"],
      inputs: [
        { id: "RES_GLUCOSE", amount: 1 }
      ],
      outputs: [
        { id: "RES_ATP", amount: 2 }
      ],
      waste_outputs: [
        { id: "RES_LACTATE", amount: 1 }
      ],
      accumulation: { resource: "RES_LACTATE", unit: "ммоль", location: "cell" },
      time_seconds: 3,
      priority: 1
    },
    {
      id: "RECIPE_ATP_AEROBIC",
      name: "Синтез АТФ (аэробика, митохондрии)",
      machine_ids: ["BLD_PERICYTE_EXTRACTOR", "BLD_ANABOLIC_CELL"],
      inputs: [
        { id: "RES_GLUCOSE", amount: 1 },
        { id: "RES_OXYGEN", amount: 6 }
      ],
      outputs: [
        { id: "RES_ATP", amount: 32 }
      ],
      waste_outputs: [],
      time_seconds: 5,
      priority: 2,
      unlock_by_research: ["TECH_MITOCHONDRIA"]
    }
  ],

  buildings: [
    {
      id: "BLD_PERICYTE_EXTRACTOR",
      name: "Клетка‑катаболик (перицит)",
      tier: "t0",
      tags: ["GENERATOR"],
      size: [1, 1],
      hp: 100,
      supported_recipes: ["RECIPE_ATP_GLYCOLYSIS", "RECIPE_ATP_AEROBIC"]
    },
    {
      id: "BLD_ANABOLIC_CELL",
      name: "Клетка‑анаболик",
      tier: "t0",
      tags: ["GENERATOR"],
      size: [1, 1],
      hp: 100,
      supported_recipes: ["RECIPE_ATP_GLYCOLYSIS", "RECIPE_ATP_AEROBIC"]
    },
    {
      id: "BLD_SPONGE_CELL",
      name: "Губчатая клетка (балансировщик)",
      tier: "t1",
      tags: ["BALANCER"],
      size: [1, 1],
      hp: 100,
      effects: { throughput: { in: 2, out: 2 } }
    },
    {
      id: "BLD_RESOURCE_DIFFUSER",
      name: "Рассеватель ресурсов",
      tier: "t1",
      tags: ["DIFFUSER", "SYSTEM_STRUCTURE"],
      size: [2, 2],
      hp: 120,
      radius_ft: 20,
      effect: { type: "DIFFUSE_ANY_RESOURCE" },
      maintenance: { RES_GLUCOSE: 2 }
    },
    {
      id: "BLD_STORAGE_MICRO",
      name: "Микро‑вакуоль",
      tier: "t0",
      tags: ["STORAGE"],
      size: [1, 1],
      hp: 80,
      storage_capacity: 100
    },
    {
      id: "BLD_VESSEL",
      name: "Сосуд",
      tier: "t0",
      tags: ["VESSEL", "SYSTEM_STRUCTURE"],
      size: [1, 1],
      hp: 60,
      throughput: 1.0,
      auto_link: true
    },
    {
      id: "BLD_CARDIOCYTE_PUMP",
      name: "Кардиоцит‑насос",
      tier: "t1",
      tags: ["PUMP", "SYSTEM_STRUCTURE"],
      size: [2, 2],
      hp: 200,
      unlock_condition: { type: "RESEARCH_COMPLETE", id: "TECH_LOGISTICS_NODES" }
    }
  ],

  effects: [
    {
      id: "EFFECT_INFLAMMATION",
      name: "Воспаление",
      scope: "terrain",
      tags: ["INFLAMMATORY"],
      visual_filter: { preset: "warm-rim", saturation: 0.1 },
      biomarker_mods: [
        { marker_id: "BM_WBC", mode: "mul", value: 1.10 }
      ],
      spread: { speed: 0.5, radius: 1 }
    },
    {
      id: "EFFECT_ATHEROMA_INFECTION",
      name: "Атерома‑инфекция",
      scope: "terrain",
      tags: ["ATHEROMA"],
      visual_filter: { preset: "lipidic", hue_shift: -0.05 },
      biomarker_mods: []
    },
    {
      id: "EFFECT_AUTOIMMUNE_CONFUSION",
      name: "Аутоиммунная путаница",
      scope: "unit",
      tags: ["AUTOIMMUNE"],
      visual_filter: { preset: "cool-fade", saturation: -0.1 },
      biomarker_mods: []
    }
  ],

  disease_types: [
    {
      id: "DT_INFECTION_BACTERIAL",
      name: "Бактериальная инфекция",
      default_drug_profile: {
        "ANTI_INFLAMMATORY": { weight: 0.3, min_power_threshold: 0.2 },
        "IMMUNO_SUPPRESSANT": { weight: 0.0, min_power_threshold: 0.5 },
        "THROMB_BUSTER": { weight: 0.0, min_power_threshold: 0.6 }
      }
    },
    {
      id: "DT_INFLAMMATION",
      name: "Воспалительное состояние",
      default_drug_profile: {
        "ANTI_INFLAMMATORY": { weight: 1.0, min_power_threshold: 0.3 },
        "IMMUNO_SUPPRESSANT": { weight: 0.4, min_power_threshold: 0.4 }
      }
    },
    {
      id: "DT_METABOLIC_ACIDOSIS",
      name: "Метаболический ацидоз",
      default_drug_profile: {
        "ANTI_INFLAMMATORY": { weight: 0.0, min_power_threshold: 0.5 }
      }
    }
  ],

  diseases: [
    {
      id: "DIS_ECOLI_SWARM",
      name: "Кишечная инфекция E. coli",
      type: "DT_INFECTION_BACTERIAL",
      drug_profile_overrides: {},
      effects: ["EFFECT_INFLAMMATION"]
    },
    {
      id: "DIS_LACTIC_ACIDOSIS",
      name: "Лактацидоз",
      type: "DT_METABOLIC_ACIDOSIS",
      triggers: [
        { marker_id: "BM_LACTATE", op: ">=", value: 4.0 },
        { marker_id: "BM_PH_BLOOD", op: "<=", value: 7.35 }
      ],
      drug_profile_overrides: {}
    }
  ],

  drug_tags: [
    { id: "ANTI_INFLAMMATORY", name: "Противовоспалительный", notes: "Снижает системные воспалительные медиаторы" },
    { id: "IMMUNO_SUPPRESSANT", name: "Иммуносупрессивный", notes: "Понижает активность иммунных клеток" },
    { id: "THROMB_BUSTER", name: "Тромболитический", notes: "Влияет на тромбы и фибрин" },
    { id: "ALPHA_SYNUCLEIN_TARGETER", name: "Ингибитор α‑синуклеина", notes: "Нишевый тег для нейродегенеративных сценариев" }
  ],

  research: [
    {
      id: "TECH_MITOCHONDRIA",
      name: "Митохондриальная симбиоза",
      unlocks: ["RECIPE_ATP_AEROBIC"],
      description: "Открывает высокоприоритетный аэробный рецепт синтеза АТФ"
    },
    {
      id: "TECH_PHAGOCYTOSIS",
      name: "Протокол фагоцитоза",
      unlocks: ["ABILITY_PHAGOCYTOSIS", "UNIT_MACROPHAGE"],
      description: "Открывает способность фагоцитоза и юнита макрофаг"
    },
    {
      id: "TECH_LOGISTICS_NODES",
      name: "Узлы логистики",
      unlocks: ["BLD_CARDIOCYTE_PUMP"],
      description: "Включает продвинутые насосные узлы для повышения эффективности потока"
    }
  ],

  units: [
    {
      id: "UNIT_NEUTROPHIL_JUNIOR",
      name: "Нейтрофил (джуниор)",
      tier: "t0",
      hp: 20,
      damage: 3,
      speed: 1.0,
      abilities: [],
      upgrades: []
    },
    {
      id: "UNIT_NEUTROPHIL",
      name: "Нейтрофил",
      tier: "t2",
      hp: 30,
      damage: 4,
      speed: 1.0,
      abilities: [],
      upgrades: []
    },
    {
      id: "UNIT_MACROPHAGE",
      name: "Макрофаг",
      tier: "t3",
      hp: 60,
      damage: 6,
      speed: 0.8,
      abilities: ["ABILITY_PHAGOCYTOSIS"],
      upgrades: [],
      unlock_condition: { type: "RESEARCH_COMPLETE", id: "TECH_PHAGOCYTOSIS" }
    }
  ],

  pressure_system: {
    base_efficiency_without_pump: 0.10,
    pump_nodes: {
      default_head_gain: 1.0,
      leak_per_tile: 0.02
    }
  }
};

export default BioDatabase;
