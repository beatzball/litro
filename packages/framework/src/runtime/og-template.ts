export interface OgTemplateInput {
  title: string;
  description?: string;
  type?: string;
  siteName: string;
  logoSvg?: string;
  /** Base64 data URI for a logo image (e.g. `data:image/png;base64,...`) */
  logoDataUri?: string;
  accentColor?: string;
}

export type OgTemplate = (input: OgTemplateInput) => Record<string, unknown>;

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
}

export const defaultOgTemplate: OgTemplate = (input) => {
  const {
    title,
    description,
    type,
    siteName,
    accentColor = '#ea580c',
  } = input;

  const displayTitle = truncate(title, 80);
  const titleSize = title.length > 60 ? 40 : 48;
  const displayDescription = description ? truncate(description, 120) : undefined;

  const showBadge = type && type !== 'website';

  const topRowChildren: Record<string, unknown>[] = [];

  if (input.logoDataUri) {
    topRowChildren.push({
      type: 'img',
      props: {
        src: input.logoDataUri,
        width: 36,
        height: 36,
        style: { display: 'flex' },
      },
    });
  }

  topRowChildren.push({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        fontSize: 24,
        color: '#94a3b8',
        fontWeight: 700,
      },
      children: siteName,
    },
  });

  const topRow: Record<string, unknown> = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      },
      children: topRowChildren,
    },
  };

  const centerChildren: Record<string, unknown>[] = [
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          fontSize: titleSize,
          color: '#e2e4e9',
          fontWeight: 700,
        },
        children: displayTitle,
      },
    },
  ];

  if (displayDescription) {
    centerChildren.push({
      type: 'div',
      props: {
        style: {
          display: 'flex',
          fontSize: 24,
          color: '#64748b',
        },
        children: displayDescription,
      },
    });
  }

  const centerSection: Record<string, unknown> = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        flexGrow: 1,
        justifyContent: 'center',
      },
      children: centerChildren,
    },
  };

  const bottomChildren: Record<string, unknown>[] = [
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          width: 200,
          height: 4,
          background: `linear-gradient(to right, ${accentColor}, #fb923c)`,
        },
      },
    },
  ];

  if (showBadge) {
    bottomChildren.push({
      type: 'div',
      props: {
        style: {
          display: 'flex',
          fontSize: 18,
          textTransform: 'uppercase',
          letterSpacing: 2,
          color: accentColor,
          border: `1px solid ${accentColor}66`,
          padding: '6px 16px',
          borderRadius: 6,
        },
        children: type,
      },
    });
  }

  const bottomRow: Record<string, unknown> = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      },
      children: bottomChildren,
    },
  };

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: 1200,
        height: 630,
        backgroundColor: '#0d0e11',
        padding: 60,
      },
      children: [topRow, centerSection, bottomRow],
    },
  };
};
