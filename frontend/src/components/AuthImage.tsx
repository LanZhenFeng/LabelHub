/**
 * AuthImage - Image component that handles authenticated image loading
 * 
 * M4: Fetches images with JWT token attached, creates object URL for display
 * Handles caching via IndexedDB
 */

import { useEffect, useState } from 'react'
import { useUserStore } from '@/stores/userStore'

interface AuthImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
}

export function AuthImage({ src, alt, ...props }: AuthImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const { accessToken } = useUserStore()

  useEffect(() => {
    if (!src) return

    let isMounted = true
    let url: string | null = null

    const loadImage = async () => {
      try {
        setIsLoading(true)
        setError(false)

        const response = await fetch(src, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to load image: ${response.status}`)
        }

        const blob = await response.blob()
        
        if (isMounted) {
          url = URL.createObjectURL(blob)
          setObjectUrl(url)
          setIsLoading(false)
        }
      } catch (err) {
        console.error('Failed to load authenticated image:', err)
        if (isMounted) {
          setError(true)
          setIsLoading(false)
        }
      }
    }

    loadImage()

    // Cleanup: revoke object URL when component unmounts or src changes
    return () => {
      isMounted = false
      if (url) {
        URL.revokeObjectURL(url)
      }
    }
  }, [src, accessToken])

  if (isLoading) {
    return (
      <div
        className="bg-muted animate-pulse rounded"
        style={{ width: props.width || '100%', height: props.height || '100%' }}
      />
    )
  }

  if (error || !objectUrl) {
    return (
      <div
        className="bg-muted rounded flex items-center justify-center text-muted-foreground text-xs"
        style={{ width: props.width || '100%', height: props.height || '100%' }}
      >
        Failed to load
      </div>
    )
  }

  return <img src={objectUrl} alt={alt} {...props} />
}

