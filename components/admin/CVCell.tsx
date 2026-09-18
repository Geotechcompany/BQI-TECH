"use client";

import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { SimpleCVModal } from "./SimpleCVModal";
import { Eye } from "lucide-react";

interface CVCellProps {
  cvUrl: string;
  candidateName?: string;
}

export function CVCell({ cvUrl, candidateName }: CVCellProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  if (!cvUrl) {
    return <span className="text-muted-foreground">N/A</span>;
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        onClick={handleOpenModal}
        aria-label="View CV"
        title="View CV"
      >
        <Eye className="h-4 w-4" />
      </Button>
      
      <SimpleCVModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        cvUrl={cvUrl}
        candidateName={candidateName}
      />
    </>
  );
}
