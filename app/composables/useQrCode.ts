import QRCode from 'qrcode'

// SVG markup, not toDataURL's canvas-based PNG — canvas/toDataURL can silently
// fail on restricted/embedded browsers (e.g. Fire TV's Silk) with no visible
// error (a rejected promise just leaves the image src empty forever). SVG is
// plain markup, no Canvas API involved, and works everywhere.
export function useQrCode(url: Ref<string | undefined>) {
  const svg = ref('')
  watch(
    url,
    async (u) => {
      if (!u) { svg.value = ''; return }
      try {
        svg.value = await QRCode.toString(u, { type: 'svg', margin: 1 })
      } catch (e) {
        console.warn('QR generation failed', e)
        svg.value = ''
      }
    },
    { immediate: true },
  )
  return svg
}
