import { useState, useCallback } from 'react';

export function useImageFallback() {
  const [hasError, setHasError] = useState(false);
  const handleError = useCallback(() => setHasError(true), []);
  return { hasError, handleError };
}
