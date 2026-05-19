const Ic = ({
  d,
  size = 16,
  sw = 1.5,
  className = "",
}: {
  d: string | string[];
  size?: number;
  sw?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {Array.isArray(d)
      ? d.map((p, i) => <path key={i} d={p} />)
      : <path d={d} />}
  </svg>
);

type IconProps = { size?: number; sw?: number; className?: string };

export const Icon = {
  Play:       (p: IconProps) => <Ic {...p} d="M8 5v14l11-7z" />,
  ArrowRight: (p: IconProps) => <Ic {...p} d="M5 12h14M13 5l7 7-7 7" />,
  CornerDown: (p: IconProps) => <Ic {...p} d="M4 4v9a3 3 0 0 0 3 3h13M15 11l5 5-5 5" />,
  Plus:       (p: IconProps) => <Ic {...p} d="M12 5v14M5 12h14" />,
  Quote:      (p: IconProps) => (
    <Ic
      {...p}
      d="M7 7c-1.7 0-3 1.3-3 3s1.3 3 3 3h1v3c0 1.1-.9 2-2 2H5v2h1c2.2 0 4-1.8 4-4V10c0-1.7-1.3-3-3-3zM17 7c-1.7 0-3 1.3-3 3s1.3 3 3 3h1v3c0 1.1-.9 2-2 2h-1v2h1c2.2 0 4-1.8 4-4V10c0-1.7-1.3-3-3-3z"
    />
  ),
  Check:      (p: IconProps) => <Ic {...p} d="M20 6L9 17l-5-5" />,
  Zap:        (p: IconProps) => <Ic {...p} d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  Shield:     (p: IconProps) => <Ic {...p} d={["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"]} />,
  Cpu:        (p: IconProps) => <Ic {...p} d={["M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2","M6 5h12a1 1 0 011 1v12a1 1 0 01-1 1H6a1 1 0 01-1-1V6a1 1 0 011-1z","M9 9h6v6H9z"]} />,
  GitBranch:  (p: IconProps) => <Ic {...p} d={["M6 3v12","M18 9a3 3 0 100-6 3 3 0 000 6z","M6 21a3 3 0 100-6 3 3 0 000 6z","M18 9c0 6-12 6-12 9"]} />,
  Layers:     (p: IconProps) => <Ic {...p} d={["M12 2L2 7l10 5 10-5-10-5z","M2 17l10 5 10-5","M2 12l10 5 10-5"]} />,
  Clock:      (p: IconProps) => <Ic {...p} d={["M12 2a10 10 0 100 20 10 10 0 000-20z","M12 6v6l4 2"]} />,
  Mail:       (p: IconProps) => <Ic {...p} d={["M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z","M22 6l-10 7L2 6"]} />,
  Users:      (p: IconProps) => <Ic {...p} d={["M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2","M9 7a4 4 0 100 8 4 4 0 000-8z","M23 21v-2a4 4 0 00-3-3.87","M16 3.13a4 4 0 010 7.75"]} />,
  Workflow:   (p: IconProps) => <Ic {...p} d={["M3 3h6v6H3z","M15 3h6v6h-6z","M3 15h6v6H3z","M15 15h6v6h-6z","M9 6h6","M6 9v6","M18 9v6","M9 18h6"]} />,
  ChevDown:   (p: IconProps) => <Ic {...p} d="M6 9l6 6 6-6" />,
};
