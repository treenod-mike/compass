'use client'

import { useState, useMemo, useEffect } from 'react'
import { roundUpToNiceNumber, generateUniformTicks, debug } from '@/shared/lib'
import { DUAL_AXIS_THRESHOLD, CHART_MARGINS } from './constants'
import { calcDynamicYAxisWidth } from './chart-utils'
import type { ChartDataItem, ToggleChartProps } from './types'

/**
 * ToggleChart의 핵심 계산 상태를 캡슐화한 커스텀 훅
 */
export function useChartState(props: ToggleChartProps & { activeChartType: string; selectedVisibility?: string }) {
  const {
    data, nameKey = 'label', dataKey = 'value', dataKey2,
    stackKeys = [], selectConfig, isStackedBar = false,
    hideSegmentFilter = false, enableDualAxis = false,
    composedConfig, activeChartType, title = '',
    isPuChart = false, leftMargin = 0, rightMargin = 0,
    selectedVisibility, fixedLeftYMax,
  } = props

  const [selectedOptions, setSelectedOptions] = useState<string[]>(() => {
    if (selectConfig?.isMultiSelect) return [selectConfig.defaultValue]
    if (stackKeys && stackKeys.length > 0) return isStackedBar ? ['전체'] : [stackKeys[0]]
    return []
  })
  const [leftYMin, setLeftYMin] = useState('')
  const [leftYMax, setLeftYMax] = useState('')
  const [rightYMin, setRightYMin] = useState('')
  const [rightYMax, setRightYMax] = useState('')

  // stackKeys가 빈 배열로 마운트 후 데이터 로드 시 채워질 때 초기화
  const stackKeysKey = stackKeys.join(',')
  useEffect(() => {
    if (isStackedBar && stackKeys.length > 0 && selectedOptions.length === 0) {
      setSelectedOptions(['전체'])
    }
  }, [stackKeysKey, isStackedBar])

  const selectConfigValueKey = selectConfig?.value?.join(',') || ''
  useEffect(() => {
    if (!selectConfig?.isMultiSelect) return
    if (selectConfig.value && selectConfig.value.length > 0) {
      debug.state('ToggleChart', 'selectConfig.value로 selectedOptions 업데이트', selectConfig.value)
      setSelectedOptions(selectConfig.value)
      return
    }
    if (selectedOptions.length === 0 && selectConfig.defaultValue) {
      debug.state('ToggleChart', 'defaultValue로 초기화', selectConfig.defaultValue)
      setSelectedOptions([selectConfig.defaultValue])
    }
  }, [selectConfig?.isMultiSelect, selectConfig?.defaultValue, selectConfigValueKey, selectConfig])

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return data
    if (hideSegmentFilter) return data
    const hasSegmentFilter = selectConfig?.isMultiSelect || (stackKeys && stackKeys.length > 0)
    const hasCategorySelection = selectedOptions.some(opt => opt.startsWith('['))
    if (hasSegmentFilter && selectedOptions.length > 0 && !selectedOptions.includes('전체') && !hasCategorySelection) {
      return data.map((item) => {
        const newItem: ChartDataItem = { [nameKey]: item[nameKey] }
        selectedOptions.forEach((segment) => { if (item[segment] !== undefined) newItem[segment] = item[segment] })
        return newItem
      })
    }
    return data
  }, [data, hideSegmentFilter, selectConfig?.isMultiSelect, stackKeys, selectedOptions, nameKey])

  const activeKeys = useMemo(() => {
    if (hideSegmentFilter && stackKeys && stackKeys.length > 0) return stackKeys
    const currentSelection = selectConfig?.value || selectedOptions
    if (!stackKeys.length) return []
    const hasSegmentFilter = selectConfig?.isMultiSelect || (stackKeys && stackKeys.length > 0)
    if (!hasSegmentFilter || currentSelection.length === 0) return stackKeys
    if (currentSelection.length === 1 && currentSelection.includes('전체')) {
      if (isStackedBar && stackKeys.length > 0) return stackKeys
      const hasAllKey = filteredData.length > 0 && filteredData[0].hasOwnProperty('전체')
      return hasAllKey ? ['전체'] : stackKeys
    }
    if (currentSelection.includes('전체')) return currentSelection
    const hasCategorySelection = currentSelection.some(opt => opt.startsWith('['))
    if (hasCategorySelection) {
      const individuals = currentSelection.filter(opt => !opt.startsWith('['))
      return Array.from(new Set([...stackKeys, ...individuals]))
    }
    return stackKeys.filter(key => currentSelection.includes(key))
  }, [stackKeys, selectConfig?.isMultiSelect, selectConfig?.value, selectedOptions, hideSegmentFilter, filteredData, isStackedBar])

  const sortedActiveKeys = useMemo(() => {
    if (activeKeys.length === 0 || filteredData.length === 0) return activeKeys
    if (stackKeys.length > 0) {
      const activeSet = new Set(activeKeys)
      const fromStackKeys = stackKeys.filter(key => activeSet.has(key))
      const notInStackKeys = activeKeys.filter(key => !stackKeys.includes(key))
      const sortedExtra = notInStackKeys.map(key => {
        let sum = 0, count = 0
        filteredData.forEach(item => { const v = Number(item[key]); if (!isNaN(v)) { sum += v; count++ } })
        return { key, average: count > 0 ? sum / count : 0 }
      }).sort((a, b) => a.average - b.average).map(x => x.key)
      return [...fromStackKeys, ...sortedExtra]
    }
    const averages: Record<string, number> = {}
    activeKeys.forEach(key => {
      let sum = 0, count = 0
      filteredData.forEach(item => { const v = Number(item[key]); if (!isNaN(v)) { sum += v; count++ } })
      averages[key] = count > 0 ? sum / count : 0
    })
    return [...activeKeys].sort((a, b) => averages[a] - averages[b])
  }, [activeKeys, filteredData, stackKeys])

  const shouldUseDualAxis = useMemo(() => {
    if (activeChartType === 'composed' && composedConfig) return true
    if (isStackedBar) return false
    if (!enableDualAxis || activeKeys.length < 2 || !filteredData.length) return false
    const ranges: { [key: string]: { min: number; max: number } } = {}
    filteredData.forEach((item) => {
      activeKeys.forEach((key) => {
        const value = Number(item[key]) || 0
        if (!ranges[key]) ranges[key] = { min: value, max: value }
        else { ranges[key].min = Math.min(ranges[key].min, value); ranges[key].max = Math.max(ranges[key].max, value) }
      })
    })
    const keys = Object.keys(ranges)
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const max1 = Math.abs(ranges[keys[i]].max) || 1
        const max2 = Math.abs(ranges[keys[j]].max) || 1
        if (Math.max(max1, max2) / Math.min(max1, max2) > DUAL_AXIS_THRESHOLD) return true
        const r1 = ranges[keys[i]].max - ranges[keys[i]].min
        const r2 = ranges[keys[j]].max - ranges[keys[j]].min
        if (r1 > 0 && r2 > 0 && Math.max(r1, r2) / Math.min(r1, r2) > DUAL_AXIS_THRESHOLD) return true
      }
    }
    return false
  }, [enableDualAxis, activeKeys, filteredData, activeChartType, composedConfig])

  const rightAxisKey = useMemo(() => {
    if (!shouldUseDualAxis || activeKeys.length < 2) return null
    const ranges: { [key: string]: number } = {}
    filteredData.forEach((item) => {
      activeKeys.forEach((key) => { ranges[key] = Math.max(ranges[key] || 0, Math.abs(Number(item[key]) || 0)) })
    })
    let minKey = activeKeys[0], minValue = ranges[minKey] || 0
    activeKeys.forEach((key) => { if (ranges[key] < minValue) { minValue = ranges[key]; minKey = key } })
    return minKey
  }, [shouldUseDualAxis, activeKeys, filteredData])

  const calcMax = (keys: string[]) => {
    let dataMax = 0
    filteredData.forEach((item) => { keys.forEach(key => { dataMax = Math.max(dataMax, Number(item[key]) || 0) }) })
    return roundUpToNiceNumber(dataMax * 1.05)
  }

  const parseY = (v: string) => v !== '' ? Number(v.replace(/,/g, '')) : undefined

  const leftDomain = useMemo((): [number | 'auto', number | 'auto'] => {
    const min = parseY(leftYMin)
    const max = parseY(leftYMax)
    if (min !== undefined && max !== undefined) return [min, max]
    if (min !== undefined) return [min, 'auto']
    if (max !== undefined) return ['auto', max]
    if (!filteredData || filteredData.length === 0) return [0, 'auto']
    let dataMax = 0, dataMin = Infinity
    if (activeChartType === 'composed' && composedConfig) {
      const leftKeys = [
        ...(composedConfig.bars?.filter(b => !b.yAxisId || b.yAxisId === 'left').map(b => b.dataKey) || []),
        ...(composedConfig.lines?.filter(l => !l.yAxisId || l.yAxisId === 'left').map(l => l.dataKey) || []),
      ]
      return [0, leftKeys.length > 0 ? calcMax(leftKeys) : 'auto']
    }
    if (isStackedBar && activeChartType === 'bar' && activeKeys.length > 0) {
      filteredData.forEach((item) => {
        let s = 0
        activeKeys.forEach(key => { const v = Number(item[key]); if (!isNaN(v)) s += v })
        dataMax = Math.max(dataMax, s)
      })
    } else if (stackKeys.length > 0 && activeKeys.length > 0) {
      filteredData.forEach((item) => {
        activeKeys.forEach(key => {
          const v = Number(item[key])
          if (!isNaN(v) && isFinite(v)) { dataMax = Math.max(dataMax, v); dataMin = Math.min(dataMin, v) }
        })
      })
      if (dataMax === 0 && dataMin === Infinity) dataMin = 0
    } else {
      filteredData.forEach((item) => {
        let domainKeys = [dataKey]
        if (dataKey2) {
          if (isPuChart && selectedVisibility) {
            domainKeys = selectedVisibility === 'Non PU' ? [dataKey2] : [dataKey]
          } else {
            domainKeys = [dataKey, dataKey2]
          }
        }
        const v = Math.max(...domainKeys.map(k => Number(item[k]) || 0))
        dataMax = Math.max(dataMax, v)
        dataMin = Math.min(dataMin, Math.min(...domainKeys.map(k => Number(item[k]) || 0)))
      })
    }
    debug.chart(title, 'Y축 도메인 계산', { dataMax, dataMin, activeKeysCount: activeKeys.length })
    if (fixedLeftYMax !== undefined) return [0, fixedLeftYMax]
    const computedMax = roundUpToNiceNumber(dataMax * 1.05)
    // 음수값 지원: dataMin < 0 이면 하한도 계산 (인플레이션 추세 등)
    if (dataMin < Infinity && dataMin < 0) {
      const computedMin = -roundUpToNiceNumber(Math.abs(dataMin) * 1.1)
      return [computedMin, computedMax > 0 ? computedMax : 'auto']
    }
    return [0, computedMax > 0 ? computedMax : 'auto']
  }, [leftYMin, leftYMax, fixedLeftYMax, filteredData, isStackedBar, activeChartType, composedConfig, stackKeys, activeKeys, dataKey, dataKey2, isPuChart, selectedVisibility])

  const rightDomain = useMemo((): [number | 'auto', number | 'auto'] => {
    const min = parseY(rightYMin)
    const max = parseY(rightYMax)
    if (min !== undefined && max !== undefined) return [min, max]
    if (min !== undefined) return [min, 'auto']
    if (max !== undefined) return ['auto', max]
    if (!shouldUseDualAxis || !filteredData || filteredData.length === 0) return [0, 'auto']
    if (activeChartType === 'composed' && composedConfig) {
      const rightKeys = [
        ...(composedConfig.bars?.filter(b => b.yAxisId === 'right').map(b => b.dataKey) || []),
        ...(composedConfig.lines?.filter(l => l.yAxisId === 'right').map(l => l.dataKey) || []),
      ]
      if (rightKeys.length > 0) return [0, calcMax(rightKeys)]
    }
    if (rightAxisKey) return [0, calcMax([rightAxisKey])]
    return [0, 'auto']
  }, [rightYMin, rightYMax, activeChartType, composedConfig, shouldUseDualAxis, filteredData, rightAxisKey])

  const leftTicks = useMemo(() => {
    const max = typeof leftDomain[1] === 'number' ? leftDomain[1] : 0
    if (max === 0) return undefined
    const ticks = generateUniformTicks(typeof leftDomain[0] === 'number' ? leftDomain[0] : 0, max, 6)
    return ticks.length > 0 ? ticks : undefined
  }, [leftDomain])

  const rightTicks = useMemo(() => {
    if (!shouldUseDualAxis) return undefined
    const max = typeof rightDomain[1] === 'number' ? rightDomain[1] : 0
    if (max === 0) return undefined
    const ticks = generateUniformTicks(typeof rightDomain[0] === 'number' ? rightDomain[0] : 0, max, 6)
    return ticks.length > 0 ? ticks : undefined
  }, [shouldUseDualAxis, rightDomain])

  const dynamicYAxisWidth = useMemo(() => calcDynamicYAxisWidth(leftTicks), [leftTicks])
  const dynamicRightYAxisWidth = useMemo(() => shouldUseDualAxis ? calcDynamicYAxisWidth(rightTicks) : 0, [shouldUseDualAxis, rightTicks])
  const dynamicLeftMargin = useMemo(() => {
    if (leftMargin > 0) return leftMargin
    return CHART_MARGINS.LEFT_BASE
  }, [leftMargin])
  const dynamicRightMargin = useMemo(() => {
    if (rightMargin > 0) return rightMargin
    return shouldUseDualAxis ? CHART_MARGINS.RIGHT_DUAL : CHART_MARGINS.RIGHT_SINGLE
  }, [rightMargin, shouldUseDualAxis])

  return {
    selectedOptions, setSelectedOptions,
    leftYMin, setLeftYMin, leftYMax, setLeftYMax,
    rightYMin, setRightYMin, rightYMax, setRightYMax,
    filteredData, activeKeys, sortedActiveKeys,
    shouldUseDualAxis, rightAxisKey,
    leftDomain, rightDomain, leftTicks, rightTicks,
    dynamicYAxisWidth, dynamicRightYAxisWidth, dynamicLeftMargin, dynamicRightMargin,
  }
}
