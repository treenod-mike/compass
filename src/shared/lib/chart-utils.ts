/**
 * 차트 Y축 최댓값을 깔끔한 숫자로 올림 처리
 * @param value - 원본 최댓값
 * @returns 올림 처리된 깔끔한 숫자
 */
export function roundUpToNiceNumber(value: number): number {
  if (value === 0) return 0

  // 최댓값의 magnitude (자릿수) 구하기
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))

  // magnitude의 배수 중 value보다 큰 가장 작은 값 찾기
  // 3, 4 추가로 2.5→5 사이 과도한 올림 방지
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10]
  for (const step of steps) {
    const candidate = magnitude * step
    if (candidate >= value) {
      return candidate
    }
  }

  // 기본값 (도달하지 않음)
  return magnitude * 10
}

/**
 * Y축 눈금 간격을 균일하게 생성
 * @param min - 최소값
 * @param max - 최대값
 * @param tickCount - 원하는 눈금 개수 (기본값: 6)
 * @returns 균일한 간격의 눈금 배열
 */
export function generateUniformTicks(min: number, max: number, tickCount: number = 6): number[] {
  if (min === max) return [min]

  // 균일한 간격 계산
  const rawStep = (max - min) / (tickCount - 1)

  // 깔끔한 간격으로 반올림 (1, 2, 5 배수)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  let niceStep = magnitude

  if (rawStep / magnitude >= 5) {
    niceStep = magnitude * 5
  } else if (rawStep / magnitude >= 2) {
    niceStep = magnitude * 2
  }

  // 깔끔한 간격으로 눈금 생성 (niceStep의 배수로 정확히 생성)
  const ticks: number[] = []

  // niceStep의 정수 배수로 직접 계산하여 부동소수점 오차 방지
  const ticksCount = Math.floor((max - min) / niceStep) + 1
  for (let i = 0; i < ticksCount; i++) {
    ticks.push(min + i * niceStep)
  }

  // max가 정확히 포함되지 않았다면 추가
  const lastTick = ticks[ticks.length - 1]
  if (Math.abs(lastTick - max) > niceStep * 0.001 && lastTick < max) {
    ticks.push(max)
  }

  return ticks
}
