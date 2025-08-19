"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

interface DeleteJobPostingModalProps {
  jobTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteJobPostingModal({ jobTitle, isOpen, onClose, onConfirm }: DeleteJobPostingModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete Job Posting
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="rounded-xl bg-red-50 border border-red-100 p-4 text-red-800"
          >
            <p className="text-sm">
              You are about to permanently delete
              {jobTitle ? (
                <>
                  {' '}<span className="font-semibold">{jobTitle}</span>
                </>
              ) : null}
              . This action cannot be undone.
            </p>
          </motion.div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700">
            <ul className="list-disc pl-5 space-y-1">
              <li>The job will be removed from public listings.</li>
              <li>Associated questions remain, but will no longer be linked.</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          <Button variant="outline" onClick={onClose} className="rounded-lg">Cancel</Button>
          <Button onClick={onConfirm} variant="destructive" className="rounded-lg gap-2">
            <Trash2 className="h-4 w-4" />
            Delete Job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


