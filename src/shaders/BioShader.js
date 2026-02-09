import * as THREE from 'three';

const vertexShader = `
varying vec3 vNormal;
varying vec3 vWorldPos;
uniform float uTime;

void main() {
    // Normal in view space for stable rim calculation
    vNormal = normalize(normalMatrix * normal);
    
    // Breathing effect with time
    vec3 breathedPosition = position * (0.97 + 0.03 * sin(uTime * 2.0));
    vec4 worldPos = modelMatrix * vec4(breathedPosition, 1.0);
    vWorldPos = worldPos.xyz;
    
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const fragmentShader = `
uniform vec3 baseColor;
uniform float uTime;
uniform vec3 uKeyLightDir;  // Key light direction (normalized)
varying vec3 vNormal;
varying vec3 vWorldPos;

// Dithering to hide banding on toon steps (Bayer 4x4)
float dither(vec2 p) {
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int idx = x + y * 4;
    float m[16];
    m[0]=0.0;  m[1]=8.0;  m[2]=2.0;  m[3]=10.0;
    m[4]=12.0; m[5]=4.0;  m[6]=14.0; m[7]=6.0;
    m[8]=3.0;  m[9]=11.0; m[10]=1.0; m[11]=9.0;
    m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
    return (m[idx] / 16.0 - 0.5) * 0.012;  // Subtle noise
}

// Toon shading with dithered steps
vec3 toonSteps(vec3 col, float nDotL) {
    float i = nDotL;
    i += dither(gl_FragCoord.xy);
    
    if (i > 0.85) return col;
    else if (i > 0.6) return col * 0.82;
    else if (i > 0.35) return col * 0.62;
    else return col * 0.40;
}

void main() {
    vec3 N = normalize(vNormal);
    
    // 1) Key-light toon shading (warm directional light)
    float nDotL = max(dot(N, normalize(uKeyLightDir)), 0.0);
    vec3 toon = toonSteps(baseColor, nDotL);
    
    // 2) View-dependent rim (stable camera-relative contour)
    vec3 V = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 1.2);
    float pulse = 0.15 + 0.10 * sin(uTime * 2.6);
    // Warm to cool rim color gradient
    vec3 rimCol = mix(vec3(1.0, 0.94, 0.88), vec3(0.9, 0.97, 1.0), 0.35);
    toon += rim * pulse * rimCol;
    
    // 3) Warm biological glow (subtle, time-modulated)
    float glow = 0.04 * sin(uTime * 2.0 + length(vWorldPos) * 0.5);
    toon += vec3(glow * 0.35, glow * 0.22, glow * 0.18);
    
    gl_FragColor = vec4(toon, 1.0);
}
`;

class BioShader extends THREE.ShaderMaterial {
    constructor(isGrid = false, keyLightDir = new THREE.Vector3(1, 2, 1).normalize()) {
        super({
            uniforms: {
                baseColor: { value: isGrid ? new THREE.Color(0x330505) : new THREE.Color(0x2a0505) },
                uTime: { value: 0 },
                uKeyLightDir: { value: new THREE.Vector3(keyLightDir.x, keyLightDir.y, keyLightDir.z) }
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
    
    setKeyLightDir(dir) {
        this.uniforms.uKeyLightDir.value.copy(dir);
    }
}

export default BioShader;
