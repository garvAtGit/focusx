import { useState, useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import type { CommandStudent } from './CommandPalette'; // Assuming we can use this type

interface SearchResponse {
  students: CommandStudent[];
  error?: string;
}

export function useStudentSearch(query: string) {
  const [debouncedQuery] = useDebounce(query, 300);
  const [results, setResults] = useState<CommandStudent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!debouncedQuery || debouncedQuery.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }

    async function search() {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/dashboard/students/search?q=${encodeURIComponent(debouncedQuery)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch students');
        }
        
        const data: SearchResponse = await response.json();
        
        if (active) {
          setResults(data.students || []);
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    search();

    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  return { results, isLoading, error };
}
