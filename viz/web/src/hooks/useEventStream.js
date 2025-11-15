import { useState, useEffect, useRef } from 'react';

export function useEventStream(url, sessionFilter = null) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    const eventUrl = sessionFilter
      ? `${url}?session=${sessionFilter}`
      : url;

    const eventSource = new EventSource(eventUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE connected');
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'event') {
          setLastEvent(data.data);
        }
      } catch (error) {
        console.error('Error parsing SSE event:', error);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      setConnected(false);
    };

    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, [url, sessionFilter]);

  return { connected, lastEvent };
}
