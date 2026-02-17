import { useRef, useState, useEffect } from 'react'
import Matter from 'matter-js'
import './FallingText.css'

const FallingText = ({
  className = '',
  text = '',
  highlightWords = [],
  highlightClass = 'highlighted',
  trigger = 'auto',
  backgroundColor = 'transparent',
  wireframes = false,
  gravity = 1,
  mouseConstraintStiffness = 0.2,
  fontSize = '1rem'
}) => {
  const containerRef = useRef(null)
  const textRef = useRef(null)
  const canvasContainerRef = useRef(null)
  const [effectStarted, setEffectStarted] = useState(false)

  useEffect(() => {
    if (!textRef.current) return
    const words = text.split(' ')
    const newHTML = words
      .map((word) => {
        const isHighlighted = highlightWords.some((hw) => word.toLowerCase().startsWith(hw.toLowerCase()))
        return `<span class="word ${isHighlighted ? highlightClass : ''}">${word}</span>`
      })
      .join(' ')
    textRef.current.innerHTML = newHTML
  }, [text, highlightWords, highlightClass])

  useEffect(() => {
    if (trigger === 'auto') {
      setEffectStarted(true)
      return
    }
    if (trigger === 'scroll' && containerRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setEffectStarted(true)
            observer.disconnect()
          }
        },
        { threshold: 0.7 }
      )
      observer.observe(containerRef.current)
      return () => observer.disconnect()
    }
  }, [trigger])

  useEffect(() => {
    if (!effectStarted) return

    const { Engine, Render, World, Bodies, Runner, Mouse, MouseConstraint, Body } = Matter
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const width = rect.width || 1
    const height = rect.height || 1

    const engine = Engine.create()
    engine.world.gravity.y = gravity

    const render = Render.create({
      element: canvasContainerRef.current,
      engine,
      options: {
        width,
        height,
        background: backgroundColor,
        wireframes
      }
    })

    const boundaryOptions = {
      isStatic: true,
      render: { fillStyle: 'transparent', strokeStyle: 'transparent' }
    }

    const floor = Bodies.rectangle(width / 2, height + 25, width, 50, boundaryOptions)
    const leftWall = Bodies.rectangle(-25, height / 2, 50, height, boundaryOptions)
    const rightWall = Bodies.rectangle(width + 25, height / 2, 50, height, boundaryOptions)
    const ceiling = Bodies.rectangle(width / 2, -25, width, 50, boundaryOptions)

    const wordSpans = textRef.current.querySelectorAll('.word')
    const wordBodies = [...wordSpans].map((elem) => {
      const spanRect = elem.getBoundingClientRect()
      const x = spanRect.left - rect.left + spanRect.width / 2
      const y = spanRect.top - rect.top + spanRect.height / 2

      const body = Bodies.rectangle(x, y, Math.max(spanRect.width, 24), Math.max(spanRect.height, 24), {
        render: { fillStyle: 'transparent' },
        restitution: 0.6,
        frictionAir: 0.02,
        friction: 0.1
      })

      Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 2,
        y: 0
      })
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.1)
      return { elem, body }
    })

    wordBodies.forEach(({ elem }) => {
      elem.style.position = 'absolute'
      elem.style.transform = 'translate(-50%, -50%)'
    })

    const mouse = Mouse.create(container)
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: mouseConstraintStiffness,
        render: { visible: false }
      }
    })
    render.mouse = mouse

    World.add(engine.world, [floor, leftWall, rightWall, ceiling, mouseConstraint, ...wordBodies.map((wb) => wb.body)])

    const runner = Runner.create()
    Runner.run(runner, engine)
    Render.run(render)

    const update = () => {
      wordBodies.forEach(({ body, elem }) => {
        const { x, y } = body.position
        elem.style.left = `${x}px`
        elem.style.top = `${y}px`
        elem.style.transform = `translate(-50%, -50%) rotate(${body.angle}rad)`
      })
      animationFrame = requestAnimationFrame(update)
    }

    let animationFrame = requestAnimationFrame(update)

    return () => {
      cancelAnimationFrame(animationFrame)
      Render.stop(render)
      Runner.stop(runner)
      if (render.canvas?.parentNode) {
        render.canvas.parentNode.removeChild(render.canvas)
      }
      World.clear(engine.world)
      Engine.clear(engine)
    }
  }, [effectStarted, gravity, wireframes, backgroundColor, mouseConstraintStiffness])

  const handleTrigger = () => {
    if (!effectStarted && (trigger === 'click' || trigger === 'hover')) {
      setEffectStarted(true)
    }
  }

  return (
    <div
      ref={containerRef}
      className={`falling-text-container ${className}`}
      onClick={trigger === 'click' ? handleTrigger : undefined}
      onMouseEnter={trigger === 'hover' ? handleTrigger : undefined}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      <div
        ref={textRef}
        className="falling-text-target"
        style={{ fontSize, lineHeight: 1.4 }}
      />
      <div ref={canvasContainerRef} className="falling-text-canvas" />
    </div>
  )
}

export default FallingText
