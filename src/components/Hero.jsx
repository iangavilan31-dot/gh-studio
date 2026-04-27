export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center px-8 md:px-16 lg:px-24 pt-20">
      <div className="max-w-5xl">

        {/* Eyebrow label */}
        <p
          className="text-[10px] text-white/25 font-light mb-10 animate-fade-up"
          style={{
            letterSpacing: '0.38em',
            fontFamily: 'Inter, sans-serif',
            animationDelay: '0.1s',
          }}
        >
          PORTFOLIO — 2025
        </p>

        {/* Display headline */}
        <h1
          className="font-serif font-light text-white/88 animate-fade-up"
          style={{
            fontSize: 'clamp(3rem, 8.5vw, 8rem)',
            lineHeight: 1.04,
            animationDelay: '0.25s',
          }}
        >
          Digital work,
          <br />
          <em
            style={{
              fontStyle: 'italic',
              color: 'rgba(255,255,255,0.52)',
              fontWeight: 300,
            }}
          >
            done right.
          </em>
        </h1>

        {/* Animated divider */}
        <div
          className="relative h-px my-10 overflow-hidden animate-fade-up"
          style={{
            maxWidth: '480px',
            background: 'rgba(255,255,255,0.06)',
            animationDelay: '0.45s',
          }}
        >
          <div
            className="absolute inset-y-0 left-0 bg-white/20 animate-line-grow"
          />
        </div>

        {/* Sub text */}
        <p
          className="font-light text-white/38 leading-relaxed animate-fade-up"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 'clamp(0.9rem, 1.4vw, 1.1rem)',
            letterSpacing: '0.01em',
            maxWidth: '320px',
            animationDelay: '0.55s',
          }}
        >
          Ian Gavilan &amp; Luka Hernandez.
          <br />
          We build things for the web.
        </p>

      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-10 left-8 md:left-16 lg:left-24 flex items-center gap-4 animate-fade-up"
        style={{ animationDelay: '1s' }}
      >
        <div
          className="w-px"
          style={{
            height: '52px',
            background: 'rgba(255,255,255,0.18)',
            animation: 'pulseOpacity 2.8s ease-in-out infinite',
          }}
        />
        <span
          className="text-white/22 font-light"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '9px',
            letterSpacing: '0.36em',
          }}
        >
          SCROLL
        </span>
      </div>
    </section>
  )
}
