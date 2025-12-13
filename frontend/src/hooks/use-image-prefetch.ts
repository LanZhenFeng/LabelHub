import { useEffect, useRef } from 'react'

interface PrefetchOptions {
  /**
   * 预取后续多少张图片
   */
  prefetchCount?: number
  /**
   * 是否启用带宽感知（慢速网络降低预取）
   */
  bandwidthAware?: boolean
  /**
   * 带宽阈值（Mbps），低于此值降低预取数量
   */
  bandwidthThreshold?: number
}

/**
 * 图片预取 Hook
 * 当当前图片加载完成后，预取后续图片
 */
export function useImagePrefetch(
  currentImageUrl: string | undefined,
  upcomingImageUrls: string[],
  options: PrefetchOptions = {}
) {
  const {
    prefetchCount = 3,
    bandwidthAware = true,
    bandwidthThreshold = 2, // 2 Mbps
  } = options

  const prefetchedRef = useRef<Set<string>>(new Set())
  const prefetchLinksRef = useRef<HTMLLinkElement[]>([])

  useEffect(() => {
    if (!currentImageUrl) return

    // 检查网络连接类型
    let effectivePrefetchCount = prefetchCount
    if (bandwidthAware && 'connection' in navigator) {
      const connection = (navigator as any).connection
      if (connection) {
        const effectiveType = connection.effectiveType // '4g', '3g', '2g', 'slow-2g'
        const downlink = connection.downlink // Mbps

        // 根据网络状况调整预取数量
        if (effectiveType === 'slow-2g' || effectiveType === '2g') {
          effectivePrefetchCount = 0 // 慢速网络不预取
        } else if (effectiveType === '3g' || (downlink && downlink < bandwidthThreshold)) {
          effectivePrefetchCount = 1 // 中速网络只预取1张
        }
      }
    }

    // 清除旧的预取链接
    prefetchLinksRef.current.forEach((link) => link.remove())
    prefetchLinksRef.current = []

    // 预取后续图片
    const urlsToPrefetch = upcomingImageUrls.slice(0, effectivePrefetchCount)

    urlsToPrefetch.forEach((url) => {
      if (prefetchedRef.current.has(url)) return

      // 使用 <link rel="prefetch"> 方式
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.as = 'image'
      link.href = url
      document.head.appendChild(link)
      prefetchLinksRef.current.push(link)

      // 标记为已预取
      prefetchedRef.current.add(url)

      // 备用方案：使用 Image 对象预加载
      const img = new Image()
      img.src = url
    })

    // 清理函数
    return () => {
      // 保留预取的链接，但如果组件卸载则清除
      // prefetchLinksRef.current.forEach(link => link.remove())
    }
  }, [currentImageUrl, upcomingImageUrls, prefetchCount, bandwidthAware, bandwidthThreshold])

  // 清理函数：组件卸载时清理所有预取
  useEffect(() => {
    return () => {
      prefetchLinksRef.current.forEach((link) => link.remove())
      prefetchLinksRef.current = []
    }
  }, [])

  return {
    prefetchedCount: prefetchedRef.current.size,
  }
}

/**
 * 获取网络连接信息
 */
export function getNetworkInfo() {
  if (!('connection' in navigator)) {
    return {
      effectiveType: 'unknown',
      downlink: undefined,
      rtt: undefined,
      saveData: false,
    }
  }

  const connection = (navigator as any).connection
  return {
    effectiveType: connection.effectiveType || 'unknown', // '4g', '3g', '2g', 'slow-2g'
    downlink: connection.downlink, // Mbps
    rtt: connection.rtt, // ms
    saveData: connection.saveData || false, // 用户是否启用了数据节省模式
  }
}

