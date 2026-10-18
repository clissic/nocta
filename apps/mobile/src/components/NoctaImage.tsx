import { useEffect, useState } from "react";
import { Image, type ImageProps } from "expo-image";
import {
  imageDiskCacheKey,
  resolveImageUri,
  type ImageVariant,
} from "../lib/media";

type Props = Omit<ImageProps, "source"> & {
  src?: string | null;
  variant?: ImageVariant;
  /** Si falla la fuente principal (p. ej. portada de catálogo ausente). */
  fallbackSrc?: string | null;
};

export function NoctaImage({
  src,
  variant = "medium",
  fallbackSrc,
  onError,
  ...rest
}: Props) {
  const primary = resolveImageUri(src, variant);
  const fallback = fallbackSrc ? resolveImageUri(fallbackSrc, variant) : "";
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [primary, fallback]);

  const uri = failed && fallback ? fallback : primary;
  const cacheKey = imageDiskCacheKey(failed && fallbackSrc ? fallbackSrc : src, variant);
  if (!uri) return null;

  return (
    <Image
      {...rest}
      source={cacheKey ? { uri, cacheKey } : { uri }}
      cachePolicy="memory-disk"
      recyclingKey={cacheKey || uri}
      onError={(event) => {
        if (!failed && fallback && uri !== fallback) {
          setFailed(true);
        }
        onError?.(event);
      }}
      {...rest}
    />
  );
}
