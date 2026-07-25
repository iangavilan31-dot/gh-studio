import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const page = await browser.newPage()
const dataUri = 'data:image/png;base64,' + readFileSync('/home/user/gh-studio/docs/build/shots/rooftops.png').toString('base64')
const out = await page.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode()
  const c = document.createElement('canvas'); const W = 480, H = 270
  c.width = W; c.height = H
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, W, H)
  const d = ctx.getImageData(0, 0, W, H).data
  // TR quadrant analysis
  let topSum = 0, topN = 0, botSum = 0, botN = 0, satSum = 0, satN = 0
  for (let y = 0; y < H / 2; y++) {
    for (let x = W / 2; x < W; x++) {
      const i4 = (y * W + x) * 4
      const l = (0.299 * d[i4] + 0.587 * d[i4 + 1] + 0.114 * d[i4 + 2]) / 255
      if (y < H / 4) { topSum += l; topN++ } else { botSum += l; botN++ }
    }
  }
  for (let y = 0; y < H / 2; y += 3) for (let x = W / 2; x < W; x += 3) {
    const i4 = (y * W + x) * 4
    satSum += (Math.max(d[i4], d[i4 + 1], d[i4 + 2]) - Math.min(d[i4], d[i4 + 1], d[i4 + 2])) / 255; satN++
  }
  const px = (x, y) => { const i4 = (y * W + x) * 4; return [d[i4], d[i4 + 1], d[i4 + 2]] }
  return { vgrad: Math.abs(topSum / topN - botSum / botN), satAvg: satSum / satN, satN, sample: [px(360, 40), px(400, 100), px(440, 20)] }
}, dataUri)
console.log(JSON.stringify(out))
await browser.close()
