"use client"

import { Dialog } from "@base-ui/react/dialog"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { ResponseCurveCard } from "./response-curve-card"
import type { MmmChannel } from "@/shared/api/mmm-data"

type ChannelDetailModalProps = {
  channel: MmmChannel | null
  onClose: () => void
}

const transition = { duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }

export function ChannelDetailModal({ channel, onClose }: ChannelDetailModalProps) {
  const open = channel !== null
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal>
            <Dialog.Backdrop
              render={
                <motion.div
                  className="fixed inset-0 z-50 bg-black/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                />
              }
            />
            <Dialog.Popup
              render={
                <motion.div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                >
                  <motion.div
                    className={cn(
                      "relative w-full max-w-5xl",
                      "rounded-[var(--radius-card)] border border-[var(--border-default)]",
                      "bg-[var(--bg-1)] shadow-[0_16px_64px_rgba(0,0,0,0.12)]",
                    )}
                    initial={{ opacity: 0, scale: 0.96, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={transition}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-end p-2">
                      <Dialog.Close
                        className="rounded-[var(--radius-inline)] p-1.5 text-[var(--fg-3)] hover:bg-[var(--bg-3)] hover:text-[var(--fg-1)] transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </Dialog.Close>
                    </div>
                    <div className="px-6 pb-6">
                      {channel && (
                        <ResponseCurveCard
                          channel={channel}
                          expanded={true}
                          onToggle={onClose}
                        />
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              }
            />
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
