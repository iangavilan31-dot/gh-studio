// Contextual HUD (MASTER_PROMPT Part 10): NO persistent HUD. Only a contextual
// interact prompt (rune ring + verb) that fades in within 2m, plus a subtitle
// line for sleeper mumbles (a11y: on by default). Pure DOM over the canvas.

export class HUD {
  constructor() {
    const ui = document.getElementById('ui')
    this.prompt = document.createElement('div')
    this.prompt.className = 'prompt'
    this.prompt.innerHTML = `
      <div class="ring"><svg viewBox="0 0 44 44">
        <circle class="ring-bg" cx="22" cy="22" r="19"/>
        <circle class="ring-fill" cx="22" cy="22" r="19"/>
        <text x="22" y="27" text-anchor="middle" class="rune">ᚲ</text>
      </svg></div>
      <div class="verb">kindle</div>`
    ui.appendChild(this.prompt)
    this.ringFill = this.prompt.querySelector('.ring-fill')
    this.verbEl = this.prompt.querySelector('.verb')
    this.circumference = 2 * Math.PI * 19
    this.ringFill.style.strokeDasharray = `${this.circumference}`
    this.setProgress(0)
    this.visible = false

    this.subtitle = document.createElement('div')
    this.subtitle.className = 'subtitle'
    ui.appendChild(this.subtitle)
    this.subtitleTimer = null
  }

  showPrompt(verb) {
    if (this.verbEl.textContent !== verb) this.verbEl.textContent = verb
    if (!this.visible) {
      this.visible = true
      this.prompt.classList.add('on')
    }
  }
  hidePrompt() {
    if (this.visible) {
      this.visible = false
      this.prompt.classList.remove('on')
      this.setProgress(0)
    }
  }
  setProgress(t) {
    this.ringFill.style.strokeDashoffset = `${this.circumference * (1 - t)}`
  }

  clearSubtitle() {
    this.subtitle.classList.remove('on')
    clearTimeout(this.subtitleTimer)
  }

  say(text, seconds = 4) {
    this.subtitle.textContent = text
    this.subtitle.classList.add('on')
    clearTimeout(this.subtitleTimer)
    this.subtitleTimer = setTimeout(() => this.subtitle.classList.remove('on'), seconds * 1000)
  }
}
