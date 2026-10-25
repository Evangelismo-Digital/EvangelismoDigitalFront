/**
 * The search in one picture: a dotted route leaves a home marked "you are here"
 * and winds to a church. Drawn inline in the site's palette (no image request);
 * decorative, so hidden from screen readers.
 */
function ChurchRouteIllustration({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 400 300"
            aria-hidden="true"
            focusable="false"
        >
            <circle cx="200" cy="150" r="128" fill="var(--primary5)" />
            <ellipse cx="200" cy="254" rx="172" ry="12" fill="var(--primary4)" />

            {/* birds */}
            <path d="M58 74q6-7 12 0q6-7 12 0M92 58q4-5 8 0q4-5 8 0" fill="none" stroke="var(--secondary2)" strokeWidth="2.5" strokeLinecap="round" />

            {/* trees */}
            <rect x="146" y="214" width="7" height="40" rx="3" fill="var(--secondary1)" />
            <circle cx="149.5" cy="204" r="22" fill="var(--primary3)" />
            <rect x="225" y="224" width="6" height="30" rx="3" fill="var(--secondary1)" />
            <circle cx="228" cy="216" r="15" fill="var(--primary4)" />

            {/* the route */}
            <path
                d="M95 256C130 270 165 242 205 250S268 268 300 256"
                fill="none"
                stroke="var(--primary1)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="0.5 12"
            />

            {/* home */}
            <path d="M48 202 88 166l40 36" fill="var(--black2)" stroke="var(--black2)" strokeWidth="4" strokeLinejoin="round" />
            <rect x="58" y="198" width="60" height="56" rx="2" fill="var(--white)" stroke="var(--black2)" strokeWidth="3" />
            <rect x="65" y="210" width="13" height="13" rx="1.5" fill="var(--primary4)" stroke="var(--black2)" strokeWidth="2.5" />
            <rect x="86" y="224" width="17" height="30" rx="2" fill="var(--primary1)" stroke="var(--black2)" strokeWidth="2.5" />

            {/* "you are here" pin over the home */}
            <path d="M88 158s-18-17-18-31a18 18 0 0 1 36 0c0 14-18 31-18 31Z" fill="var(--primary1)" stroke="var(--black2)" strokeWidth="3" strokeLinejoin="round" />
            <circle cx="88" cy="127" r="6.5" fill="var(--white)" />

            {/* church */}
            <rect x="291" y="102" width="18" height="40" fill="var(--white)" stroke="var(--black2)" strokeWidth="3" />
            <path d="M285 104 300 84l15 20Z" fill="var(--primary1)" stroke="var(--black2)" strokeWidth="3" strokeLinejoin="round" />
            <path d="M300 60v22M292 68h16" stroke="var(--black2)" strokeWidth="3.5" strokeLinecap="round" />
            <rect x="262" y="170" width="76" height="84" fill="var(--white)" stroke="var(--black2)" strokeWidth="3" />
            <path d="M254 176 300 132l46 44Z" fill="var(--primary1)" stroke="var(--black2)" strokeWidth="3" strokeLinejoin="round" />
            <circle cx="300" cy="194" r="9" fill="var(--primary4)" stroke="var(--black2)" strokeWidth="2.5" />
            <path d="M288 254v-24a12 12 0 0 1 24 0v24" fill="var(--primary1)" stroke="var(--black2)" strokeWidth="2.5" />
            <rect x="270" y="204" width="10" height="16" rx="5" fill="var(--primary4)" stroke="var(--black2)" strokeWidth="2" />
            <rect x="320" y="204" width="10" height="16" rx="5" fill="var(--primary4)" stroke="var(--black2)" strokeWidth="2" />
        </svg>
    );
}

export default ChurchRouteIllustration;
