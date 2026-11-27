import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppSidebar from '@/components/AppSidebar';

describe('AppSidebar', () => {
  it('navigates to Analytics from the Reports section', () => {
    const onNavigate = vi.fn();
    render(<AppSidebar activeScreen="dashboard" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: /Analytics/ }));

    expect(onNavigate).toHaveBeenCalledWith('analytics');
  });
});
