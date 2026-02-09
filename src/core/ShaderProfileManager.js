import * as THREE from 'three';

/**
 * ShaderProfileManager: Defines and manages material profiles for buildings
 * Allows switching between different visual styles at runtime
 */
class ShaderProfileManager {
    constructor() {
        this.currentProfile = 'HIGH';
        this.profiles = this.initializeProfiles();
    }

    /**
     * Initialize all available shader profiles
     * Quality tiers for wet flesh appearance: High, Medium, Low
     * Based on balanced "wow-effect / FPS" strategy using MeshPhysicalMaterial + Bloom
     */
    initializeProfiles() {
        return {
            // 1. HIGH QUALITY (Recommended default - "wow/FPS" balance)
            // PBR with enhanced material properties for wet flesh
            HIGH: {
                name: 'High (Recommended)',
                description: 'Best visual quality - Enhanced PBR with wet appearance. Balanced performance for desktop/high-end devices.',
                bloomConfig: {
                    enable: true,
                    strength: 0.4,
                    radius: 0.9,
                    threshold: 0.82
                },
                getMaterial: () => new THREE.MeshStandardMaterial({
                    color: 0x8a0d0d,             // blood/tissue red
                    roughness: 0.35,
                    metalness: 0.0,
                    emissive: 0x441111,          // Dark red glow
                    emissiveIntensity: 0.3,
                    side: THREE.DoubleSide
                })
            },

            // 2. MEDIUM QUALITY (Mobile / Large scenes)
            // Reduced properties for balance
            MEDIUM: {
                name: 'Medium (Balanced)',
                description: 'Balanced quality - suitable for mobile devices and scenes with many objects.',
                bloomConfig: {
                    enable: true,
                    strength: 0.3,
                    radius: 0.7,
                    threshold: 0.85
                },
                getMaterial: () => new THREE.MeshStandardMaterial({
                    color: 0x8a0d0d,             // blood/tissue red
                    roughness: 0.5,
                    metalness: 0.0,
                    emissive: 0x330000,          // Dimmer red glow
                    emissiveIntensity: 0.2,
                    side: THREE.DoubleSide
                })
            },

            // 3. LOW QUALITY (Economy mode)
            // Minimal properties for maximum performance
            LOW: {
                name: 'Low (Performance)',
                description: 'Maximum performance - simplified material for low-end devices or very large scenes.',
                bloomConfig: {
                    enable: false
                },
                getMaterial: () => new THREE.MeshStandardMaterial({
                    color: 0x8a0d0d,             // blood/tissue red
                    roughness: 0.7,
                    metalness: 0.0,
                    emissiveIntensity: 0.0,
                    side: THREE.DoubleSide
                })
            }
        };
    }

    /**
     * Get list of all available profiles
     */
    getProfileList() {
        return Object.entries(this.profiles).map(([key, profile]) => ({
            id: key,
            name: profile.name,
            description: profile.description
        }));
    }

    /**
     * Get the profile object
     */
    getProfile(profileId = this.currentProfile) {
        return this.profiles[profileId] || this.profiles['HIGH'];
    }

    /**
     * Set active shader profile
     */
    setProfile(profileId) {
        if (this.profiles[profileId]) {
            this.currentProfile = profileId;
            console.log(`[ShaderProfileManager] Switched to profile: ${profileId}`);
            return true;
        }
        console.warn(`[ShaderProfileManager] Profile not found: ${profileId}`);
        return false;
    }

    /**
     * Create material for a building using current profile
     */
    createMaterial() {
        const profile = this.getProfile();
        return profile.getMaterial();
    }

    /**
     * Get current profile name
     */
    getCurrentProfileName() {
        return this.getProfile().name;
    }

    /**
     * Get current profile id
     */
    getCurrentProfileId() {
        return this.currentProfile;
    }
}

// Singleton instance
const shaderProfileManager = new ShaderProfileManager();

export default shaderProfileManager;
