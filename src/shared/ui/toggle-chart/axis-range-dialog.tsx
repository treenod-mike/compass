'use client'

import React from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui/dialog'

interface AxisRangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingAxis: 'left' | 'right'
  leftYMin: string
  leftYMax: string
  rightYMin: string
  rightYMax: string
  setLeftYMin: (v: string) => void
  setLeftYMax: (v: string) => void
  setRightYMin: (v: string) => void
  setRightYMax: (v: string) => void
}

export function AxisRangeDialog({
  open,
  onOpenChange,
  editingAxis,
  leftYMin,
  leftYMax,
  rightYMin,
  rightYMax,
  setLeftYMin,
  setLeftYMax,
  setRightYMin,
  setRightYMax,
}: AxisRangeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-extrabold">
            {editingAxis === 'left' ? '메인축 범위 설정' : '보조축 범위 설정'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {(['min', 'max'] as const).map((bound) => {
            const isLeft = editingAxis === 'left'
            const value = bound === 'min' ? (isLeft ? leftYMin : rightYMin) : (isLeft ? leftYMax : rightYMax)
            const setter = bound === 'min'
              ? (isLeft ? setLeftYMin : setRightYMin)
              : (isLeft ? setLeftYMax : setRightYMax)
            return (
              <div key={bound} className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {bound === 'min' ? '최소값' : '최대값'}
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="자동"
                  value={value}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '')
                    setter(raw !== '' ? Number(raw).toLocaleString() : '')
                  }}
                  className="w-full rounded-full"
                />
              </div>
            )
          })}
          <div className="text-xs text-muted-foreground">* 비워두면 자동으로 설정됩니다</div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            className="font-extrabold"
            onClick={() => {
              if (editingAxis === 'left') { setLeftYMin(''); setLeftYMax('') }
              else { setRightYMin(''); setRightYMax('') }
            }}
          >
            초기화
          </Button>
          <Button
            className="font-extrabold bg-brand-line text-primary-foreground"
            onClick={() => onOpenChange(false)}
          >
            적용
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
