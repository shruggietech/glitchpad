import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="brand-lockup">
          <img
            src="/logos/glitchpad-horizontal-light.svg"
            alt="Glitchpad"
            className="brand-lockup-dark"
          />
          <img
            src="/logos/glitchpad-horizontal-black.svg"
            alt=""
            className="brand-lockup-light"
          />
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
