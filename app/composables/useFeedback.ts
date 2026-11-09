// Beeps + vibration for the answer countdown. Shared across components so the
// mute toggle in the top bar and the game screen agree. Phones only allow audio
// after a tap, so the AudioContext is created on the first user gesture.
const muted = ref(false)
let ctx: AudioContext | null = null
let listening = false

function unlock() {
  const AC = window.AudioContext || (window as any).webkitAudioContext
  if (!AC) return
  ctx ??= new AC()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
}

function beep(freq: number, ms: number) {
  if (muted.value || !ctx || ctx.state !== 'running') return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const t = ctx.currentTime
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.15, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000) // fade out, no click
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + ms / 1000)
}

function vibrate(pattern: number | number[]) {
  if (!muted.value) navigator.vibrate?.(pattern)
}

export function useFeedback() {
  if (import.meta.client && !listening) {
    listening = true
    muted.value = localStorage.getItem('fsr_muted') === '1'
    window.addEventListener('pointerdown', unlock) // also re-resumes after the phone was locked
  }
  return {
    muted,
    toggleMute() {
      muted.value = !muted.value
      localStorage.setItem('fsr_muted', muted.value ? '1' : '0')
    },
    // Last seconds of the answer window.
    tick() {
      vibrate(30)
      beep(660, 90)
    },
    // Time's up / answers revealed.
    done() {
      vibrate([120, 60, 120])
      beep(330, 260)
    },
  }
}
