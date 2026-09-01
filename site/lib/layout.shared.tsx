import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="brand-lockup">
          <img
            src="/logos/glitchpad-horizontal-white.svg"
            alt=""
            aria-hidden="true"
            className="brand-lockup-on-dark"
          />
          <img
            src="/logos/glitchpad-horizontal-black.svg"
            alt=""
            aria-hidden="true"
            className="brand-lockup-on-light"
          />
          <span className="sr-only">Glitchpad</span>
        </span>
      ),
    },
    links: [
      { text: 'Documentation', url: '/docs' },
      { text: 'Support', url: '/support' },
      { text: 'Security', url: '/security' },
    ],
    githubUrl: 'https://github.com/ShruggieTech/glitchpad',
  };
}
