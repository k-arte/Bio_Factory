import * as THREE from 'three';

const vertexShader = `
varying vec3 vNormal;
varying vec3 vPosition;
uniform float uTime;

void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    
    // Breathing effect with time
    vec3 breathedPosition = position * (0.95 + 0.05 * sin(uTime * 2.0));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(breathedPosition, 1.0);
}
`;

const fragmentShader = `
uniform vec3 baseColor;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vPosition;

vec3 toonShading(vec3 color, float intensity) {
    if (intensity > 0.95) return color;
    else if (intensity > 0.7) return color * 0.8;
    else if (intensity > 0.4) return color * 0.6;
    else return color * 0.3;
}

void main() {
    vec3 normal = normalize(vNormal);
    float intensity = dot(normal, vec3(0.0, 1.0, 0.0));
    vec3 toonColor = toonShading(baseColor, intensity);

    // Rim lighting with warm gold/white pulse (biological glow)
    float rim = 1.0 - max(dot(normal, vec3(0.0, 0.0, -1.0)), 0.0);
    rim = smoothstep(0.5, 1.0, rim);
    float pulseIntensity = 0.3 + 0.2 * sin(uTime * 3.0);
    vec3 rimColor = vec3(1.0, 0.9, 0.8) * pulseIntensity; // Warm white/gold
    toonColor += rim * rimColor;

    // Glow effect synchronized with time (warm tone)
    float glow = 0.1 * sin(uTime * 2.5 + length(vPosition));
    toonColor += vec3(glow * 0.3, glow * 0.2, glow * 0.1); // Warm red glow

    gl_FragColor = vec4(toonColor, 1.0);
}
`;

class BioShader extends THREE.ShaderMaterial {
    constructor(isGrid = false) {
        super({
            uniforms: {
                // Deep vein red for grid, dark maroon for objects
                baseColor: { value: isGrid ? new THREE.Color(0x330505) : new THREE.Color(0x2a0505) },
                uTime: { value: 0 }
            },
            vertexShader,
            fragmentShader,
            transparent: isGrid,
            opacity: isGrid ? 0.6 : 1.0
        });
    }

    updateTime(time) {
        this.uniforms.uTime.value = time;
    }
}

export default BioShader;
