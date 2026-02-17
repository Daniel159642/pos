import { useEffect, useRef, useState } from 'react'
import VariableProximity from './VariableProximity'
import BlurText from './BlurText'
import FallingText from './FallingText'

export default function App() {
  const appRef = useRef(null)
  const heroRef = useRef(null)
  const [headerActive, setHeaderActive] = useState(false)
  const [subtitleVisible, setSubtitleVisible] = useState(false)

  useEffect(() => {
    const heroSection = heroRef.current
    if (!heroSection) return

    const observer = new IntersectionObserver(
      ([entry]) => setHeaderActive(!entry.isIntersecting),
      { threshold: 0.4 }
    )

    observer.observe(heroSection)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (headerActive) {
      const t = setTimeout(() => setSubtitleVisible(true), 700)
      return () => clearTimeout(t)
    } else {
      setSubtitleVisible(false)
    }
  }, [headerActive])

  return (
    <>
      <header className={`site-header ${headerActive ? 'site-header--visible' : ''}`} aria-hidden={!headerActive} />
      {subtitleVisible && (
        <div className="subtitle-center">
          <BlurText
            text="Everything all in one place, for one price."
            delay={180}
            animateBy="words"
            direction="top"
            className="subtitle"
          />
        </div>
      )}
      <div className="app" ref={appRef}>
        <section className="hero" ref={heroRef}>
          <VariableProximity
            label="SWIFTLY"
            className={`brand ${headerActive ? 'brand--compact' : ''}`}
            fromFontVariationSettings="'wght' 400, 'opsz' 9"
            toFontVariationSettings="'wght' 1000, 'opsz' 40"
            containerRef={appRef}
            radius={200}
            falloff="linear"
          />
        </section>
        <section className="spacer" aria-hidden="true" />
        <section className="subtitle-section" aria-hidden={!subtitleVisible} />
        <section className="features-spacer" aria-hidden="true" />
        <section className="features features--fixed">
          <div className="falling-wrapper">
            <FallingText
              text="Accounting Scheduling Shipments Inventory Rewards Orders DoorDash Shopify UberEats"
              highlightWords={['Accounting', 'Scheduling', 'Shipments', 'Inventory', 'Rewards', 'Orders', 'DoorDash', 'Shopify', 'UberEats']}
              highlightClass="highlighted"
              trigger="scroll"
              backgroundColor="transparent"
              wireframes={false}
              gravity={0.56}
              fontSize="2rem"
              mouseConstraintStiffness={0.9}
            />
          </div>
        </section>
        <section className="cover-section" />
      </div>
    </>
  )
}
