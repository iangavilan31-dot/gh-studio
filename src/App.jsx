import { useState, useEffect } from 'react'
import RainCanvas from './components/RainCanvas'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Work from './components/Work'
import About from './components/About'
import Contact from './components/Contact'

function Scene({ mousePos }) {
  const shift = (factor) => ({
    transform: `translate(${(mousePos.x - 0.5) * factor}px, ${(mousePos.y - 0.5) * factor * 0.4}px)`,
    transition: 'transform 1s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    willChange: 'transform',
  })

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base sky — overcast rainy day */}
      <div
        className="absolute"
        style={{
          inset: '-8%',
          ...shift(-5),
          background: `linear-gradient(
            180deg,
            #252f36 0%,
            #354652 10%,
            #4e6170 28%,
            #647e8a 46%,
            #566a5e 64%,
            #384a3c 78%,
            #1f2e26 88%,
            #111a14 100%
          )`,
        }}
      />

      {/* Diffuse cloud light — upper half */}
      <div className="absolute" style={{ inset: '-8%', ...shift(-9) }}>
        <div
          className="absolute rounded-full"
          style={{
            top: '4%', left: '3%', width: '48%', height: '22%',
            background: 'radial-gradient(ellipse, rgba(168,196,210,0.14) 0%, transparent 70%)',
            filter: 'blur(48px)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            top: '13%', left: '28%', width: '55%', height: '20%',
            background: 'radial-gradient(ellipse, rgba(140,174,192,0.10) 0%, transparent 70%)',
            filter: 'blur(55px)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            top: '2%', right: '6%', width: '38%', height: '16%',
            background: 'radial-gradient(ellipse, rgba(180,210,225,0.08) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            top: '22%', right: '18%', width: '44%', height: '18%',
            background: 'radial-gradient(ellipse, rgba(120,158,178,0.07) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
        />
      </div>

      {/* Horizon glow */}
      <div
        className="absolute"
        style={{
          inset: '-8%',
          ...shift(-3),
          background:
            'radial-gradient(ellipse 90% 25% at 50% 52%, rgba(148,178,192,0.15) 0%, transparent 100%)',
        }}
      />

      {/* Far tree silhouettes */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '44%',
          ...shift(-2),
          background: `
            radial-gradient(ellipse 5% 28% at 2%   100%, #1c2c22 0%, transparent 100%),
            radial-gradient(ellipse 8% 36% at 8%   100%, #182618 0%, transparent 100%),
            radial-gradient(ellipse 6% 30% at 14%  100%, #1e2e24 0%, transparent 100%),
            radial-gradient(ellipse 9% 40% at 21%  100%, #162216 0%, transparent 100%),
            radial-gradient(ellipse 7% 32% at 28%  100%, #1a2a20 0%, transparent 100%),
            radial-gradient(ellipse 11% 44% at 36% 100%, #141e14 0%, transparent 100%),
            radial-gradient(ellipse 7% 30% at 44%  100%, #1c2c22 0%, transparent 100%),
            radial-gradient(ellipse 9% 38% at 52%  100%, #182618 0%, transparent 100%),
            radial-gradient(ellipse 7% 32% at 60%  100%, #1e2e24 0%, transparent 100%),
            radial-gradient(ellipse 11% 42% at 68% 100%, #141e14 0%, transparent 100%),
            radial-gradient(ellipse 7% 30% at 76%  100%, #1a2a20 0%, transparent 100%),
            radial-gradient(ellipse 9% 38% at 84%  100%, #182618 0%, transparent 100%),
            radial-gradient(ellipse 6% 28% at 91%  100%, #1c2c22 0%, transparent 100%),
            radial-gradient(ellipse 5% 24% at 97%  100%, #182618 0%, transparent 100%),
            linear-gradient(180deg, transparent 22%, #0e1812 100%)
          `,
        }}
      />

      {/* Warm interior light reflection — left edge of glass */}
      <div
        className="absolute"
        style={{
          inset: '-8%',
          ...shift(6),
          background:
            'radial-gradient(ellipse 30% 60% at 6% 36%, rgba(195,150,75,0.07) 0%, transparent 72%)',
        }}
      />

      {/* Ground shadow */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: '16%', background: 'linear-gradient(180deg, transparent, #090f0b)' }}
      />
    </div>
  )
}

export default function App() {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const onMove = (e) => {
      setMousePos({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ backgroundColor: '#141e1a' }}>
      {/* Fixed background scene */}
      <div className="fixed inset-0" style={{ zIndex: 0 }}>
        <Scene mousePos={mousePos} />
      </div>

      {/* Animated rain canvas */}
      <RainCanvas />

      {/* Window-frame vignette — dark edges */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 20,
          boxShadow: 'inset 0 0 180px rgba(8, 12, 10, 0.8)',
        }}
      />

      {/* Very faint glass tint */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 20, background: 'rgba(18, 30, 36, 0.10)' }}
      />

      {/* Scrollable content above everything */}
      <div className="relative" style={{ zIndex: 30 }}>
        <Navbar />
        <Hero />
        <Work />
        <About />
        <Contact />
      </div>
    </div>
  )
}
