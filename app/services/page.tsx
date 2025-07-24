'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { Briefcase, Code, CheckCircle, ArrowRight } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import Link from 'next/link'

const services = [
  {
    icon: Code,
    title: 'Custom Software Development & Engineering for Government and Public Sector Needs',
    description: `Our software engineering team delivers custom built applications that support mission critical operations. We
    design and develop secure, scalable software solutions for public sector agencies, aligning technology with
    regulatory frameworks, data protection standards, and institutional goals.
    Our Software Development Services Include:`,
    details: [
      'Custom Software Development: Web and mobile applications tailored to your internal workflows and citizen facing services.',
      'COTS Software Optimization: We enhance and integrate commercial off the shelf (COTS) solutions for better performance and adaptability to public sector requirements.',
      'Full Cycle Development: From system design and prototyping to deployment and maintenance, we manage the full software lifecycle with a focus on reliability and compliance.'
    ],
    image: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?q=80&w=1600'
  },
  {
    icon: Briefcase,
    title: 'Enterprise Platform Solutions for Scalable Government Operations',
    description: `Our enterprise platform engineering services help government bodies implement, customize, and optimize large scale IT
    systems. These platforms are the backbone of modern public service delivery, enabling integration, efficiency, and data
    driven decision making.
    Key Capabilities:`,
    details: [
      'Enterprise Platform Configuration: We tailor platforms to your institution’s structure, ensuring optimized workflows and user experience.',
      'Advanced Reporting Solutions: Using SSRS, Crystal Reports, and other tools, we develop reporting frameworks that provide transparency and actionable insights.',
      'System Integration: We ensure seamless interoperability across departments and systems, reducing redundancy and improving coordination.'
    ],
    image: 'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?q=80&w=1600'
  },
  {
    icon: CheckCircle,
    title: 'Strategic IT Consulting for Government Agencies',
    description: `BQI Tech offers specialized IT consulting for government institutions. We bring domain expertise and technical depth to support high stakes decision making, implementation planning, and technology adoption strategies.\nOur Consulting Services Cover :`,
    details: [
      'IT infrastructure evaluation and planning',
      'Enterprise architecture design',
      'Cloud migration strategy and execution',
      'Security assessment and compliance',
      'Process automation and digitization advisory'
    ],
    footer: `We understand the constraints, challenges, and regulatory environments that shape government IT projects and provide insights that align with policy goals and funding requirements.`,
    image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80' // Tech-focused digital collaboration
  },
  {
    icon: Code,
    title: 'DevOps and Cloud Engineering for Public Sector Efficiency',
    description: `With modern DevOps practices and cloud native engineering, we support continuous integration, automation, and operational efficiency for public sector IT environments.\nServices Include:`,
    details: [
      'CI/CD Pipeline Implementation',
      'Infrastructure as Code (IaC)',
      'Cloud Cost Optimization',
      'Environment Management and Automation'
    ],
    footer: `Our DevOps services are designed to reduce deployment times, minimize downtime, and enhance system reliability in both on-premise and cloud environments.`,
    image: 'https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&w=1600&q=80' // Data center with blue lighting, strong tech/devops vibe
  }
]

export default function ServicesPage() {
  const breadcrumbItems = [
    { label: "Services" }
  ]

  return (
    <>
      {/* Simple gradient background instead of 3D */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50" />
      
      <motion.main 
        className="container mx-auto px-4 py-16 -mt-16 relative"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={{
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -20 }
        }}
        transition={{ duration: 0.5 }}
      >
        <Breadcrumb items={breadcrumbItems} />

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative mb-16 py-24 overflow-hidden rounded-2xl"
        >
          <div className="absolute inset-0 z-0">
            <Image
              src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1600&q=80"
              alt="Technology background"
              fill
              sizes="100vw"
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-violet-700/80 via-indigo-600/80 to-cyan-600/80" />
          </div>

          <div className="relative z-10 text-center px-4">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-white">
              Our Services
            </h1>
            <p className="text-xl text-gray-100 max-w-3xl mx-auto">
            Government Focused IT Consulting and Enterprise Platform Solutions
            </p>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-16 p-8 rounded-2xl bg-white/95 backdrop-blur-sm shadow-xl"
        >
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-lg text-gray-800 leading-relaxed font-medium">
            At BQI Tech, we provide advanced software development and IT consulting services tailored to
            the needs of government agencies and public sector organizations. With deep expertise in
            enterprise platform solutions, we help institutions in Kenya and the United States modernize
            operations, improve service delivery, and achieve digital transformation at scale.

            </p>
          </div>
        </motion.section>

        {services.map((service, index) => (
          <motion.section
            key={service.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 * index }}
            className="mb-24 group"
          >
            <div className="relative p-8 rounded-2xl bg-white/95 backdrop-blur-sm shadow-lg
                            hover:bg-white/98 transition-all duration-500
                            before:absolute before:inset-0 before:rounded-2xl
                            before:bg-gradient-to-r before:from-violet-500/20 before:to-cyan-500/20
                            before:opacity-0 before:transition-opacity hover:before:opacity-100"
            >
              <div className="grid md:grid-cols-2 gap-12 items-center relative">
                <div className={`space-y-6 ${index % 2 === 0 ? 'md:order-1' : 'md:order-2'}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500">
                      <service.icon className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-800">{service.title}</h2>
                  </div>
                  <p className="text-lg text-gray-800 font-medium">{service.description}</p>
                  <ul className="space-y-4">
                    {service.details.map((detail, i) => (
                      <motion.li 
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-3 text-gray-800"
                      >
                        <span className="mt-1.5 h-3 w-3 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 flex-shrink-0" />
                        <span className="font-medium">{detail}</span>
                      </motion.li>
                    ))}
                  </ul>
                  {service.footer && (
                    <p className="text-lg text-gray-700 font-medium mt-6">{service.footer}</p>
                  )}
                </div>
                {service.image && (
                  <div className={`relative h-[400px] group ${index % 2 === 0 ? 'md:order-2' : 'md:order-1'}`}>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.3 }}
                      className="relative h-full rounded-lg overflow-hidden shadow-xl"
                    >
                      <Image
                        src={service.image}
                        alt={service.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </motion.div>
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        ))}

        {/* Why Choose BQI Tech Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-16 p-8 rounded-2xl relative overflow-hidden bg-gradient-to-r from-blue-500 to-blue-700"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/85 to-blue-800/85 z-0" />
          <motion.div
            initial={{ backgroundPosition: "0% 0%" }}
            animate={{ backgroundPosition: "100% 100%" }}
            transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
            className="absolute inset-0 bg-gradient-to-r from-blue-400/5 to-blue-500/5 z-10"
          />
          
          <div className="max-w-4xl mx-auto relative z-20">
            <h2 className="text-3xl font-bold mb-8 text-white flex items-center gap-3">
              <span className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </span>
              Why Choose BQI Tech?
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  title: "Expertise in Public Sector IT",
                  description: "We’ve designed and deployed systems for government agencies with complex regulatory and security needs."
                },
                {
                  title: "End to End Services",
                  description: "From strategic consulting to post deployment support, we provide complete IT lifecycle management."
                },
                {
                  title: "Kenya and U.S. Coverage",
                  description: "We operate across two key regions, understanding the local frameworks, policies, and technology ecosystems in both."
                },
                {
                  title: "Compliance & Security Focus",
                  description: "Our solutions are built with public sector data governance, access controls, and audit readiness in mind."
                }
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/20 backdrop-blur-sm rounded-xl p-6 hover:bg-white/30 
                             transition-all duration-300 border border-white/30 hover:border-white/40
                             hover:shadow-lg hover:shadow-white/10"
                >
                  <h3 className="text-xl font-bold mb-3 text-white">{item.title}</h3>
                  <p className="text-white/90 font-medium leading-relaxed">{item.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Contact Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-12 mb-24 p-12 rounded-2xl bg-white/90 backdrop-blur-sm"
        >
          <h2 className="text-3xl font-bold mb-4">Interested in Our Services?</h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          BQI Tech is ready to support your next public sector IT project. Whether you're planning a system
          upgrade, a new citizen service platform, or want to improve internal operations, our team is here to help.
          Contact us today to discuss how our software development, IT consulting, and enterprise platform
          services can support your institution.

          </p>
          <div className="flex justify-center gap-6">
            <Link href="/contact-us">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-700 hover:to-cyan-600 
                           text-white rounded-full px-12 py-4 text-lg font-semibold inline-flex items-center gap-2 
                           shadow-lg shadow-violet-500/20 transition-all duration-300"
              >
                Contact Us Today
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>
          </div>
        </motion.section>
      </motion.main>
    </>
  )
}