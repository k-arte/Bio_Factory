/**
 * BioDatabase.js - Master game database with unlock conditions and mechanics
 * This is the single source of truth for all game content
 * 
 * SCHEMA:
 * - Unlock Conditions: Every entry can have an unlock_condition to block until criteria met
 * - Behavior Patterns: Units can have multiple mode switches
 * - Terrain Effects: Multiple simultaneous effects with configurable values
 * - AoE Emitters: Buildings can apply effects to nearby cells
 * - Alternative Recipes: Resources can have multiple crafting methods
 */

const BioDatabase = {
  meta: {
    version: "4.0.0",
    last_updated: "2026-02-08"
  },

  // ============================================================
  // RESOURCES (With Alternative Recipes)
  // ============================================================
  resources: [
    {
      id: "RES_GLUCOSE",
      name: "Glucose",
      icon: "🍯",
      type: "resource",
      description: "Primary energy source for cellular processes.",
      unit: "mg/dL",
      normal_range: "70-100",
      sources: ["Extractor", "Capillary Bed"],
      uses: ["Mitochondria", "Cytosol"],
      tips: "Glucose is critical - maintain steady production.",
      // Glucose is always unlocked (available from start)
      unlock_condition: null
    },
    {
      id: "RES_OXYGEN",
      name: "Oxygen",
      icon: "💨",
      type: "resource",
      description: "Essential for aerobic respiration.",
      unit: "%",
      normal_range: "90-100",
      sources: ["Capillary Bed"],
      uses: ["Mitochondria"],
      tips: "Oxygen levels directly affect ATP efficiency.",
      unlock_condition: null
    },
    {
      id: "RES_ATP",
      name: "ATP",
      icon: "⚡",
      type: "resource",
      description: "Energy currency of the cell.",
      unit: "μmol",
      normal_range: "2.5-4.0",
      sources: ["Mitochondria"],
      uses: ["All cellular processes"],
      tips: "ATP production is the core of your factory system.",
      unlock_condition: null,
      
      // Default recipe (always available)
      default_recipe: {
        id: "RECIPE_ATP_GLYCOLYSIS",
        machine: "BLD_MITOCHONDRIA",
        inputs: [{ id: "RES_GLUCOSE", amount: 1 }],
        outputs: [{ id: "RES_ATP", amount: 2 }],
        time_seconds: 3
      },
      
      // Alternative recipes (locked until unlocked)
      alt_recipes: [
        {
          id: "RECIPE_ATP_AEROBIC",
          machine: "BLD_MITOCHONDRIA",
          inputs: [
            { id: "RES_GLUCOSE", amount: 1 },
            { id: "RES_OXYGEN", amount: 6 }
          ],
          outputs: [{ id: "RES_ATP", amount: 32 }],
          time_seconds: 5,
          unlock_condition: {
            type: "STAT_THRESHOLD",
            stat: "total_energy_produced",
            value: 1000
          }
        }
      ]
    }
  ],

  // ============================================================
  // BUILDINGS (With AoE Emitters)
  // ============================================================
  buildings: [
    {
      id: "BLD_EXTRACTOR",
      name: "Glucose Extractor",
      icon: "⛏️",
      type: "building",
      description: "Harvests glucose from endothelial cells.",
      cost: { glucose: 0 },
      production: { glucose: 5 },
      consumption: { atp: 1 },
      buildTime: 5,
      size: "1x1",
      tips: "Place on Endothelium terrain.",
      stats: {
        efficiency: "85%",
        durability: "High"
      },
      unlock_condition: null
    },
    {
      id: "BLD_MITOCHONDRIA",
      name: "Mitochondria Factory",
      icon: "🔄",
      type: "building",
      description: "Produces ATP through aerobic respiration.",
      cost: { glucose: 100 },
      production: { atp: 15 },
      consumption: { glucose: 5, oxygen: 3 },
      buildTime: 15,
      size: "2x2",
      tips: "Most important building.",
      stats: {
        efficiency: "92%",
        yield: "3 ATP per glucose"
      },
      unlock_condition: {
        type: "STAT_THRESHOLD",
        stat: "total_energy_produced",
        value: 500
      }
    },
    {
      id: "BLD_NO_SPRAYER",
      name: "Nitric Oxide Dispenser",
      icon: "💨",
      type: "building",
      description: "Applies beneficial NO effect to surrounding area.",
      cost: { glucose: 150 },
      production: {},
      consumption: { atp: 5 },
      buildTime: 20,
      size: "2x2",
      tips: "Removes pressure accumulation in area.",
      stats: {
        range: "5 cells",
        effect: "Remove HIGH_PRESSURE"
      },
      unlock_condition: {
        type: "RESEARCH_COMPLETE",
        tech_id: "TECH_VASODILATION"
      },
      
      // AoE Emitter Logic
      aoe_emitter: {
        radius: 5,
        consumes: { id: "RES_NITRIC_OXIDE", per_minute: 60 },
        effect: {
          type: "REMOVE_TERRAIN_EFFECT",
          target_effect_id: "TER_HIGH_PRESSURE"
        },
        visual_effect: "PARTICLE_MIST_CYAN"
      }
    }
  ],

  // ============================================================
  // TERRAIN (With Multiple Effects)
  // ============================================================
  terrain: [
    {
      id: "TER_NORMAL",
      name: "Normal Tissue",
      icon: "🟦",
      type: "terrain",
      description: "Standard cellular environment.",
      active_effects: [],
      unlock_condition: null
    },
    {
      id: "TER_INFLAMMATION",
      name: "Inflammation",
      icon: "🔴",
      type: "terrain",
      description: "Harmful condition that damages production and slows units.",
      active_effects: [
        { type: "SYSTEM_MOD", stat: "PRESSURE", modpercent: 0.5 },
        { type: "UNIT_DAMAGE", value: 5, interval: 1.0 },
        { type: "UNIT_SLOW", percent: 0.5 }
      ],
      unlock_condition: null
    },
    {
      id: "TER_HIGH_PRESSURE",
      name: "High Pressure",
      icon: "🔵",
      type: "terrain",
      description: "Restricts movement and damages buildings.",
      active_effects: [
        { type: "UNIT_SLOW", percent: 0.7 },
        { type: "BUILDING_DAMAGE", value: 2, interval: 2.0 }
      ],
      unlock_condition: null
    }
  ],

  // ============================================================
  // UNITS (With Behavior Patterns)
  // ============================================================
  units: [
    {
      id: "UNIT_MACROPHAGE",
      name: "Macrophage",
      icon: "🟢",
      faction: "PLAYER",
      type: "unit",
      description: "Immune cell that engulfs pathogens.",
      cost: { atp: 50 },
      health: 100,
      speed: 3,
      attack: 15,
      range: 1,
      tips: "Effective against bacteria and foreign objects.",
      stats: {
        armor: "Medium",
        special_ability: "Phagocytosis"
      },
      
      // Behavior Patterns (Switchable AI modes)
      behavior_patterns: [
        {
          id: "PAT_PATROL",
          name: "Patrol Area",
          logic: "MOVE_RANDOM_IN_RADIUS",
          is_default: true,
          description: "Randomly patrol assigned area"
        },
        {
          id: "PAT_DEFEND",
          name: "Guard Position",
          logic: "STAND_GROUND_ATTACK_RANGE",
          description: "Stand ground and attack enemies nearby"
        },
        {
          id: "PAT_HUNT",
          name: "Search & Destroy",
          logic: "CHASE_NEAREST_ENEMY_GLOBAL",
          description: "Hunt down nearest enemy globally"
        }
      ],
      
      unlock_condition: {
        type: "STAT_THRESHOLD",
        stat: "enemies_killed.UNIT_BACTERIA_BASIC",
        value: 10
      }
    },
    {
      id: "UNIT_BACTERIA_BASIC",
      name: "Basic Bacteria",
      icon: "🦠",
      faction: "ENEMY",
      type: "unit",
      description: "Simple pathogenic bacteria.",
      health: 20,
      speed: 2,
      attack: 5,
      range: 1,
      tips: "Easy to kill, spawns in groups.",
      stats: {
        armor: "None",
        reward_atp: 10
      },
      unlock_condition: null
    },
    {
      id: "UNIT_VIRUS",
      name: "Virus",
      icon: "🔺",
      faction: "ENEMY",
      type: "unit",
      description: "Microscopic pathogen that replicates rapidly.",
      health: 5,
      speed: 4,
      attack: 3,
      range: 1,
      tips: "Fast but fragile. Kill quickly before replication.",
      stats: {
        armor: "None",
        special: "Replicates on kill"
      },
      unlock_condition: {
        type: "STAT_THRESHOLD",
        stat: "total_energy_produced",
        value: 2000
      }
    }
  ],

  // ============================================================
  // RESEARCH/TECHNOLOGIES
  // ============================================================
  technologies: [
    {
      id: "TECH_VASODILATION",
      name: "Vasodilation",
      icon: "🧬",
      type: "research",
      description: "Learn to control blood vessel dilation for better nutrient delivery.",
      cost: { atp: 200 },
      research_time: 30,
      tips: "Reduces pressure buildup in tissues.",
      unlock_condition: {
        type: "STAT_THRESHOLD",
        stat: "total_energy_produced",
        value: 1500
      }
    }
  ],

  // ============================================================
  // STRUCTURES (Organ Functional Units with Health/Broken States)
  // ============================================================
  structures: [
    {
      id: "STR_CAPILLARY_BED",
      name: "Capillary Bed",
      icon: "🫀",
      type: "structure",
      description: "Functional unit that extracts oxygen and nutrients from bloodstream.",
      biome: "ENDOTHELIUM",
      health: 150,
      min_count: 5,
      max_count: 20,
      stats: {
        oxygen_production: 8,
        glucose_extraction: 6,
        repair_time_seconds: 45
      },
      states: {
        HEALTHY: {
          effects: [
            { type: "PRODUCTION", resource: "RES_OXYGEN", amount: 8 },
            { type: "PRODUCTION", resource: "RES_GLUCOSE", amount: 6 }
          ]
        },
        BROKEN: {
          effects: [
            { type: "SYSTEM_MOD", stat: "SYS_OXYGENATION", modifier: -0.5 },
            { type: "SYSTEM_MOD", stat: "SYS_ENERGY", modifier: -0.3 }
          ],
          repair_cost: { atp: 100 },
          repair_time: 30
        }
      },
      unlock_condition: null
    },
    {
      id: "STR_MITOCHONDRIAL_FACTORY",
      name: "Mitochondrial Factory",
      icon: "⚡",
      type: "structure",
      description: "ATP production unit with aerobic respiration chain.",
      biome: "CYTOPLASM",
      health: 200,
      min_count: 3,
      max_count: 15,
      stats: {
        atp_production: 45,
        efficiency: "95%",
        repair_time_seconds: 60
      },
      states: {
        HEALTHY: {
          effects: [
            { type: "PRODUCTION", resource: "RES_ATP", amount: 45 }
          ]
        },
        BROKEN: {
          effects: [
            { type: "SYSTEM_MOD", stat: "SYS_ENERGY", modifier: -0.8 },
            { type: "SYSTEM_MOD", stat: "SYS_TOXICITY", modifier: 0.6 }
          ],
          repair_cost: { atp: 200 },
          repair_time: 60
        }
      },
      unlock_condition: {
        type: "STAT_THRESHOLD",
        stat: "total_energy_produced",
        value: 1000
      }
    },
    {
      id: "STR_LYSOSOME_ARRAY",
      name: "Lysosome Array",
      icon: "🧹",
      type: "structure",
      description: "Cleanup unit that breaks down cellular waste and pathogens.",
      biome: "CYTOPLASM",
      health: 100,
      min_count: 2,
      max_count: 10,
      stats: {
        waste_processing: 15,
        pathogen_killing: 20,
        repair_time_seconds: 40
      },
      states: {
        HEALTHY: {
          effects: [
            { type: "SYSTEM_MOD", stat: "SYS_TOXICITY", modifier: -0.4 }
          ]
        },
        BROKEN: {
          effects: [
            { type: "SYSTEM_MOD", stat: "SYS_TOXICITY", modifier: 0.5 }
          ],
          repair_cost: { atp: 80 },
          repair_time: 40
        }
      },
      unlock_condition: null
    },
    {
      id: "STR_ENDOPLASMIC_FACTORY",
      name: "Endoplasmic Reticulum",
      icon: "🔗",
      type: "structure",
      description: "Protein synthesis and processing unit.",
      biome: "CYTOPLASM",
      health: 120,
      min_count: 2,
      max_count: 8,
      stats: {
        protein_synthesis: 12,
        repair_time_seconds: 35
      },
      states: {
        HEALTHY: {
          effects: [
            { type: "PRODUCTION", resource: "RES_AMINO_ACIDS", amount: 12 }
          ]
        },
        BROKEN: {
          effects: [
            { type: "SYSTEM_MOD", stat: "SYS_GROWTH", modifier: -0.7 }
          ],
          repair_cost: { atp: 90 },
          repair_time: 35
        }
      },
      unlock_condition: {
        type: "STAT_THRESHOLD",
        stat: "total_energy_produced",
        value: 2000
      }
    }
  ],

  // ============================================================
  // WORKER UNITS (Via Mitosis/Differentiation)
  // ============================================================
  worker_units: [
    {
      id: "UNIT_STEM_CELL",
      name: "Stem Cell",
      icon: "🧬",
      faction: "PLAYER",
      type: "worker",
      description: "Undifferentiated cell that performs mitosis to become a building.",
      cost: { atp: 0 },
      health: 50,
      speed: 2,
      specializations: [
        {
          id: "SPEC_CATABOLIC_CELL",
          name: "Catabolic Cell (Catabolism)",
          target_building: "BLD_CATABOLIC_CELL",
          requires: { glucose: 10, atp: 30 },
          mitosis_time: 8
        },
        {
          id: "SPEC_ANABOLIC_CELL",
          name: "Anabolic Cell (Anabolism)",
          target_building: "BLD_ANABOLIC_CELL",
          requires: { amino_acids: 15, atp: 40 },
          mitosis_time: 10
        }
      ],
      unlock_condition: null
    }
  ],

  // ============================================================
  // SPECIALIZED BUILDINGS (From Mitosis)
  // ============================================================
  specialized_buildings: [
    {
      id: "BLD_CATABOLIC_CELL",
      name: "Catabolic Cell",
      icon: "💥",
      type: "specialized_building",
      description: "Breaks down molecules for energy. Created via StemCell mitosis.",
      production: { atp: 20 },
      consumption: { glucose: 8 },
      buildTime: 0,
      size: "1x1",
      tips: "Self-replicating via mitosis.",
      stats: {
        efficiency: "88%",
        energy_yield: "2.5 ATP per glucose"
      },
      unlock_condition: null
    },
    {
      id: "BLD_ANABOLIC_CELL",
      name: "Anabolic Cell",
      icon: "🧱",
      type: "specialized_building",
      description: "Synthesizes proteins and structures. Created via StemCell mitosis.",
      production: { proteins: 15 },
      consumption: { amino_acids: 12, atp: 25 },
      buildTime: 0,
      size: "1x1",
      tips: "Critical for growth and repair.",
      stats: {
        protein_yield: "1.2 proteins per amino acid",
        repair_speed: "High"
      },
      unlock_condition: null
    }
  ]
};

// Export as ES6 module
export default BioDatabase;
