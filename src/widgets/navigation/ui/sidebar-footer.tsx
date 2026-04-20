'use client'

interface SidebarFooterProps {
  isFullyCollapsed: boolean
  showExpandedContent: boolean
}

/**
 * 현재는 빈 사이드바 하단 — 포트폴리오 데모에서 불필요한 테마 토글 / 사용자
 * 프로필을 제거했다. 추후 배지나 버전 정보 등이 필요해지면 여기에 추가.
 */
export function SidebarFooter(_: SidebarFooterProps) {
  return <div className="pb-4" aria-hidden />
}
