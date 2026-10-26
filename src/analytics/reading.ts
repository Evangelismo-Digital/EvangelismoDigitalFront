// How much of a page was actually read: visible time and how far down it got.

/** The reading funnel reported for articles, once each per view. */
export const SCROLL_MILESTONES = [25, 50, 75, 100] as const;

const ARTICLE_PATH = /^\/artigo\/([^/]+)\/?$/;

/** The article slug for `/artigo/:slug`, otherwise null. */
export function articleSlug(pathname: string): string | null {
    return ARTICLE_PATH.exec(pathname)?.[1] ?? null;
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/**
 * How far down the reader got, in percent. Against `element` (an article's body) when given, so the
 * form and the church search below it don't count as read; otherwise against the whole document.
 */
export function scrollDepth(element: Element | null): number {
    const viewportBottom = window.innerHeight;
    if (element) {
        const { top, height } = element.getBoundingClientRect();
        return height > 0 ? clampPercent(((viewportBottom - top) / height) * 100) : 0;
    }
    const scrollable = document.documentElement.scrollHeight;
    return scrollable > 0 ? clampPercent(((window.scrollY + viewportBottom) / scrollable) * 100) : 0;
}

/**
 * One page view's reading: time counts only while the tab is visible (a backgrounded article is not
 * being read), and depth keeps its maximum.
 */
export class PageReading {
    private visibleMs = 0;
    private visibleSince: number | null;
    private deepest = 0;
    private readonly reached = new Set<number>();

    constructor(
        private readonly now: () => number,
        visible: boolean,
    ) {
        this.visibleSince = visible ? now() : null;
    }

    setVisible(visible: boolean): void {
        if (visible && this.visibleSince === null) {
            this.visibleSince = this.now();
        } else if (!visible && this.visibleSince !== null) {
            this.visibleMs += this.now() - this.visibleSince;
            this.visibleSince = null;
        }
    }

    durationMs(): number {
        const running = this.visibleSince === null ? 0 : this.now() - this.visibleSince;
        return Math.round(this.visibleMs + running);
    }

    /** Records a depth reading and returns the milestones crossed for the first time. */
    recordDepth(depth: number): number[] {
        this.deepest = Math.max(this.deepest, depth);
        const crossed = SCROLL_MILESTONES.filter((milestone) => this.deepest >= milestone && !this.reached.has(milestone));
        crossed.forEach((milestone) => this.reached.add(milestone));
        return crossed;
    }

    maxDepth(): number {
        return this.deepest;
    }
}
