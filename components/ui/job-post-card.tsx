"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface JobPostCardProps {
  title: string;
  count: number;
  subtitle?: string;
  index?: number;
  className?: string;
}

const JOB_CARD_IMAGES = [
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=800&q=80",
];

const formatCount = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 15, staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export const JobPostCard: React.FC<JobPostCardProps> = ({
  title,
  count,
  subtitle = "applications",
  index = 0,
  className,
}) => {
  const imageUrl = JOB_CARD_IMAGES[index % JOB_CARD_IMAGES.length];

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.03, transition: { duration: 0.3 } }}
      className={cn(
        "relative w-full h-36 rounded-2xl overflow-hidden p-4 text-white shadow-lg flex items-end isolate",
        className
      )}
    >
      <div className="absolute inset-0 z-[-1] bg-[#272055]">
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[#272055]/70 dark:bg-[#1e1844]/80" />
      </div>
      <div className="w-full grid grid-cols-3 gap-2 items-end">
        <div className="col-span-2 flex flex-col justify-end h-full min-w-0">
          <motion.h2
            variants={itemVariants}
            className="text-sm font-bold leading-tight line-clamp-2"
            title={title}
          >
            {title}
          </motion.h2>
          <motion.p variants={itemVariants} className="mt-0.5 text-[10px] uppercase tracking-wider opacity-80">
            {subtitle}
          </motion.p>
        </div>
        <motion.div
          variants={itemVariants}
          className="col-span-1 flex items-center justify-end"
        >
          <span className="text-4xl font-bold tracking-tighter text-white/90 select-none tabular-nums">
            {formatCount(count)}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
};
