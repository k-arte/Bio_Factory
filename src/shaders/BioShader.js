import * as THREE from 'three';

const vertexShader = `
uniform float uTime;
uniform float uPulseAmp;       // базовая амплитуда (0.00..0.03)
uniform float uPulseSpeed;     // скорость дыхания (0.4..1.2)
uniform float uPulsePhase;     // случайный оффсет
uniform float uBottomStick;    // зона адгезии внизу (0.0..0.4)
uniform float uTopBoost;       // откуда усилить движение верхушки (0.6..1.1)
uniform float uRoundness;      // округление по нормали (0.0..1.0)
uniform float uLateralAmp;     // боковое дыхание в XZ (0.0..0.02)
uniform float uRadialStiffness;// жёсткость для труб (0.0..1.0)

varying vec3 vNormal;
varying vec3 vWorldPos;

float heartBeat(float t) {
    float s = fract(t);
    return pow(s, 6.0) * exp(-3.0 * s);
}

void main() {
    vec3 pos = position;
    vec3 nrm = normal;
    
    // Нормируем высоту меша 0..1 (предполагаем центр в (0,0,0), диапазон [-0.5 .. +0.5])
    float halfH = 0.5;
    float h = clamp((pos.y + halfH) / (2.0 * halfH), 0.0, 1.0);
    
    // Маска адгезии низа: нижняя часть НЕ двигается
    float stickMask = smoothstep(uBottomStick - 0.05, uBottomStick + 0.05, h);
    
    // Маска верхушки: усиливаем движение выше uTopBoost
    float topMask = smoothstep(uTopBoost - 0.1, uTopBoost + 0.1, h);
    
    // Пульс (short systole, long diastole)
    float t = uTime * uPulseSpeed + uPulsePhase;
    float beat = heartBeat(t);
    beat = smoothstep(0.0, 0.4, beat);
    
    // Микро-органический шум (лёгкая рябь, но не синусида)
    float micro = sin(dot(pos.xz, vec2(6.3, 4.7)) + uTime * 3.6) * 0.12;
    
    // Пульсирующая амплитуда вверх (Y-смещение)
    // Низ не двигается (stickMask=0), верх двигается (stickMask=1)
    // Усиливаем вверху (topMask)
    float pulseUp = (beat + micro * 0.2) * uPulseAmp * stickMask * (0.5 + 0.5 * topMask);
    
    // Боковое размыкание (чтобы компенсировать растяжение вверх)
    // Жёсткость уменьшает латеральную деформацию
    float stiffK = 1.0 - clamp(uRadialStiffness, 0.0, 1.0);
    float lateral = uLateralAmp * (0.3 + 0.7 * topMask) * stickMask * stiffK;
    
    // Squash-and-stretch: вверх + округление по нормали
    pos.y += pulseUp;
    
    // Округляем верх по нормали (эластичность)
    float roundK = uRoundness * stiffK;
    pos += nrm * (pulseUp * roundK);
    
    // Латеральное «вдыхание» в плоскости XZ (не трецон, а радиально)
    float r = length(pos.xz);
    if (r > 0.0001) {
        vec2 dir = pos.xz / r;
        pos.xz += dir * lateral;
    }
    
    // Выход
    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorldPos = world.xyz;
    vNormal = normalize(normalMatrix * nrm);
    gl_Position = projectionMatrix * viewMatrix * world;
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
                uKeyLightDir: { value: new THREE.Vector3(keyLightDir.x, keyLightDir.y, keyLightDir.z) },
                uPulseAmp: { value: 0.0 },
                uPulseSpeed: { value: 0.85 },
                uPulsePhase: { value: 0.0 },
                uBottomStick: { value: 0.18 },
                uTopBoost: { value: 0.65 },
                uRoundness: { value: 0.8 },
                uLateralAmp: { value: 0.006 },
                uRadialStiffness: { value: 0.0 }
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
    
    // Legacy: для обратной совместимости
    setPulse(amp = 0.015, speed = 0.85, phase = 0) {
        this.uniforms.uPulseAmp.value = amp;
        this.uniforms.uPulseSpeed.value = speed;
        this.uniforms.uPulsePhase.value = phase;
    }
    
    // Новый универсальный метод: настройка профиля Squash-and-Stretch
    setAnimationProfile(opts = {}) {
        const defaults = {
            pulseAmp: 0.015,
            pulseSpeed: 0.85,
            pulsePhase: Math.random() * Math.PI * 2,
            bottomStick: 0.18,
            topBoost: 0.65,
            roundness: 0.8,
            lateralAmp: 0.006,
            radialStiffness: 0.0
        };
        const cfg = { ...defaults, ...opts };
        this.uniforms.uPulseAmp.value = cfg.pulseAmp;
        this.uniforms.uPulseSpeed.value = cfg.pulseSpeed;
        this.uniforms.uPulsePhase.value = cfg.pulsePhase;
        this.uniforms.uBottomStick.value = cfg.bottomStick;
        this.uniforms.uTopBoost.value = cfg.topBoost;
        this.uniforms.uRoundness.value = cfg.roundness;
        this.uniforms.uLateralAmp.value = cfg.lateralAmp;
        this.uniforms.uRadialStiffness.value = cfg.radialStiffness;
    }
}

export default BioShader;
