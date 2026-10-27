import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MailIcon, PhoneIcon, SendIcon, UserIcon } from './FormContatoIcons';

describe('FormContatoIcons', () => {
    it.each([
        ['UserIcon', UserIcon],
        ['MailIcon', MailIcon],
        ['PhoneIcon', PhoneIcon],
        ['SendIcon', SendIcon],
    ])('renders %s as an SVG with decorative accessibility attributes', (_name, Component) => {
        const { container } = render(<Component />);
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg).toHaveAttribute('aria-hidden', 'true');
        expect(svg).toHaveAttribute('focusable', 'false');
        expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
        expect(svg?.children.length).toBeGreaterThan(0);
    });
});
