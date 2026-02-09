/**
 * Color Constants - Centralized color palette for the entire game
 * All colors stored as hex values for consistency
 */

export const COLORS = {
    // Ground and terrain
    GROUND_PRIMARY: 0xFF6666,         // More red - primary ground color
    GROUND_EMIT: 0xFF5555,             // More red - emissive glow for ground
    GROUND_TEXTURE_BASE: '#EE5544',    // Red - procedural texture base
    
    // Grid and UI
    GRID_LINES: 0x00FFFF,              // Cyan - main grid lines
    
    // Building placement feedback
    PLACEMENT_VALID: 0x00FF88,         // Green - valid placement zone
    PLACEMENT_INVALID: 0xFF6666,       // Red - invalid placement zone
    
    // Building states
    STRUCTURE_HEALTHY: 0x4CAF50,       // Green - healthy structure
    STRUCTURE_BROKEN: 0xFF6B6B,        // Red - broken/damaged structure
    
    // Specific buildings
    EXTRACTOR_COLOR: 0xDD4444,         // Flesh red - pericyte extractor
    NUCLEUS_GLOW: 0xFF00FF,            // Magenta - nucleus glow (for potential future use)
    
    // UI and feedback
    OUTLINE_BLACK: 0x000000,           // Black - outline effect
    TEXT_PRIMARY: 0xE0E0E0,            // Light gray - primary text
    TEXT_ACCENT: 0x00D4FF,             // Cyan - accent text
};

export default COLORS;
