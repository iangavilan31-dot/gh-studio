import { useState } from 'react'

const projects = [
  {
    num: '01',
    title: 'Meridian',
    category: 'Fintech / Dashboard',
    year: '2024',
    desc: 'Real-time financial intelligence platform. Clean architecture, live data visualisation, purpose-built for institutional scale.',
    tech: ['React', 'TypeScript', 'WebSockets', 'D3'],
    accent: 'rgba(60, 100, 130, 0.18)',
  },
  {
    num: '02',
    title: 'Stratum',
    category: 'Editorial / Web',
    year: '2024',
    desc: 'Digital publication system for an independent media outlet. Precise editorial design translated faithfully to the web.',
    tech: ['Next.js', 'Sanity CMS', 'Framer Motion'],
    accent: 'rgba(80, 55, 110, 0.18)',
  },
  {
    num: '03',
    title: 'Ōkano',
    category: 'E-commerce / Design',
    year: '2025',
    desc: 'Luxury goods storefront. Unhurried, tactile interface with a seamless checkout experience that earns its price tag.',
    tech: ['React', 'Shopify', 'GSAP', 'Tailwind'],
    accent: 'rgba(50, 90, 60, 0.18)',
  },
  {
    num: '04',
    title: 'Relay',
    category: 'Developer Tools / SaaS',
    year: '2025',
    desc: 'Infrastructure tooling for fast-moving teams. Composable, production-grade, and entirely unopinionated.',
    tech: ['Node.js', 'Go', 'React', 'PostgreSQL'],
    accent: 'rgba(100, 55, 45, 0.18)',
  },
]

function ProjectRow({ project }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="group relative border-t border-white/[0.07] cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hover wash */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          opacity: hovered ? 1 : 0,
          background: `linear-gradient(90deg, ${project.accent} 0%, transparent 55%)`,
        }}
      />

      <div className="relative flex items-start gap-5 py-9 md:py-11">
        {/* Index number */}
        <span
          className="text-white/18 font-light flex-shrink-0 mt-1 w-8"
          style={{
            fontFamily: 'Inter, monospace',
            fontSize: '11px',
            letterSpacing: '0.12em',
          }}
        >
          {project.num}
        </span>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-6">
            <h3
              className="font-serif font-light leading-none"
              style={{
                fontSize: 'clamp(1.9rem, 4.2vw, 3.8rem)',
                color: hovered ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.78)',
                transition: 'color 0.35s ease',
              }}
            >
              {project.title}
            </h3>

            <div className="flex items-center gap-5 md:ml-auto">
              <span
                className="text-white/28 font-light"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '10px',
                  letterSpacing: '0.28em',
                }}
              >
                {project.category.toUpperCase()}
              </span>
              <span
                className="text-white/18 font-light hidden md:block"
                style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px' }}
              >
                {project.year}
              </span>
            </div>
          </div>

          {/* Description — slides in on hover */}
          <div
            style={{
              maxHeight: hovered ? '140px' : '0px',
              opacity: hovered ? 1 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.5s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.4s ease',
            }}
          >
            <p
              className="font-light leading-relaxed mt-4"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                color: 'rgba(255,255,255,0.42)',
                maxWidth: '460px',
              }}
            >
              {project.desc}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {project.tech.map((t) => (
                <span
                  key={t}
                  className="font-light"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '9px',
                    color: 'rgba(255,255,255,0.22)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    padding: '3px 8px',
                    letterSpacing: '0.22em',
                  }}
                >
                  {t.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div
          className="flex-shrink-0 mt-3"
          style={{
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateX(0)' : 'translateX(-10px)',
            transition: 'opacity 0.35s ease, transform 0.35s ease',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              d="M4 11h14M13 6l5 5-5 5"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}

export default function Work() {
  return (
    <section
      id="work"
      className="relative py-28 md:py-36 px-8 md:px-16 lg:px-24"
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-14">
        <span
          className="text-white/25 font-light"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '10px',
            letterSpacing: '0.36em',
          }}
        >
          SELECTED WORK
        </span>
        <span
          className="text-white/16 font-light"
          style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px' }}
        >
          {projects.length} projects
        </span>
      </div>

      {/* Project list */}
      <div>
        {projects.map((p) => (
          <ProjectRow key={p.num} project={p} />
        ))}
        <div className="border-t border-white/[0.07]" />
      </div>
    </section>
  )
}
