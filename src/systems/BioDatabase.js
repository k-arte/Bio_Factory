const BioDatabase = {
  "meta": {
    "version": "1.0",
    "last_update": "2026-02-09",
    "author": "Gemini-Hiro-Collaboration"
  },

  // ============================================================
  // 1. RESOURCES (С формами и цветами для обучения)
  // ============================================================
  "resources": [
    {
      "id": "RES_GLUCOSE",
      "name": "Glucose",
      "icon": "🔵",
      "description": "Primary energy source for all cellular processes.",
      "tips": "Extract from intestinal tissue using Pericyte Extractors. Convert to ATP via Mitochondrial pathways.",
      "ui_data": { "name": "Glucose", "shape": "CIRCLE", "color": "#00CCFF" },
      "physics": { "viscosity": 0.2 },
      "unlock_condition": { "type": "START_DEFAULT" }
    },
    {
      "id": "RES_AMINO_ACID",
      "name": "Amino Acid",
      "icon": "⚪",
      "description": "Building blocks for protein synthesis and cellular repair.",
      "tips": "Obtained by breaking down cell debris in Catabolic Disassemblers. Used in anabolic assembly.",
      "ui_data": { "name": "Amino Acid", "shape": "HEXAGON", "color": "#FFFFFF" },
      "physics": { "viscosity": 0.3 },
      "unlock_condition": { "type": "ITEM_COLLECTED", "target": "RES_CELL_DEBRIS", "val": 1 }
    },
    {
      "id": "RES_CALCIUM",
      "name": "Calcium Grit",
      "icon": "🟫",
      "description": "Mineral compound essential for cell signaling and structure.",
      "tips": "Extract from calcified tissue zones. Required for calcium-dependent pathways.",
      "ui_data": { "name": "Calcium Grit", "shape": "TRIANGLE", "color": "#E0E0E0" },
      "physics": { "viscosity": 1.0 },
      "unlock_condition": { "type": "ITEM_COLLECTED", "target": "RES_CALCIUM_DEPOSIT", "val": 1 }
    },
    {
      "id": "RES_ATP",
      "name": "ATP (Energy)",
      "icon": "⚡",
      "description": "The universal energy currency of cells. Powers building operations.",
      "tips": "Produced by mitochondrial metabolism. Consumed by anabolic assembly and active transport.",
      "physics": { "viscosity": 0.1 },
      "unlock_condition": { "type": "START_DEFAULT" }
    },
    {
      "id": "RES_OXYGEN",
      "name": "Oxygen",
      "icon": "💨",
      "description": "Terminal electron acceptor for aerobic respiration. Boosts ATP efficiency.",
      "tips": "Extracted from capillary beds. Increases mitochondrial ATP production rate.",
      "ui_data": { "shape": "CIRCLE", "color": "#87CEEB" },
      "physics": { "viscosity": 0.05 },
      "unlock_condition": { "type": "START_DEFAULT" }
    },
    {
      "id": "RES_CELL_DEBRIS",
      "name": "Cell Debris",
      "icon": "🗑",
      "description": "Waste material from cellular breakdown and turnover.",
      "tips": "Accumulates naturally from environmental degradation. Recycle in Catabolic units.",
      "physics": { "viscosity": 0.4 },
      "unlock_condition": { "type": "START_DEFAULT" }
    }
  ],

  // ============================================================
  // 2. STRUCTURES (Объекты на карте: Здоровые / Сломанные)
  // ============================================================
  "structures": [
    {
      "id": "STR_NEPHRON_UNIT",
      "name": "Nephron Unit",
      "icon": "🫘",
      "description": "Kidney structure that filters waste and regulates fluid balance. One of the body's critical organs.",
      "tips": "Maintain health for steady filtration bonuses. Damage triggers toxicity accumulation system-wide.",
      "biome": "KIDNEY",
      "size": [5, 5],
      "states": {
        "HEALTHY": {
          "model_id": "mdl_nephron_ok",
          "local_bonus": { "resource_yield": 1.5 },
          "systemic_bonus": { "SYS_FILTRATION": 0.05 },
          "aggro_weight": 100
        },
        "BROKEN": {
          "model_id": "mdl_nephron_dmg",
          "local_malus": { "resource_yield": 0.1 },
          "systemic_malus": { "SYS_TOXICITY": 0.02 },
          "repair_cost": [ { "id": "RES_AMINO_ACID", "amount": 100 } ],
          "aggro_weight": 10
        }
      }
    },
    {
      "id": "STR_VILLI_ABSORBER",
      "name": "Intestinal Villi",
      "icon": "🧬",
      "description": "Finger-like projections in the small intestine. Primary site for glucose and nutrient absorption.",
      "tips": "High glucose yield when healthy. Damage severely reduces nutrient uptake. Protect these at all costs!",
      "biome": "SMALL_INTESTINE",
      "size": [4, 4],
      "states": {
        "HEALTHY": {
          "model_id": "mdl_villi_ok",
          "local_bonus": { "GLUCOSE_YIELD": 2.0 },
          "systemic_bonus": { "SYS_ENERGY_STABILITY": 0.1 }
        },
        "BROKEN": {
          "model_id": "mdl_villi_dmg",
          "local_malus": { "GLUCOSE_YIELD": 0.05 },
          "systemic_malus": { "SYS_GLUCOSE_ABSORPTION": -0.05 }
        }
      }
    },
    {
      "id": "STR_CAPILLARY_BED",
      "name": "Capillary Bed",
      "icon": "🩸",
      "description": "Tiny blood vessels for oxygen and nutrient transport. Enables resource distribution network.",
      "tips": "Place buildings adjacent to capillaries to improve distribution. Healthy capillaries boost oxygen efficiency.",
      "biome": "CIRCULATORY",
      "size": [1, 1],
      "states": {
        "HEALTHY": {
          "local_bonus": { "transport_speed": 1.5 },
          "systemic_bonus": { "SYS_CIRCULATION": 0.1 }
        },
        "BROKEN": {
          "local_malus": { "transport_speed": 0.1 },
          "systemic_malus": { "SYS_OXYGEN_DELIVERY": -0.2 }
        }
      }
    }
  ],

  // ============================================================
  // 3. BUILDINGS (Стволовая клетка, Катаболизм, Анаболизм)
  // ============================================================
  "buildings": [
    {
      "id": "BLD_NUCLEUS_MAIN",
      "name": "Pluripotent Nucleus",
      "icon": "🔴",
      "description": "The main cellular command center. Produces stem cells through mitosis.",
      "tips": "Place near energy sources. Stem cells can differentiate into specialized worker types. This is your primary factory.",
      "is_main": true,
      "cost": { "RES_GLUCOSE": 100 },
      "production": { "UNIT_STEM_CELL": 1 },
      "recipes": [
        { "id": "PRC_MITOSIS", "output": "UNIT_STEM_CELL", "cost": { "RES_GLUCOSE": 20 } }
      ],
      "unlock_condition": { "type": "START_DEFAULT" }
    },
    {
      "id": "BLD_CATABOLISM_CELL",
      "name": "Catabolic Disassembler",
      "icon": "🔧",
      "description": "Breaks down cell debris into reusable amino acids. Essential for recycling waste.",
      "tips": "Place near debris accumulation zones. Works best with steady debris input. Unlock by collecting debris.",
      "cost": { "RES_GLUCOSE": 50 },
      "consumption": { "RES_CELL_DEBRIS": 1 },
      "production": { "RES_AMINO_ACID": 0.5 },
      "processes": [
        { "id": "PRC_LYSIS", "input": "RES_CELL_DEBRIS", "output": "RES_AMINO_ACID", "rate": 0.5 }
      ],
      "unlock_condition": { "type": "ITEM_COLLECTED", "target": "RES_CELL_DEBRIS", "val": 5 }
    },
    {
      "id": "BLD_ANABOLISM_CELL",
      "name": "Anabolic Assembler",
      "icon": "⚙",
      "description": "Uses amino acids and ATP to synthesize complex biological components and structures.",
      "tips": "Consumes both amino acids AND ATP. Produces building materials. Critical for infrastructure expansion.",
      "cost": { "RES_GLUCOSE": 75, "RES_AMINO_ACID": 20 },
      "consumption": { "RES_AMINO_ACID": 1, "RES_ATP": 0.5 },
      "production": { "ITEM_BIO_MESH": 1 },
      "processes": [
        { "id": "PRC_PROTEIN_BUILD", "input": ["RES_AMINO_ACID", "RES_ATP"], "output": "ITEM_BIO_MESH", "rate": 1 }
      ],
      "unlock_condition": { "type": "ITEM_COLLECTED", "target": "RES_AMINO_ACID", "val": 10 }
    },
    {
      "id": "BLD_PERICYTE_EXTRACTOR",
      "name": "Pericyte Extractor",
      "icon": "⛏",
      "description": "Harvests glucose and oxygen from capillary tissue. Your primary resource generator.",
      "tips": "Place on or adjacent to capillaries for maximum yield. Requires healthy tissue to extract effectively.",
      "cost": { "RES_GLUCOSE": 40 },
      "size": [2, 2],
      "placement": "ON_CAPILLARY",
      "production": { "RES_GLUCOSE": 0.5, "RES_OXYGEN": 0.05 },
      "extraction_rate": { "RES_GLUCOSE": 0.5, "RES_OXYGEN": 0.05 },
      "unlock_condition": { "type": "START_DEFAULT" }
    },
    {
      "id": "BLD_ATP_SYNTHESIZER",
      "name": "ATP Synthesizer (Mitochondria)",
      "icon": "🔋",
      "description": "Converts glucose and oxygen into ATP energy. The cellular power plant.",
      "tips": "More oxygen = more ATP. Critical for supporting complex operations. Place near oxygen sources.",
      "cost": { "RES_GLUCOSE": 60, "RES_AMINO_ACID": 15 },
      "consumption": { "RES_GLUCOSE": 2, "RES_OXYGEN": 1 },
      "production": { "RES_ATP": 5 },
      "unlock_condition": { "type": "START_DEFAULT" }
    },
    {
      "id": "BLD_STORAGE_DEPOT",
      "name": "Resource Storage",
      "icon": "📦",
      "description": "Stores up to 500 units of resources. Buffer against supply interruptions.",
      "tips": "Build multiple depots to increase total storage. Prevents resource loss when production exceeds extraction.",
      "cost": { "RES_GLUCOSE": 35 },
      "storage_capacity": 500,
      "unlock_condition": { "type": "START_DEFAULT" }
    }
  ],

  // ============================================================
  // 4. UNITS (Паттерны и XP)
  // ============================================================
  "units": [
    {
      "id": "UNIT_STEM_CELL",
      "name": "Pluripotent Worker",
      "icon": "🟢",
      "description": "Versatile cellular unit. Can differentiate into specialized workers or build structures.",
      "tips": "Produce from Nucleus. Send to depot zones to build new buildings. Can specialize via biotechnology.",
      "abilities": ["MITOSIS_BUILD", "SCAVENGE"],
      "cargo": 50,
      "unlock_condition": { "type": "START_DEFAULT" }
    },
    {
      "id": "UNIT_CATABOLIC_CELL",
      "name": "Catabolic Specialist",
      "icon": "🟠",
      "description": "Specialized worker for breaking down debris. Works in Catabolic Disassembler units.",
      "tips": "Produced from Stem Cell specialization. Increases debris processing rate. Automatically seeks waste.",
      "abilities": ["LYSIS", "DEBRIS_SENSE"],
      "cargo": 30,
      "xp_reward": 5,
      "unlock_condition": { "type": "ITEM_COLLECTED", "target": "RES_AMINO_ACID", "val": 5 }
    },
    {
      "id": "UNIT_ANABOLIC_CELL",
      "name": "Anabolic Specialist",
      "icon": "🟡",
      "description": "Expert builder cell. Synthesizes structures and complex components efficiently.",
      "tips": "Produced from Stem Cell specialization. Reduces build time and cost. Works best in groups.",
      "abilities": ["PROTEIN_SYNTHESIS", "CONSTRUCT"],
      "cargo": 40,
      "xp_reward": 5,
      "unlock_condition": { "type": "ITEM_COLLECTED", "target": "ITEM_BIO_MESH", "val": 1 }
    },
    {
      "id": "UNIT_NEUTROPHIL_NAIVE",
      "name": "Naive Neutrophil",
      "icon": "⚪",
      "description": "Immune cell for defending against pathogens. Performs ROS (reactive oxygen) attacks.",
      "tips": "Deploy near infection zones. Weak individually but strong in groups. Regenerates slowly when idle.",
      "patterns": ["PATROL", "ROS_ATTACK"],
      "attack": { "type": "ROS_SPRAY", "dmg": 5, "range": 3 },
      "health": 20,
      "xp_reward": 0,
      "unlock_condition": { "type": "START_DEFAULT" }
    }
  ],

  // ============================================================
  // 5. TERRAIN (Биомы тела человека)
  // ============================================================
  "terrain": [
    {
      "id": "TER_CAPILLARY_ZONE",
      "name": "Capillary Zone",
      "icon": "🩸",
      "description": "Rich in oxygen and nutrients. Ideal for extraction buildings.",
      "tips": "Place Extractors here. Highest resource yield. Avoid building dense infrastructure.",
      "properties": { "glucose_density": 1.0, "oxygen_density": 1.0, "pathogen_resistance": 0.8 },
      "unlock_condition": { "type": "START_DEFAULT" }
    },
    {
      "id": "TER_MUSCULAR_TISSUE",
      "name": "Muscle Tissue",
      "icon": "💪",
      "description": "Dense, structured area. Good for construction. Dense structures here are stronger.",
      "tips": "Place buildings here for 1.2x durability bonus. Lower resource yield than capillaries.",
      "properties": { "glucose_density": 0.7, "build_strength": 1.2, "pathogen_resistance": 0.6 },
      "unlock_condition": { "type": "START_DEFAULT" }
    },
    {
      "id": "TER_FATTY_TISSUE",
      "name": "Adipose (Fat) Tissue",
      "icon": "🟫",
      "description": "Energy-rich storage tissue. Used for long-term resource banking.",
      "tips": "Natural storage zone. Place depots here. Slow resource regeneration over time.",
      "properties": { "storage_bonus": 1.3, "glucose_density": 0.4, "pathogen_resistance": 0.4 },
      "unlock_condition": { "type": "START_DEFAULT" }
    },
    {
      "id": "TER_LYMPH_NODE_ZONE",
      "name": "Lymph Node Zone",
      "icon": "🫘",
      "description": "Immune-rich tissue. Provides natural pathogen protection and healing.",
      "tips": "Builds here get immunity boost. Pathogens spread slower. Strategic defensive location.",
      "properties": { "pathogen_resistance": 1.5, "immune_regen": 1.2, "glucose_density": 0.5 },
      "unlock_condition": { "type": "ITEM_COLLECTED", "target": "UNIT_NEUTROPHIL_NAIVE", "val": 1 }
    },
    {
      "id": "TER_CALCIUM_DEPOSIT",
      "name": "Calcified Zone",
      "icon": "⚪",
      "description": "Mineral-rich area. Source of calcium ions for signaling pathways.",
      "tips": "Mine for calcium with special extractors. Low glucose but unique mineral resources.",
      "properties": { "glucose_density": 0.2, "calcium_density": 1.0, "mining_difficulty": 2.0 },
      "unlock_condition": { "type": "START_DEFAULT" }
    }
  ],

  // ============================================================
  // 6. TECHNOLOGIES (Upgrades and unlocks)
  // ============================================================
  "technologies": [
    {
      "id": "TECH_AEROBIC_RESPIRATION",
      "name": "Aerobic Respiration",
      "icon": "🫁",
      "description": "Unlock enhanced ATP synthesis from glucose + oxygen combination.",
      "tips": "Unlocks ATP Synthesizer building. Drastically increases energy production.",
      "cost": { "RES_GLUCOSE": 500, "RES_AMINO_ACID": 100 },
      "unlocks": ["BLD_ATP_SYNTHESIZER"],
      "unlock_condition": { "type": "RESEARCH_TIME", "duration": 120 }
    },
    {
      "id": "TECH_STEM_CELL_SPEC",
      "name": "Cell Specialization",
      "icon": "🧬",
      "description": "Train stem cells to become specialized workers.",
      "tips": "Allows producing Catabolic and Anabolic specialists from stem cells.",
      "cost": { "RES_GLUCOSE": 300, "RES_AMINO_ACID": 150 },
      "unlocks": ["UNIT_CATABOLIC_CELL", "UNIT_ANABOLIC_CELL"],
      "unlock_condition": { "type": "RESEARCH_TIME", "duration": 180 }
    },
    {
      "id": "TECH_IMMUNE_BOOST",
      "name": "Immune Enhancement",
      "icon": "🛡",
      "description": "Boost Neutrophil attack power and regeneration.",
      "tips": "Increases damage and healing rates of immune cells. Critical for pathogen defense.",
      "cost": { "RES_GLUCOSE": 400, "RES_ATP": 50 },
      "effect": { "immune_damage": 1.5, "immune_regen": 1.3 },
      "unlock_condition": { "type": "RESEARCH_TIME", "duration": 240 }
    }
  ],

  // ============================================================
  // 7. DISEASES (Тир 0 - Кишечник)
  // ============================================================
  "diseases": [
    {
      "id": "DIS_ECOLI_SWARM",
      "name": "E. Coli Infection",
      "icon": "🦠",
      "description": "Bacterial swarm attempting to colonize intestinal tissue.",
      "tips": "Spawn from damaged intestinal areas. Use ROS attacks or antibiotics to eliminate. Early threat.",
      "biome": "SMALL_INTESTINE",
      "tier": 0,
      "type": "COMBAT",
      "enemy_unit": "UNIT_ECOLI_WILD",
      "xp_reward": 10,
      "treatment": { "drug": "ROS_SPRAY", "efficacy": 1.0 },
      "unlock_condition": { "type": "TIME_ELAPSED", "duration": 300 }
    },
    {
      "id": "DIS_MALABSORPTION",
      "name": "Malabsorption Syndrome",
      "icon": "🤢",
      "description": "Condition reducing nutrient absorption. Spreads across intestinal tissue over time.",
      "tips": "Reduce with Immune Boost tech. Can be prevented by maintaining villi health.",
      "biome": "SMALL_INTESTINE",
      "tier": 0,
      "type": "TERRAIN_EFFECT",
      "mechanics": { "SYS_GLUCOSE_YIELD": -0.2, "spread_chance": 0.01 },
      "unlock_condition": { "type": "TIME_ELAPSED", "duration": 600 }
    },
    {
      "id": "DIS_INFLAMMATION",
      "name": "Systemic Inflammation",
      "icon": "🔥",
      "description": "Widespread inflammatory response triggered by pathogen presence.",
      "tips": "Reduces ATP production globally. Manage with anti-inflammatory treatments. Prevent by eliminating threats early.",
      "tier": 1,
      "type": "SYSTEMIC",
      "mechanics": { "SYS_ATP_EFFICIENCY": -0.3, "spread_chance": 0.05 },
      "unlock_condition": { "type": "TIME_ELAPSED", "duration": 1200 }
    }
  ]
};

// ============================================================
// DATABASE EXPORT
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BioDatabase;
}

export default BioDatabase;
