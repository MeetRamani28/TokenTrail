import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import App from './App';

// Mock Three.js canvas for jsdom test environment
vi.mock('./components/three/TokenTrailCanvas', () => ({
  TokenTrailCanvas: () => <div data-testid="token-trail-canvas" />,
}));

beforeAll(() => {
  // Mock matchMedia for jsdom
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  // Mock ResizeObserver for jsdom
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
});

describe('App', () => {
  it('renders landing page with title and launch button', () => {
    render(<App />);
    expect(screen.getAllByText('TokenTrail').length).toBeGreaterThan(0);
    expect(screen.getByText(/Track LLM Latency, Costs & Spans/i)).toBeDefined();
    expect(screen.getByText(/Launch Dashboard/i)).toBeDefined();
  });
});
