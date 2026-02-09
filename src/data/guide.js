/**
 * Guide data - Information about all game elements
 * Format: By type (building, resource, entity), with expandable descriptions and statistics
 */
const GAME_GUIDE = {
    resources: [
        {
            id: 'glucose',
            name: 'Glucose',
            icon: '🍯',
            type: 'resource',
            description: 'Primary energy source for cellular processes. Extracted from endothelial cells and used by all factories.',
            unit: 'mg/dL',
            normal_range: '70-100',
            sources: ['Extractor', 'Capillary Bed'],
            uses: ['Mitochondria', 'Cytosol', 'All factories'],
            tips: 'Glucose is critical - maintain steady production to avoid shutdowns.'
        },
        {
            id: 'oxygen',
            name: 'Oxygen',
            icon: '💨',
            type: 'resource',
            description: 'Essential for aerobic respiration. Diffuses from capillaries.',
            unit: '%',
            normal_range: '90-100',
            sources: ['Capillary Bed', 'Alveoli'],
            uses: ['Mitochondria', 'Respiration'],
            tips: 'Oxygen levels directly affect ATP production efficiency.'
        },
        {
            id: 'atp',
            name: 'ATP',
            icon: '⚡',
            type: 'resource',
            description: 'Energy currency of the cell. Produced by mitochondria through cellular respiration.',
            unit: 'μmol',
            normal_range: '2.5-4.0',
            sources: ['Mitochondria'],
            uses: ['All cellular processes'],
            tips: 'ATP production is the core of your factory system.'
        }
    ],
    buildings: [
        {
            id: 'extractor',
            name: 'Glucose Extractor',
            icon: '⛏️',
            type: 'building',
            description: 'Harvests glucose from endothelial cells. Basic building for resource gathering.',
            cost: { glucose: 0, oxygen: 0 },
            production: { glucose: 5 },
            consumption: { atp: 1 },
            buildTime: 5,
            size: '1x1',
            tips: 'Place on Endothelium terrain. Higher density = higher production.',
            stats: {
                efficiency: '85%',
                durability: 'High',
                yield: '5 glucose/cycle'
            }
        },
        {
            id: 'vessel',
            name: 'Vessel Transit',
            icon: '🚢',
            type: 'building',
            description: 'Transports resources between buildings via internal vascular system.',
            cost: { glucose: 50 },
            production: {},
            consumption: { atp: 2 },
            buildTime: 10,
            size: '2x2',
            tips: 'Required to connect distant buildings. Higher throughput = faster transport.',
            stats: {
                throughput: '10 units/sec',
                range: '5 cells',
                efficiency: '90%'
            }
        },
        {
            id: 'mitochondria',
            name: 'Mitochondria Factory',
            icon: '🔄',
            type: 'building',
            description: 'Produces ATP through aerobic respiration. Converts glucose + oxygen into usable energy.',
            cost: { glucose: 100, oxygen: 50 },
            production: { atp: 15 },
            consumption: { glucose: 5, oxygen: 3 },
            buildTime: 15,
            size: '2x2',
            tips: 'Most important building - prioritize production here.',
            stats: {
                efficiency: '92%',
                yield: '3 ATP per glucose',
                rampTime: '3 cycles'
            }
        }
    ],
    entities: [
        {
            id: 'white_blood_cell',
            name: 'White Blood Cell',
            icon: '⚪',
            type: 'entity',
            description: 'Immune defender. Patrols your territory and removes threats.',
            behavior: 'Auto-patrol',
            health: 25,
            speed: 'Medium',
            threats: ['Pathogens', 'Infected Cells'],
            tips: 'Deploy near vulnerable factories for protection.'
        }
    ],
    terrain: [
        {
            id: 'endothelium',
            name: 'Endothelium',
            icon: '🟢',
            type: 'terrain',
            description: 'Healthy cellular tissue. Excellent for building and resource extraction.',
            buildable: true,
            harvest: 'Glucose',
            efficiency: 'High',
            tips: 'Best terrain for economic buildings.'
        },
        {
            id: 'calcified',
            name: 'Calcified Tissue',
            icon: '🔴',
            type: 'terrain',
            description: 'Damaged or hardened tissue. Problematic for resources.',
            buildable: false,
            harvest: 'None',
            efficiency: 'Low',
            tips: 'Avoid if possible. Can be treated with special factories.'
        },
        {
            id: 'capillary',
            name: 'Capillary Bed',
            icon: '🟡',
            type: 'terrain',
            description: 'Blood vessel junction. Source of oxygen diffusion.',
            buildable: false,
            harvest: 'Oxygen',
            efficiency: 'Medium',
            tips: 'Position oxygen-producers nearby to maximize efficiency.'
        }
    ]
};

export default GAME_GUIDE;
