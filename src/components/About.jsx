const team = [
  {
    name: 'Ian Gavilan',
    role: 'Full-Stack Engineer',
    bio: 'Focused on performance, clean architecture, and systems that hold up under pressure. Comfortable anywhere from schema design to deployment pipelines.',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS'],
    index: '01',
  },
  {
    name: 'Luka Hernandez',
    role: 'Frontend / Design Engineer',
    bio: 'Interface craft, motion, and digital experience. Bridges the gap between design intent and production reality.',
    skills: ['React', 'Figma', 'GSAP', 'Tailwind', 'Three.js'],
    index: '02',
  },
]

export default function About() {
  return (
    <section id="about" className="relative py-28 md:py-36 px-8 md:px-16 lg:px-24">
      {/* Section header */}
      <span
        className="block text-white/25 font-light mb-14"
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '10px',
          letterSpacing: '0.36em',
        }}
      >
        THE TEAM
      </span>

      {/* Team panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {team.map((member) => (
          <div
            key={member.name}
            className="p-10 md:p-14"
            style={{
              background: 'rgba(16, 26, 30, 0.45)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
          >
            {/* Index */}
            <span
              className="block text-white/14 font-light mb-6"
              style={{
                fontFamily: 'Inter, monospace',
                fontSize: '11px',
                letterSpacing: '0.14em',
              }}
            >
              {member.index}
            </span>

            {/* Name */}
            <h3
              className="font-serif font-light text-white/85 mb-2"
              style={{ fontSize: 'clamp(1.6rem, 2.8vw, 2.5rem)', lineHeight: 1.1 }}
            >
              {member.name}
            </h3>

            {/* Role */}
            <p
              className="text-white/28 font-light mb-8"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '10px',
                letterSpacing: '0.3em',
              }}
            >
              {member.role.toUpperCase()}
            </p>

            {/* Bio */}
            <p
              className="text-white/46 font-light leading-relaxed mb-8"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '13.5px',
                maxWidth: '300px',
              }}
            >
              {member.bio}
            </p>

            {/* Skills */}
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {member.skills.map((s) => (
                <span
                  key={s}
                  className="text-white/22 font-light"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '10px',
                    letterSpacing: '0.18em',
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
