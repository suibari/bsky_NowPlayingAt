/**
 * Svelte action to detect swipe gestures.
 * Dispatches 'swipeLeft' and 'swipeRight' events.
 */
export function swipe(node: HTMLElement, parameters = { threshold: 50, timeout: 300 }) {
    let startX: number;
    let startY: number;
    let startTime: number;

    function handleTouchStart(e: TouchEvent) {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now();
        console.log('Touch start:', startX, startY);
    }

    function handleTouchEnd(e: TouchEvent) {
        if (e.changedTouches.length !== 1) return;
        const touch = e.changedTouches[0];
        const endX = touch.clientX;
        const endY = touch.clientY;
        const endTime = Date.now();

        const diffX = endX - startX;
        const diffY = endY - startY;
        const duration = endTime - startTime;

        console.log('Touch end:', endX, endY, 'Diff:', diffX, diffY, 'Duration:', duration);

        // Check if swipe is fast enough
        if (duration > parameters.timeout) {
            console.log('Swipe timeout');
            return;
        }

        // Check if horizontal swipe is dominant and exceeds threshold
        if (Math.abs(diffX) > parameters.threshold && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0) {
                console.log('Dispatching swipeRight');
                node.dispatchEvent(new CustomEvent('swipeRight'));
            } else {
                console.log('Dispatching swipeLeft');
                node.dispatchEvent(new CustomEvent('swipeLeft'));
            }
        } else {
            console.log('Swipe threshold not met or vertical dominant', Math.abs(diffX), parameters.threshold);
        }
    }

    node.addEventListener('touchstart', handleTouchStart, { passive: true });
    node.addEventListener('touchend', handleTouchEnd, { passive: true });

    return {
        destroy() {
            node.removeEventListener('touchstart', handleTouchStart);
            node.removeEventListener('touchend', handleTouchEnd);
        }
    };
}
