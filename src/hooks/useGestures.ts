// src/hooks/useGestures.ts
// Mobil gesture yönetimi hook'u

import { useCallback, useRef } from 'react';
import { useGesture } from '@use-gesture/react';

// Swipe yönleri
export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

// Gesture hook options
interface UseSwipeOptions {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    threshold?: number;
    velocity?: number;
}

export function useSwipe(options: UseSwipeOptions) {
    const {
        onSwipeLeft,
        onSwipeRight,
        onSwipeUp,
        onSwipeDown,
        threshold = 50,
        velocity = 0.3,
    } = options;

    const bind = useGesture({
        onDrag: ({ movement: [mx, my], velocity: [vx, vy], direction: [dx, dy], cancel }) => {
            // Horizontal swipe
            if (Math.abs(mx) > threshold && Math.abs(vx) > velocity) {
                if (dx < 0 && onSwipeLeft) {
                    onSwipeLeft();
                    cancel();
                } else if (dx > 0 && onSwipeRight) {
                    onSwipeRight();
                    cancel();
                }
            }

            // Vertical swipe
            if (Math.abs(my) > threshold && Math.abs(vy) > velocity) {
                if (dy < 0 && onSwipeUp) {
                    onSwipeUp();
                    cancel();
                } else if (dy > 0 && onSwipeDown) {
                    onSwipeDown();
                    cancel();
                }
            }
        },
    });

    return bind;
}

// Pull to refresh hook
interface UsePullToRefreshOptions {
    onRefresh: () => Promise<void>;
    threshold?: number;
}

export function usePullToRefresh(options: UsePullToRefreshOptions) {
    const { onRefresh, threshold = 80 } = options;
    const isRefreshing = useRef(false);
    const pullDistance = useRef(0);

    const bind = useGesture({
        onDrag: ({ movement: [, my], direction: [, dy], first, last }) => {
            // Sadece aşağı çekme (scroll en üstteyken)
            if (dy < 0 || my < 0) return;

            if (first) {
                pullDistance.current = 0;
            }

            pullDistance.current = my;

            if (last && my > threshold && !isRefreshing.current) {
                isRefreshing.current = true;
                onRefresh().finally(() => {
                    isRefreshing.current = false;
                    pullDistance.current = 0;
                });
            }
        },
    });

    return {
        bind,
        isRefreshing: isRefreshing.current,
        pullDistance: pullDistance.current,
    };
}

// Haptic feedback helper (mobil cihazlarda)
export function hapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light') {
    if (!navigator.vibrate) return;

    const patterns = {
        light: 10,
        medium: 25,
        heavy: 50,
    };

    navigator.vibrate(patterns[type]);
}

// Long press hook
interface UseLongPressOptions {
    onLongPress: () => void;
    delay?: number;
    onStart?: () => void;
    onCancel?: () => void;
}

export function useLongPress(options: UseLongPressOptions) {
    const { onLongPress, delay = 500, onStart, onCancel } = options;
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPress = useRef(false);

    const start = useCallback(() => {
        isLongPress.current = false;
        onStart?.();

        timerRef.current = setTimeout(() => {
            isLongPress.current = true;
            hapticFeedback('medium');
            onLongPress();
        }, delay);
    }, [delay, onLongPress, onStart]);

    const cancel = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (!isLongPress.current) {
            onCancel?.();
        }
    }, [onCancel]);

    return {
        onMouseDown: start,
        onMouseUp: cancel,
        onMouseLeave: cancel,
        onTouchStart: start,
        onTouchEnd: cancel,
    };
}

export default { useSwipe, usePullToRefresh, useLongPress, hapticFeedback };
