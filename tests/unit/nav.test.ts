/**
 * watchNavigation (docs/dom-integration.md section 4). Added after the bootstrap review (#8): it had
 * no unit tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import { SOFT_NAV_EVENTS, watchNavigation } from '@/github/nav';

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

describe('watchNavigation', () => {
  let ctx: ContentScriptContext;

  afterEach(() => {
    ctx.notifyInvalidated();
  });

  it('coalesces every signal in one frame into a single callback', async () => {
    ctx = new ContentScriptContext('test');
    const onChange = vi.fn();
    watchNavigation(ctx, onChange);

    for (const type of SOFT_NAV_EVENTS) document.dispatchEvent(new Event(type));
    window.dispatchEvent(new PopStateEvent('popstate'));
    await nextFrame();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('fires again for a signal in a later frame', async () => {
    ctx = new ContentScriptContext('test');
    const onChange = vi.fn();
    watchNavigation(ctx, onChange);

    document.dispatchEvent(new Event('turbo:load'));
    await nextFrame();
    document.dispatchEvent(new Event('soft-nav:end'));
    await nextFrame();

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('cancels a frame callback already scheduled when the context is invalidated (#11)', async () => {
    ctx = new ContentScriptContext('test');
    const onChange = vi.fn();
    watchNavigation(ctx, onChange);

    document.dispatchEvent(new Event('soft-nav:end'));
    ctx.notifyInvalidated();
    await nextFrame();
    await nextFrame();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops listening once the context is invalidated', async () => {
    ctx = new ContentScriptContext('test');
    const onChange = vi.fn();
    watchNavigation(ctx, onChange);

    ctx.notifyInvalidated();
    document.dispatchEvent(new Event('soft-nav:end'));
    await nextFrame();

    expect(onChange).not.toHaveBeenCalled();
  });
});
