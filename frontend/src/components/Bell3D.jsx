import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'

const BELL_SIZE = 36

// Lucide Bell icon paths (from lucide-react icons/bell.js)
const LUCIDE_BELL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M10.268 21a2 2 0 0 0 3.464 0"/>
  <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>
</svg>`

/**
 * Lucide Bell SVG extruded with Three.js. No button — just the 3D symbol.
 */
export default function Bell3D() {
  const containerRef = useRef(null)
  const groupRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const geometriesRef = useRef([])
  const frameRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = BELL_SIZE
    const height = BELL_SIZE

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100)
    camera.position.set(0, 0, 1.8)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const loader = new SVGLoader()
    const svgData = loader.parse(LUCIDE_BELL_SVG)
    const group = new THREE.Group()

    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.5,
      roughness: 0.4,
      side: THREE.DoubleSide
    })

    svgData.paths.forEach((path) => {
      const shapes = SVGLoader.createShapes(path)
      shapes.forEach((shape) => {
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: 0.04,
          bevelEnabled: true,
          bevelThickness: 0.01,
          bevelSize: 0.01,
          bevelSegments: 2
        })
        geometriesRef.current.push(geometry)
        const mesh = new THREE.Mesh(geometry, material)
        group.add(mesh)
      })
    })

    // SVG viewBox 0 0 24 24 → center at (12,12), flip Y for Three.js
    group.scale.set(0.032, -0.032, 0.032)
    group.position.set(-0.38, -0.38, 0)
    group.rotation.z = Math.PI / 6
    scene.add(group)
    groupRef.current = group

    const ambient = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambient)
    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(2, 2, 2)
    scene.add(dir)
    const fill = new THREE.DirectionalLight(0xffffff, 0.35)
    fill.position.set(-1, -0.5, 1)
    scene.add(fill)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    let time = 0
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      time += 0.01
      if (groupRef.current) {
        groupRef.current.rotation.z = Math.PI / 6 + Math.sin(time) * 0.06
      }
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      if (!cameraRef.current || !rendererRef.current) return
      cameraRef.current.aspect = width / height
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(width, height)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      geometriesRef.current.forEach((g) => g.dispose())
      material.dispose()
      if (container && rendererRef.current?.domElement) {
        container.removeChild(rendererRef.current.domElement)
      }
      rendererRef.current?.dispose()
    }
  }, [])

  return <div ref={containerRef} style={{ width: BELL_SIZE, height: BELL_SIZE, flexShrink: 0 }} />
}
