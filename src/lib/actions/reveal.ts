/**
 * Svelte action for scroll-driven reveal.
 *
 * Adds `reveal-visible` once the node scrolls into view (and keeps it there —
 * about ページの演出は一度出たら消さない方が読みやすい)。
 * `delay` で同じセクション内の要素をずらして出せる。
 * prefers-reduced-motion のときは即座に表示して監視しない。
 */
export function reveal(
    node: HTMLElement,
    parameters: { delay?: number; threshold?: number } = {}
) {
    const { delay = 0, threshold = 0.15 } = parameters;

    node.classList.add('reveal');
    if (delay) node.style.transitionDelay = `${delay}ms`;

    const reduced =
        typeof matchMedia !== 'undefined' &&
        matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || typeof IntersectionObserver === 'undefined') {
        node.classList.add('reveal-visible');
        return {};
    }

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                node.classList.add('reveal-visible');
                observer.unobserve(node);
            }
        },
        { threshold, rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(node);

    return {
        destroy() {
            observer.disconnect();
        }
    };
}
