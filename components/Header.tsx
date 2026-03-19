"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Search, Phone, User, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MobileMenu } from "@/components/MobileMenu"
import { motion } from "framer-motion"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)

  const handleClick = () => {
    if (isAuthenticated) {
      router.push("/dashboard")
    } else {
      router.push("/login")
    }
  }

  // Add scroll detection
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY
      setIsScrolled(scrollPosition > 50)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const getNavLinkClasses = (route: string) => {
    const isActive = pathname === route;
    return `flex items-center gap-1.5 text-[16px] font-medium rounded-md px-2 py-2 transition-colors ${
      isScrolled 
        ? (isActive 
            ? 'text-[#0052CC] font-semibold' 
            : 'text-gray-700 hover:text-[#0052CC]')
        : (isActive 
            ? 'text-[#0052CC] font-semibold' 
            : 'text-[#31CDFF] hover:text-[#0052CC]')
    }`;
  }

  return (
    <>
      <div className="w-full fixed top-0 left-0 right-0 z-50">
        {/* Main Header */}
        <header className={`w-full transition-all duration-300 ${
          isScrolled 
            ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-100' 
            : 'bg-transparent'
        }`}>
          <div className="container flex h-[80px] items-center justify-between px-6 max-w-[1400px] mx-auto">
            <Link href="/" className="flex items-center gap-2 py-4">
              <img
                src="/bqilogo.png"
                alt="BQI Logo"
                width={300}
                height={90}
                className="h-20 w-auto"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <Link 
                href="/" 
                scroll={false}
                className={getNavLinkClasses("/")}
              >
                Home
              </Link>

              <Link 
                href="/careers" 
                scroll={false}
                className={getNavLinkClasses("/careers")}
              >
                Careers
              </Link>

              <Link 
                href="/services" 
                scroll={false}
                className={getNavLinkClasses("/services")}
              >
                Services
              </Link>

              <Link 
                href="/about" 
                scroll={false}
                className={getNavLinkClasses("/about")}
              >
                About
              </Link>
              <Link 
                href="/blog" 
                scroll={false}
                className={getNavLinkClasses("/blog")}
              >
                Blog
              </Link>
            </nav>

            {/* Mobile Actions */}
            <div className="flex items-center gap-3">
              <Button 
                className="bg-[#31CDFF] hover:bg-[#0052CC] text-[#272055] hover:text-white rounded-full text-[14px] font-medium px-8 h-10 transition-colors"
                onClick={() => router.push("/careers")}
              >
                Join Our Team
              </Button>
              <motion.button 
                className="md:hidden p-2 relative z-50 hover:bg-white/10 rounded-full transition-colors"
                onClick={toggleMenu}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Menu 
                  className={`w-6 h-6 transition-colors duration-200 ${
                    isScrolled ? 'text-gray-700' : 'text-[#31CDFF]'
                  }`}
                />
              </motion.button>
            </div>
          </div>
        </header>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-[80px] w-full" />

      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
    </>
  )
}