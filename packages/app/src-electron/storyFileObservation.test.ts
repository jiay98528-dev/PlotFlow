import { describe, expect, it } from 'vitest';
import { StoryFileObservationTracker } from './storyFileObservation';

describe('StoryFileObservationTracker', () => {
  it('reports an external A -> B -> A sequence without treating A as a permanent baseline', () => {
    const tracker = new StoryFileObservationTracker('A');

    expect(tracker.observe('B')).toEqual({ changed: true, shouldNotify: true });
    expect(tracker.observe('B')).toEqual({ changed: false, shouldNotify: false });
    expect(tracker.observe('A')).toEqual({ changed: true, shouldNotify: true });
  });

  it('suppresses an internal write once but reports the same hash after another disk revision', () => {
    const tracker = new StoryFileObservationTracker('A');
    const token = tracker.beginInternalWrite('C');

    expect(tracker.observe('C')).toEqual({ changed: true, shouldNotify: false });
    tracker.settleInternalWrite(token, true);
    expect(tracker.observe('B')).toEqual({ changed: true, shouldNotify: true });
    expect(tracker.observe('C')).toEqual({ changed: true, shouldNotify: true });
  });

  it('does not let a failed internal write suppress a later external revision', () => {
    const tracker = new StoryFileObservationTracker('A');
    const token = tracker.beginInternalWrite('C');
    tracker.settleInternalWrite(token, false);

    expect(tracker.observe('C')).toEqual({ changed: true, shouldNotify: true });
  });
});
