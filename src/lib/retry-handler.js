(function initRetryHandler(global) {
  "use strict";

  function createRetryController(config) {
    let timeoutId = null;
    let retryIndex = 0;
    let cancelled = false;

    function cancel() {
      cancelled = true;
      retryIndex = 0;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }

    function reset() {
      retryIndex = 0;
      cancelled = false;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }

    function scheduleRetry(run) {
      if (cancelled) {
        return;
      }

      const delay = config.retryBackoffMs[Math.min(retryIndex, config.retryBackoffMs.length - 1)];
      retryIndex += 1;

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(function onRetryTimeout() {
        timeoutId = null;
        run();
      }, delay);
    }

    return {
      cancel,
      reset,
      scheduleRetry
    };
  }

  function createDebouncedRunner(delayMs, fn) {
    let timeoutId = null;

    return function runDebounced() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(function onDebounceElapsed() {
        timeoutId = null;
        fn();
      }, delayMs);
    };
  }

  global.GPE_RetryHandler = {
    createRetryController,
    createDebouncedRunner
  };
})(globalThis);
