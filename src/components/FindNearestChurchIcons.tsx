import { ReactNode } from 'react';
import styles from './css/FindNearestChurch.module.css';

/** 20px line icons for the church search; decorative, the text next to each one names the action. */
const Icon = ({ children }: { children: ReactNode }) => (
    <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
    >
        {children}
    </svg>
);

export const WalkIcon = () => (
    <Icon>
        <circle cx="13" cy="4" r="2" />
        <path d="m9 21 2.5-6.5L14 17v4M11.5 14.5 12 9l-3.5 2V14M12 9l3 3h3" />
    </Icon>
);

export const CarIcon = () => (
    <Icon>
        <path d="M5 17H3v-4.5L5 7a2 2 0 0 1 1.9-1.5h10.2A2 2 0 0 1 19 7l2 5.5V17h-2" />
        <path d="M3 12.5h18M9 17h6" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
    </Icon>
);

export const PinIcon = () => (
    <Icon>
        <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
        <circle cx="12" cy="10" r="2.5" />
    </Icon>
);

export const MailIcon = () => (
    <Icon>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </Icon>
);

export const SearchIcon = () => (
    <Icon>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
    </Icon>
);
