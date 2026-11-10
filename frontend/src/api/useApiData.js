import { useCallback, useEffect, useState } from "react";

export function useApiData(loader, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
      }
      try {
        const result = await loader();
        setData(result);
        setError(null);
        return result;
      } catch (caughtError) {
        setError(caughtError.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    dependencies
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load, setData };
}
