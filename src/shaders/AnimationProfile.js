/**
 * AnimationProfile.js - Universal Squash-and-Stretch animation profiles
 * 
 * Применяет настройки "дыхания" для любых объектов:
 * - Клетки (мягкие): полная пульсация, низкая жёсткость
 * - Здания (умеренно): среднее дыхание, некоторая жёсткость
 * - Трубы (жёсткие): минимальная пульсация, высокая жёсткость каркаса
 */

/**
 * Применить профиль анимации к материалу BioShader
 * @param {THREE.ShaderMaterial} material - BioShader материал
 * @param {string} preset - 'cell' | 'building' | 'pipe'
 * @param {Object} overrides - дополнительные параметры для переопределения
 */
export function applyAnimationProfile(material, preset = 'cell', overrides = {}) {
    if (!material.uniforms) {
        console.warn('[AnimationProfile] Material has no uniforms');
        return;
    }

    // Дефолтные значения для каждого типа
    const profiles = {
        cell: {
            pulseAmp: 0.015,
            pulseSpeed: 0.85,
            pulsePhase: Math.random() * Math.PI * 2,
            bottomStick: 0.18,
            topBoost: 0.65,
            roundness: 0.8,
            lateralAmp: 0.008,
            radialStiffness: 0.0
        },
        building: {
            pulseAmp: 0.008,
            pulseSpeed: 0.75,
            pulsePhase: Math.random() * Math.PI * 2,
            bottomStick: 0.18,
            topBoost: 0.70,
            roundness: 0.5,
            lateralAmp: 0.0045,
            radialStiffness: 0.3
        },
        pipe: {
            pulseAmp: 0.0045,
            pulseSpeed: 0.65,
            pulsePhase: Math.random() * Math.PI * 2,
            bottomStick: 0.12,
            topBoost: 0.75,
            roundness: 0.35,
            lateralAmp: 0.0032,
            radialStiffness: 0.7
        }
    };

    const config = { ...profiles[preset] || profiles.cell, ...overrides };

    // Убедимся, что все uniforms существуют
    const uniforms = material.uniforms;
    if (!uniforms.uTime) uniforms.uTime = { value: 0 };
    if (!uniforms.uPulseAmp) uniforms.uPulseAmp = { value: config.pulseAmp };
    if (!uniforms.uPulseSpeed) uniforms.uPulseSpeed = { value: config.pulseSpeed };
    if (!uniforms.uPulsePhase) uniforms.uPulsePhase = { value: config.pulsePhase };
    if (!uniforms.uBottomStick) uniforms.uBottomStick = { value: config.bottomStick };
    if (!uniforms.uTopBoost) uniforms.uTopBoost = { value: config.topBoost };
    if (!uniforms.uRoundness) uniforms.uRoundness = { value: config.roundness };
    if (!uniforms.uLateralAmp) uniforms.uLateralAmp = { value: config.lateralAmp };
    if (!uniforms.uRadialStiffness) uniforms.uRadialStiffness = { value: config.radialStiffness };

    // Применяем значения
    uniforms.uPulseAmp.value = config.pulseAmp;
    uniforms.uPulseSpeed.value = config.pulseSpeed;
    uniforms.uPulsePhase.value = config.pulsePhase;
    uniforms.uBottomStick.value = config.bottomStick;
    uniforms.uTopBoost.value = config.topBoost;
    uniforms.uRoundness.value = config.roundness;
    uniforms.uLateralAmp.value = config.lateralAmp;
    uniforms.uRadialStiffness.value = config.radialStiffness;
}

/**
 * Установить амплитуду целевого объекта (для LOD/дальней камеры)
 * @param {THREE.ShaderMaterial} material 
 * @param {number} amplitude - новая амплитуда (0.0 - заморозить анимацию)
 */
export function setAnimationAmplitude(material, amplitude) {
    if (material.uniforms && material.uniforms.uPulseAmp) {
        material.uniforms.uPulseAmp.value = Math.max(0, Math.min(0.03, amplitude));
    }
}

/**
 * Адаптивно гасить амплитуду от расстояния (для оптимизации на сценах с множеством объектов)
 * @param {THREE.ShaderMaterial} material
 * @param {THREE.Vector3} objectPos
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} baseAmp - базовая амплитуда
 * @param {number} nearDist - расстояние, на котором амплитуда = baseAmp
 * @param {number} farDist - расстояние, на котором амплитуда = 0
 */
export function setDistanceBasedAmplitude(material, objectPos, camera, baseAmp, nearDist = 10, farDist = 80) {
    const dist = camera.position.distanceTo(objectPos);
    const mappedAmp = THREE.MathUtils.mapLinear(dist, nearDist, farDist, baseAmp, 0.0);
    setAnimationAmplitude(material, mappedAmp);
}

export default {
    applyAnimationProfile,
    setAnimationAmplitude,
    setDistanceBasedAmplitude
};
