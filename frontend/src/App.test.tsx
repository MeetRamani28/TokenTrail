import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders TokenTrail header and title', () => {
    render(<App />)
    expect(screen.getByText('TokenTrail')).toBeDefined()
    expect(screen.getByText(/LLM Observability/i)).toBeDefined()
  })

  it('increments test counter on button click', () => {
    render(<App />)
    const button = screen.getByRole('button', { name: /Interactive Test Counter/i })
    expect(button.textContent).toContain('0')
    fireEvent.click(button)
    expect(button.textContent).toContain('1')
  })
})
