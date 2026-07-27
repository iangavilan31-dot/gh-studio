export default function Navbar() {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 flex items-center justify-between px-8 md:px-14 py-7"
      style={{ zIndex: 40 }}
    >
      <span
        className="text-white/55 text-xs font-light"
        style={{ letterSpacing: '0.28em', fontFamily: 'Inter, sans-serif' }}
      >
        G&amp;H
      </span>

      <div className="flex items-center gap-8">
        {[['work', 'Work'], ['about', 'About'], ['contact', 'Contact']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => scrollTo(id)}
            className="text-white/30 hover:text-white/70 transition-colors duration-300 text-[10px] font-light bg-transparent border-none cursor-pointer"
            style={{ letterSpacing: '0.32em', fontFamily: 'Inter, sans-serif' }}
          >
            {label.toUpperCase()}
          </button>
        ))}
        <a
          href="/game.html"
          className="text-amber-200/40 hover:text-amber-200/80 transition-colors duration-300 text-[10px] font-light no-underline"
          style={{ letterSpacing: '0.32em', fontFamily: 'Inter, sans-serif' }}
        >
          EMBERVALE ◆
        </a>
      </div>
    </nav>
  )
}
