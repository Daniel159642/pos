/**
 * Play notification sounds (Web Audio). Used for new order toast and tests.
 * @param {{ sound_type?: string, volume?: number }} options - sound_type: 'default' | 'chime' | 'alert' | 'soft', volume: 0-1
 */
export async function playNewOrderSound(options = {}) {
  const soundType = options.sound_type || 'default'
  const volume = Math.max(0, Math.min(1, Number(options.volume) ?? 0.5))
  if (soundType === 'none' || soundType === 'off') return

  try {
    const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
    if (!Ctx) return
    const ctx = new Ctx()
    if (ctx.state === 'suspended') await ctx.resume()

    const gainNode = ctx.createGain()
    gainNode.connect(ctx.destination)
    const baseGain = 0.2 * volume

    if (soundType === 'chime') {
      playChime(ctx, gainNode, baseGain)
    } else if (soundType === 'alert') {
      playAlert(ctx, gainNode, baseGain)
    } else if (soundType === 'soft') {
      playSoft(ctx, gainNode, baseGain)
    } else if (soundType === 'double_beep') {
      playDoubleBeep(ctx, gainNode, baseGain)
    } else if (soundType === 'high_ping') {
      playHighPing(ctx, gainNode, baseGain)
    } else if (soundType === 'bell') {
      playBell(ctx, gainNode, baseGain)
    } else if (soundType === 'ding') {
      playDing(ctx, gainNode, baseGain)
    } else if (soundType === 'urgent') {
      playUrgent(ctx, gainNode, baseGain)
    } else {
      playDefault(ctx, gainNode, baseGain)
    }
  } catch (_) {}
}

function playDefault(ctx, gainNode, baseGain) {
  const osc = ctx.createOscillator()
  osc.connect(gainNode)
  osc.frequency.value = 800
  osc.type = 'sine'
  gainNode.gain.setValueAtTime(baseGain, ctx.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.2)
}

function playChime(ctx, gainNode, baseGain) {
  const t0 = ctx.currentTime
  gainNode.gain.setValueAtTime(0, t0)
  gainNode.gain.linearRampToValueAtTime(baseGain, t0 + 0.02)
  gainNode.gain.exponentialRampToValueAtTime(0.01, t0 + 0.4)

  const osc1 = ctx.createOscillator()
  osc1.connect(gainNode)
  osc1.frequency.value = 523.25
  osc1.type = 'sine'
  osc1.start(t0)
  osc1.stop(t0 + 0.15)

  const osc2 = ctx.createOscillator()
  osc2.connect(gainNode)
  osc2.frequency.value = 659.25
  osc2.type = 'sine'
  osc2.start(t0 + 0.08)
  osc2.stop(t0 + 0.35)
}

function playAlert(ctx, gainNode, baseGain) {
  const t0 = ctx.currentTime
  gainNode.gain.setValueAtTime(baseGain, t0)
  gainNode.gain.exponentialRampToValueAtTime(0.01, t0 + 0.15)

  const osc = ctx.createOscillator()
  osc.connect(gainNode)
  osc.frequency.setValueAtTime(400, t0)
  osc.frequency.setValueAtTime(300, t0 + 0.08)
  osc.type = 'sine'
  osc.start(t0)
  osc.stop(t0 + 0.15)
}

function playSoft(ctx, gainNode, baseGain) {
  const osc = ctx.createOscillator()
  osc.connect(gainNode)
  osc.frequency.value = 600
  osc.type = 'sine'
  gainNode.gain.setValueAtTime(baseGain * 0.7, ctx.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.25)
}

function playDoubleBeep(ctx, gainNode, baseGain) {
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.connect(gainNode)
  osc.frequency.value = 880
  osc.type = 'sine'
  gainNode.gain.setValueAtTime(0, t0)
  gainNode.gain.linearRampToValueAtTime(baseGain, t0 + 0.02)
  gainNode.gain.exponentialRampToValueAtTime(0.01, t0 + 0.12)
  osc.start(t0)
  osc.stop(t0 + 0.12)
  gainNode.gain.setValueAtTime(baseGain, t0 + 0.2)
  gainNode.gain.exponentialRampToValueAtTime(0.01, t0 + 0.32)
  const osc2 = ctx.createOscillator()
  osc2.connect(gainNode)
  osc2.frequency.value = 880
  osc2.type = 'sine'
  osc2.start(t0 + 0.2)
  osc2.stop(t0 + 0.32)
}

function playHighPing(ctx, gainNode, baseGain) {
  const osc = ctx.createOscillator()
  osc.connect(gainNode)
  osc.frequency.value = 1200
  osc.type = 'sine'
  gainNode.gain.setValueAtTime(baseGain * 0.8, ctx.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.15)
}

function playBell(ctx, gainNode, baseGain) {
  const t0 = ctx.currentTime
  gainNode.gain.setValueAtTime(0, t0)
  gainNode.gain.linearRampToValueAtTime(baseGain * 0.9, t0 + 0.03)
  gainNode.gain.exponentialRampToValueAtTime(0.01, t0 + 0.5)
  const osc = ctx.createOscillator()
  osc.connect(gainNode)
  osc.frequency.value = 784
  osc.type = 'sine'
  osc.start(t0)
  osc.stop(t0 + 0.4)
}

function playDing(ctx, gainNode, baseGain) {
  const t0 = ctx.currentTime
  gainNode.gain.setValueAtTime(baseGain * 0.6, t0)
  gainNode.gain.exponentialRampToValueAtTime(0.01, t0 + 0.3)
  const osc = ctx.createOscillator()
  osc.connect(gainNode)
  osc.frequency.setValueAtTime(1318.5, t0)
  osc.frequency.exponentialRampToValueAtTime(987.77, t0 + 0.3)
  osc.type = 'sine'
  osc.start(t0)
  osc.stop(t0 + 0.3)
}

function playUrgent(ctx, gainNode, baseGain) {
  const t0 = ctx.currentTime
  gainNode.gain.setValueAtTime(baseGain, t0)
  gainNode.gain.exponentialRampToValueAtTime(0.01, t0 + 0.1)
  const osc = ctx.createOscillator()
  osc.connect(gainNode)
  osc.frequency.setValueAtTime(600, t0)
  osc.frequency.setValueAtTime(400, t0 + 0.05)
  osc.type = 'square'
  osc.start(t0)
  osc.stop(t0 + 0.1)
}

export const NOTIFICATION_SOUND_OPTIONS = [
  { value: 'default', label: 'Default beep' },
  { value: 'chime', label: 'Chime' },
  { value: 'alert', label: 'Alert' },
  { value: 'soft', label: 'Soft' },
  { value: 'double_beep', label: 'Double beep' },
  { value: 'high_ping', label: 'High ping' },
  { value: 'bell', label: 'Bell' },
  { value: 'ding', label: 'Ding' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'none', label: 'None' }
]
