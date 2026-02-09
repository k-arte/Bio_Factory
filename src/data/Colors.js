/**
 * Color Constants - Centralized color palette for the entire game
 * All colors stored as hex values for consistency
 * Optimized for ACES tone mapping and toon shading aesthetics
 */

export const COLORS = {
    // Ground and terrain - muted for better depth and less clipping
    GROUND_PRIMARY: 0xE05353,          // Reduced from 0xFF6666 - more refined
    GROUND_EMIT: 0xC84A4A,             // Reduced from 0xFF5555 - less "neon"
    GROUND_TEXTURE_BASE: '#D74B3E',    // Reduced from '#EE5544' - warmer, less bright
    
    // Grid and UI - less aggressive cyan
    GRID_LINES: 0x00D2EE,              // Reduced from 0x00FFFF - less "neon" feel
    
    // Building placement feedback
    PLACEMENT_VALID: 0x00E676,         // Green - valid placement zone
    PLACEMENT_INVALID: 0xE05353,       // Red - invalid placement zone (matches ground)
    
    // Building states
    STRUCTURE_HEALTHY: 0x4CAF50,       // Green - healthy structure
    STRUCTURE_BROKEN: 0xFF6B6B,        // Red - broken/damaged structure
    
    // Specific buildings
    EXTRACTOR_COLOR: 0xC83E3E,         // Reduced from 0xDD4444 - more subdued flesh tone
    NUCLEUS_GLOW: 0xFF00FF,            // Magenta - nucleus glow (for potential future use)
    
    // UI and feedback - slightly enhanced text contrast
    OUTLINE_BLACK: 0x000000,           // Black - outline effect
    TEXT_PRIMARY: 0xE6E6E6,            // Slightly brighter from 0xE0E0E0
    TEXT_ACCENT: 0x00C4E8,             // Reduced from 0x00D4FF - less aggressive
};

export default COLORS;
