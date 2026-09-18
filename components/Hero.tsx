"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { TypeAnimation } from "react-type-animation";
import { ArrowRight, ChevronDown } from "lucide-react";

interface HeroContent {
  images: {
    src: string;
    overlay: string;
  }[];
  typeSequence: (string | number)[];
}

const heroContent: HeroContent = {
  images: [
    {
      src: "/Sliders/slider1.png",
      overlay: "bg-gradient-to-r from-[#0B0F19]/70 to-[#0B0F19]/50"
    },
    {
      src: "/Sliders/slider2.png",
      overlay: "bg-gradient-to-r from-[#0B0F19]/70 to-[#0B0F19]/50"
    },
    {
      src: "/Sliders/slider3.png",
      overlay: "bg-gradient-to-r from-[#0B0F19]/70 to-[#0B0F19]/50"
    },
    {
      src: "/Sliders/slider5.png",
      overlay: "bg-gradient-to-r from-[#0B0F19]/70 to-[#0B0F19]/50"
    },
   
  ],
  typeSequence: [
    "& Digital Solutions", 3000
  ]
};

const AnimatedText = ({ text }: { text: string }) => {
  return (
    <span className="inline-block overflow-visible">
      <motion.span
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="inline-block"
      >
        {text}
      </motion.span>
    </span>
  );
};

export function Hero() {
  const [currentImage, setCurrentImage] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Preload all images
  useEffect(() => {
    const preloadImages = async () => {
      const imagePromises = heroContent.images.map((image) => {
        return new Promise((resolve, reject) => {
          const img = new window.Image();
          img.src = image.src;
          img.onload = resolve;
          img.onerror = reject;
        });
      });

      try {
        await Promise.all(imagePromises);
        setImagesLoaded(true);
      } catch (error) {
        console.warn('Some hero images failed to preload:', error);
        setImagesLoaded(true); // Still show the component
      }
    };

    preloadImages();
  }, []);

  useEffect(() => {
    if (!imagesLoaded) return;

    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % heroContent.images.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [imagesLoaded]);

  return (
    <section className="relative h-screen w-full overflow-hidden -mt-[80px]">
      {/* Image Background with Cross-fade Transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentImage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 1.5, ease: "easeInOut" } }}
          exit={{ opacity: 0, transition: { duration: 1.5, ease: "easeInOut" } }}
          className="absolute inset-0 z-10"
        >
          <div className="absolute inset-0 w-full h-full overflow-hidden">
            <img
              src={heroContent.images[currentImage].src}
              alt={`Hero background image ${currentImage + 1}`}
              className="object-cover scale-105 transition-transform duration-8000 ease-out w-full h-full"
              style={{ position: 'absolute', inset: 0 }}
              loading={currentImage === 0 ? "eager" : "lazy"}
            />
          </div>
          <div className={`absolute inset-0 ${heroContent.images[currentImage].overlay} transition-opacity duration-1000`} />
        </motion.div>
      </AnimatePresence>

      {/* Loading fallback for first image */}
      {!imagesLoaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F19] to-[#272055] z-5">
          <div className="absolute inset-0 animate-pulse opacity-20">
            <div className="w-full h-full bg-gradient-to-br from-white/5 to-transparent" />
          </div>
        </div>
      )}

      {/* Updated Hero Content */}
      <motion.div
        className="relative h-full flex flex-col justify-center items-center px-4 z-20 pt-16 sm:pt-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true, amount: 0.2 }}
      >
        <motion.div
          className="text-center max-w-6xl mx-auto w-full"
        >
          <motion.div
            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 sm:px-6 py-2 rounded-full mb-4 sm:mb-6 mx-auto max-w-max"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              duration: 0.6,
              ease: "easeOut",
              delay: 0.5 
            }}
          >
            <span className="inline-block w-2 h-2 rounded-full bg-[#31CDFF] animate-pulse" />
            <span className="text-[#31CDFF] font-semibold tracking-wider text-xs sm:text-sm">
              TRANSFORMING GOVERNMENT TECHNOLOGY
            </span>
          </motion.div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-white mb-4 break-words leading-tight">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="block"
            >
              <AnimatedText text="Innovative Government Software " />{" "}
            </motion.div>
            <span className="bg-gradient-to-r from-[#31CDFF] via-blue-400 to-purple-500 text-transparent bg-clip-text text-2xl sm:text-5xl md:text-6xl">
              <TypeAnimation
                sequence={heroContent.typeSequence}
                wrapper="span"
                cursor={true}
                repeat={Infinity}
                speed={35}
                deletionSpeed={50}
                style={{ display: 'inline-block', fontSize: 'inherit' }}
              />
            </span>
          </h1>

          <motion.p
            className="text-base sm:text-xl md:text-2xl text-gray-300 mb-6 sm:mb-8 max-w-4xl mx-auto font-light px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            Empowering Public Sector Transformation with{" "}
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="text-white font-normal"
            >
              secure, Scalable Software.
            </motion.span>
          </motion.p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 px-4">
            <Link
              href="/about"
              className="group w-full sm:w-auto bg-gradient-to-r from-[#31CDFF] to-blue-600 text-white 
                       px-6 sm:px-10 py-3 sm:py-4 rounded-full font-semibold text-base sm:text-lg
                       hover:shadow-[0_0_30px_rgba(49,205,255,0.3)] transition-all duration-300 
                       flex items-center justify-center gap-3"
            >
              Get Started Today
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 transform group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/services"
              className="group w-full sm:w-auto border-2 border-white/20 bg-white/5 backdrop-blur-sm
                       hover:border-[#31CDFF]/40 hover:bg-[#31CDFF]/5
                       text-white px-6 sm:px-10 py-3 sm:py-4 rounded-full font-semibold text-base sm:text-lg
                       transition-all duration-300 flex items-center justify-center gap-3"
            >
              Explore Services
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 transform group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>

        {/* Enhanced Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 text-center"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <span className="text-white/60 text-xs sm:text-sm font-medium tracking-wider opacity-70">SCROLL DOWN</span>
          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-[#31CDFF] opacity-70" />
        </motion.div>
      </motion.div>
    </section>
  );
}