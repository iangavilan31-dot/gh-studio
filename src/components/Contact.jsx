export default function Contact() {
  return (
    <section id="contact" className="relative py-28 md:py-36 px-8 md:px-16 lg:px-24">
      <div className="max-w-2xl">
        {/* Section label */}
        <span
          className="block text-white/25 font-light mb-12"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '10px',
            letterSpacing: '0.36em',
          }}
        >
          GET IN TOUCH
        </span>

        {/* Heading */}
        <h2
          className="font-serif font-light text-white/78 mb-12"
          style={{
            fontSize: 'clamp(1.8rem, 4vw, 3.5rem)',
            lineHeight: 1.12,
          }}
        >
          Have a project in mind?
          <br />
          <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.38)' }}>
            Let's build it.
          </em>
        </h2>

        {/* Contact links */}
        <div className="flex flex-col gap-5">
          {[
            { label: 'Ian', email: 'ian@gavilan.dev' },
            { label: 'Luka', email: 'luka@hernandez.dev' },
          ].map(({ label, email }) => (
            <a
              key={label}
              href={`mailto:${email}`}
              className="group inline-flex items-center gap-4 text-white/40 hover:text-white/75 transition-colors duration-300"
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 300 }}
            >
              <span
                className="text-white/18 font-light"
                style={{ fontSize: '10px', letterSpacing: '0.28em', width: '32px', flexShrink: 0 }}
              >
                {label.toUpperCase()}
              </span>
              {email}
              <span
                className="text-white/25 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
              >
                →
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* Footer rule */}
      <div
        className="mt-24 pt-7 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span
          className="text-white/13 font-light"
          style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', letterSpacing: '0.3em' }}
        >
          G&amp;H STUDIO — 2025
        </span>
        <span
          className="text-white/13 font-light"
          style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', letterSpacing: '0.3em' }}
        >
          BUILT WITH INTENT
        </span>
      </div>
    </section>
  )
}
