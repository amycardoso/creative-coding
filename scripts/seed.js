// Makes any sketch reproducible from a seed, without changing its code.
//
// Run it before p5 loads: the gallery inlines it into every live sketch and
// scripts/capture-frames.mjs injects it into the page it records. It reads
// ?seed=N from the URL and falls back to window.__seedBase, the sketch's
// default seed (the `seed` field in manifest.json).
//
// - Math.random becomes a seeded generator, so p5's random() and noise()
//   (which draw from Math.random until a sketch seeds them) repeat for the
//   same seed, and so do shader seeds picked with Math.random.
// - When the seed is not the sketch's default and the sketch does not read
//   ?seed itself, every randomSeed()/noiseSeed() call is mixed with it, so
//   sketches that hard-code their seeds change too. With the default seed
//   they behave exactly as they do on their own.
(() => {
  const base = Number.isFinite(window.__seedBase) ? window.__seedBase : null;
  const fromUrl = parseInt(new URLSearchParams(location.search).get("seed"), 10);
  const seed = Number.isFinite(fromUrl) ? fromUrl : base;
  if (seed === null) return;
  window.__seed = seed;

  // splitmix32 spreads the seed into sfc32's four words of state.
  let s = seed >>> 0;
  const split = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  let a = split(), b = split(), c = split(), d = split();
  Math.random = () => {
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };

  // A sketch that reads ?seed already knows what to do with it.
  let sketchReadsSeed = false;
  const { get, has } = URLSearchParams.prototype;
  URLSearchParams.prototype.get = function (name) {
    if (name === "seed") sketchReadsSeed = true;
    return get.call(this, name);
  };
  URLSearchParams.prototype.has = function (name) {
    if (name === "seed") sketchReadsSeed = true;
    return has.call(this, name);
  };

  const mix = (x) =>
    x == null
      ? x
      : (Math.imul((Math.round(Number(x) * 1000) | 0) ^ 0x2545f491, 0x9e3779b1) ^
          Math.imul(seed >>> 0, 0x85ebca6b)) >>> 0;

  const patched = new WeakSet();
  const patch = (P) => {
    if (!P || !P.prototype || patched.has(P)) return;
    patched.add(P);
    for (const name of ["randomSeed", "noiseSeed"]) {
      const original = P.prototype[name];
      if (typeof original !== "function") continue;
      P.prototype[name] = function (x) {
        return original.call(this, seed !== base && !sketchReadsSeed ? mix(x) : x);
      };
    }
  };

  // p5 is not loaded yet: catch it as its script assigns window.p5. Global
  // mode copies the prototype's functions onto window later, on page load.
  if (window.p5) patch(window.p5);
  else {
    let P;
    Object.defineProperty(window, "p5", {
      configurable: true,
      enumerable: true,
      get: () => P,
      set: (v) => {
        P = v;
        patch(v);
      },
    });
  }
})();
