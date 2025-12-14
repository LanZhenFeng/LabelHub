import { useEffect, useRef } from 'react'
import { useUserStore } from '@/stores/userStore' // M4: For JWT token

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

  const { accessToken } = useUserStore() // M4: Get JWT token
  const prefetchedRef = useRef<Set<string>>(new Set())
  const prefetchLinksRef = useRef<HTMLLinkElement[]>([])

  useEffect(() => {
    if (!currentImageUrl || !accessToken) return

    // 检查网络连接类型
    let effectivePrefetchCount = prefetchCount
    if (bandwidthAware && 'connection' in navigator) {
      const connection = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number } }).connection
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

    // 预取后续图片（使用 fetch 附加 JWT token）
    const urlsToPrefetch = upcomingImageUrls.slice(0, effectivePrefetchCount)

    urlsToPrefetch.forEach((url) => {
      if (prefetchedRef.current.has(url)) return

      // M4: Use fetch with JWT token for prefetching
      fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then((response) => {
          if (response.ok) {
            return response.blob()
          }
          throw new Error(`Failed to prefetch: ${response.status}`)
        })
        .then(() => {
          // Mark as prefetched
          prefetchedRef.current.add(url)
          console.log(`Prefetched: ${url}`)
        })
        .catch((error) => {
          console.warn(`Failed to prefetch image: ${url}`, error)
        })
    })

    // 清理函数
    return () => {
      // 保留预取的链接，但如果组件卸载则清除
      // prefetchLinksRef.current.forEach(link => link.remove())
    }
  }, [currentImageUrl, upcomingImageUrls, prefetchCount, bandwidthAware, bandwidthThreshold, accessToken])

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

  const connection = (navigator as Navigator & {
    connection?: {
      effectiveType?: string
      downlink?: number
      rtt?: number
      saveData?: boolean
    }
  }).connection
  
  return {
    effectiveType: connection?.effectiveType || 'unknown', // '4g', '3g', '2g', 'slow-2g'
    downlink: connection?.downlink, // Mbps
    rtt: connection?.rtt, // ms
    saveData: connection?.saveData || false, // 用户是否启用了数据节省模式
  }
}

