/**
 * Workaround for Next.js 16 performance.measure negative timestamp error.
 * See: https://github.com/vercel/next.js/issues/86060
 */
(function () {
  try {
    if (typeof window === 'undefined') return;
    var perf = window.performance;
    if (!perf || typeof perf.measure !== 'function' || perf.__patched) return;

    var original = perf.measure.bind(perf);
    perf.__originalMeasure = original;

    perf.measure = function () {
      try {
        return original.apply(perf, arguments);
      } catch (err) {
        var msg = (err && err.message) || '';
        var name = (err && err.name) || '';
        if (
          msg.indexOf('negative time stamp') !== -1 ||
          name === 'InvalidAccessError' ||
          name === 'SyntaxError'
        ) {
          return;
        }
        throw err;
      }
    };

    perf.__patched = true;
  } catch (_) {}
})();
