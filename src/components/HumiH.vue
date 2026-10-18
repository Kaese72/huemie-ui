<!-- The H of the Humi logo: the font's own H with a house roof drawn over it
     and a lit amber dot under the peak. Being real text, it always matches
     the letters around it: put it straight before "umi" to spell "Humi"
     (see BrandMark). The roof follows `color`.

     The span has no letter-spacing of its own, so the roof can be centred
     on the glyph. Set --humi-ls to the surrounding letter-spacing to keep
     the gap to the next letter the same. -->
<template>
  <span class="humi-h">H<span class="roof" aria-hidden="true"><svg viewBox="0 0 100 32" preserveAspectRatio="none"><polyline points="0,32 50,0 100,32" vector-effect="non-scaling-stroke" /></svg><span class="dot" /></span></span>
</template>

<style scoped>
.humi-h {
  position: relative;
  display: inline-block;
  letter-spacing: 0;
  margin-right: var(--humi-ls, 0);
}
/* Spans the H plus 0.12em of eave on each side, sits 0.08em above the cap
   height (0.7em in the system font stack), pitched at 32%. */
.roof {
  position: absolute;
  left: -0.12em;
  right: -0.12em;
  bottom: calc(0.7em + 0.08em + 0.07em);
  aspect-ratio: 100 / 32;
  pointer-events: none;
}
.roof svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: 0.14em;
  stroke-linecap: butt;
  stroke-linejoin: miter;
}
.dot {
  position: absolute;
  left: 50%;
  top: 82%;
  width: 0.12em;
  height: 0.12em;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: var(--warm);
  box-shadow: 0 0 0.08em var(--warm);
}
</style>
