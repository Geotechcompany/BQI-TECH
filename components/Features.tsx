"use client";

import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { Shield, Zap, Code, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { MouseEvent } from "react";
import Spline from '@splinetool/react-spline'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Points, PointMaterial, Line } from '@react-three/drei'
import * as random from 'maath/random'
import { Suspense, useMemo, useRef } from 'react'
import { Color, Vector3 } from 'three'
import * as THREE from 'three';

const features = [
  {
    icon: Shield,
    title: "Security First Development",
    description: "Security is at the core of every solution we build. Our team ensures that your systems meet governmentgrade compliance standards and protect sensitive data at every level",
    gradient: "from-[#31CDFF] to-blue-600",
    shadowColor: "rgba(49, 205, 255, 0.2)",
    delay: 0.2
  },
  {
    icon: Zap,
    title: "High Performance & Scalable Software",
    description: "Our custom built platforms are designed for speed, reliability, and long term growth. Whether you're managing a department or an entire government system, we ensure your tech infrastructure keeps up with demand.",
    gradient: "from-blue-600 to-[#272055]",
    shadowColor: "rgba(37, 99, 235, 0.2)",
    delay: 0.3
  },
  {
    icon: Code,
    title: "Tailored Software for Public Sector Needs",
    description: "We don’t believe in one size fits all. BQI Tech creates custom software tailored to your agency’s goals, workflows, and challenges helping you serve citizens better",
    gradient: "from-[#272055] to-[#31CDFF]",
    shadowColor: "rgba(39, 32, 85, 0.2)",
    delay: 0.4
  },
  {
    icon: Users,
    title: "Collaboration Focused Project Delivery",
    description: "Our process is collaborative from day one. We work closely with your internal teams to ensure alignment, transparency, and smooth implementation across all phases",
    gradient: "from-[#31CDFF] to-blue-600",
    shadowColor: "rgba(49, 205, 255, 0.2)",
    delay: 0.5
  }
];

function FeatureCard({ feature }: { feature: typeof features[0] }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const background = useMotionTemplate`
    radial-gradient(
      650px circle at ${mouseX}px ${mouseY}px,
      ${feature.shadowColor},
      transparent 80%
    )
  `;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: feature.delay }}
      whileHover={{ 
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
      className="relative group h-full"
    >
      <div
        onMouseMove={handleMouseMove}
        className={cn(
          "relative h-full rounded-3xl p-px",
          "bg-gradient-to-b from-[#31CDFF]/20 to-transparent"
        )}
      >
        <motion.div
          className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background }}
        />
        <div className={cn(
          "relative h-full bg-white rounded-3xl p-10",
          "shadow-xl shadow-blue-500/5",
          "border border-gray-100",
          "group-hover:border-[#31CDFF]/20",
          "transition-colors duration-500",
          "flex flex-col"
        )}>
          <div className={cn(
            "w-16 h-16 rounded-2xl mb-8",
            "flex items-center justify-center",
            "bg-gradient-to-tr shadow-lg shadow-[#31CDFF]/10",
            feature.gradient,
            "transform group-hover:scale-110 group-hover:rotate-6",
            "transition-all duration-500"
          )}>
            <feature.icon className="w-8 h-8 text-white transform -rotate-3" />
          </div>
          
          <div className="flex-grow">
            <h3 className={cn(
              "text-2xl font-bold mb-4 font-display",
              "bg-gradient-to-r bg-clip-text text-transparent",
              feature.gradient
            )}>
              {feature.title}
            </h3>
            
            <p className="text-gray-600 leading-relaxed font-light text-lg">
              {feature.description}
            </p>
          </div>

          <motion.div 
            className="mt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            initial={false}
          >
            <div className="h-px w-full bg-gradient-to-r from-[#31CDFF]/20 to-transparent mb-6" />
            <p className="text-sm text-gray-500 font-medium">Learn more →</p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function FloatingShapes() {
  const shapes = useMemo(() => {
    const vibrantColors = [
      '#31CDFF', // bright blue
      '#FF3366', // hot pink
      '#7C3AED', // vibrant purple
      '#06B6D4', // cyan
      '#10B981', // emerald
      '#F59E0B', // amber
    ];
    
    return Array.from({ length: 20 }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12
      ],
      rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0],
      scale: 0.3 + Math.random() * 0.4,
      color: new Color(vibrantColors[i % vibrantColors.length]),
      speed: 0.3 + Math.random() * 0.4,
      pulseSpeed: 0.5 + Math.random() * 0.5
    }));
  }, []);

  return (
    <group>
      {shapes.map((shape, i) => (
        <Shape key={i} {...shape} />
      ))}
      <ConnectionLines shapes={shapes} />
    </group>
  );
}

function Shape({ position, rotation, scale, color, speed, pulseSpeed }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const initialScale = scale;

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    const time = state.clock.getElapsedTime();
    
    // Rotation animation
    meshRef.current.rotation.x += delta * speed;
    meshRef.current.rotation.y += delta * speed * 0.8;
    
    // Floating animation
    meshRef.current.position.y += Math.sin(time + position[0]) * delta * 0.5;
    
    // Pulsing scale animation
    const pulseFactor = Math.sin(time * pulseSpeed) * 0.2 + 1;
    meshRef.current.scale.set(
      initialScale * pulseFactor,
      initialScale * pulseFactor,
      initialScale * pulseFactor
    );
  });

  return (
    <mesh ref={meshRef} position={position} rotation={rotation} scale={scale}>
      <octahedronGeometry args={[1, 0]} />
      <meshPhongMaterial 
        color={color}
        emissive={color}
        emissiveIntensity={0.8}
        shininess={100}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function ConnectionLines({ shapes }) {
  // Define a more specific type for the refs
  const lineRef = useRef<any>(null);
  const lineRef2 = useRef<any>(null);

  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i < shapes.length - 1; i++) {
      pts.push(new Vector3(...shapes[i].position));
      if (i % 2 === 0) {
        pts.push(new Vector3(...shapes[i + 1].position));
      }
    }
    return pts;
  }, [shapes]);

  useFrame((state) => {
    if (!lineRef.current || !lineRef2.current) return;
    
    const time = state.clock.getElapsedTime();
    
    // Use type assertion to handle the dashOffset property
    if (lineRef.current.material && 'dashOffset' in lineRef.current.material) {
      (lineRef.current.material as any).dashOffset = time * 0.5;
    }
    
    if (lineRef2.current.material && 'dashOffset' in lineRef2.current.material) {
      (lineRef2.current.material as any).dashOffset = -time * 0.3;
    }
  });

  return (
    <group>
      <Line
        ref={lineRef}
        points={points}
        color="#31CDFF"
        lineWidth={1}
        dashed={true}
        dashScale={2}
        dashSize={0.5}
        dashOffset={0}
        opacity={0.4}
        transparent
      />
      <Line
        ref={lineRef2}
        points={points}
        color="#FF3366"
        lineWidth={1}
        dashed={true}
        dashScale={2}
        dashSize={0.5}
        dashOffset={0}
        opacity={0.4}
        transparent
      />
    </group>
  );
}

export default function Features() {
  // Remove the 3D morph transition variants
  // const sectionMorphVariants = {
  //   hidden: { 
  //     opacity: 0,
  //     rotateX: -10, 
  //     rotateY: 6,
  //     rotateZ: -2,
  //     scale: 0.94,
  //     transformPerspective: 1200,
  //     z: -80,
  //     filter: "blur(5px)"
  //   },
  //   visible: { 
  //     opacity: 1,
  //     rotateX: 0, 
  //     rotateY: 0,
  //     rotateZ: 0,
  //     scale: 1,
  //     transformPerspective: 1200,
  //     z: 0,
  //     filter: "blur(0px)",
  //     transition: { 
  //       type: "spring", 
  //       stiffness: 50, 
  //       damping: 15,
  //       mass: 1.1,
  //       duration: 1.1,
  //       delay: 0.05
  //     } 
  //   }
  // };

  return (
    <motion.section 
      className="py-24 relative overflow-hidden"
      // Remove the variants and 3D transform classes
      // variants={sectionMorphVariants}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.15 }}
    >
      <div className="absolute inset-0 w-full h-full opacity-50">
        <Canvas camera={{ position: [0, 0, 15] }}>
          <Suspense fallback={null}>
            <OrbitControls 
              enableZoom={false} 
              autoRotate 
              autoRotateSpeed={0.4}
              maxPolarAngle={Math.PI}
              minPolarAngle={0}
            />
            <FloatingShapes />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1.5} />
            <pointLight position={[-10, -10, -10]} intensity={0.8} color="#FF3366" />
            <fog attach="fog" args={['#000', 20, 30]} />
          </Suspense>
        </Canvas>
      </div>
      
      <div className="container relative mx-auto px-4 max-w-8xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-6 mb-24"
        >
          <motion.div 
            className="inline-flex items-center gap-2 bg-[#31CDFF]/5 backdrop-blur-sm px-6 py-2 rounded-full mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <span className="inline-block w-2 h-2 rounded-full bg-[#31CDFF] animate-pulse" />
            <span className="text-[#31CDFF] font-semibold tracking-wider text-sm">
              Why Choose BQI Tech?
            </span>
          </motion.div>

          <p className="text-2xl md:text-3xl text-gray-800 max-w-4xl mx-auto font-light leading-relaxed tracking-tight">
            <span className="text-[#31CDFF] font-semibold">At BQI Tech,</span> we specialize in building 
            <span className="font-bold text-gray-900"> high-performance software solutions</span> designed 
            specifically for government agencies. From custom applications to full-scale enterprise IT systems, 
            our goal is to enable <span className="bg-gradient-to-r from-[#31CDFF] to-blue-600 text-transparent bg-clip-text font-semibold">
            efficient, secure, and future-ready public services</span>.
          </p>
        </motion.div>

        {/* Lighthouse/Axe heading-order rule expects an h2 before h3 card titles. */}
        <h2 className="sr-only">BQI Tech Features</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 xl:gap-10">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ 
                duration: 0.5,
                delay: index * 0.1
              }}
              className="h-full"
            >
              <FeatureCard feature={feature} />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-24 text-center"
        >
   
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-6 mb-24"
        >
          <motion.div 
            className="inline-flex items-center gap-2 bg-[#31CDFF]/5 backdrop-blur-sm px-6 py-2 rounded-full mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <span className="inline-block w-2 h-2 rounded-full bg-[#31CDFF] animate-pulse" />
       
          </motion.div>

          <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 shadow-xl p-8 md:p-12">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              Our Services Include:
            </h3>
            <ul className="grid md:grid-cols-2 gap-4 text-left">
              {[
                "Custom Software Development for Government",
                "Enterprise Systems Integration",
                "Cloud Based Infrastructure",
                "Data Security & Compliance Solutions",
                "Digital Process Automation"
              ].map((service, index) => (
                <motion.li
                  key={service}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ 
                    duration: 0.5, 
                    delay: index * 0.1 
                  }}
                  className="flex items-center gap-3 text-lg text-gray-700"
                >
                  <span className="text-[#31CDFF] font-bold">•</span>
                  {service}
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}